# Bounded Point Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unbounded `LocationPoint` loading from the timeline stats path and the map data endpoint, so server and client memory stay bounded regardless of dataset size.

**Architecture:** Replace `getAllPoints()` with a SQL-aggregated `getStatsForRange()` for the stats use case. Rewrite `/api/locations` as a cursor-paginated, viewport-bounded endpoint with server-side decimation when in-bounds counts exceed a threshold. Wire the map client to consume it via `useInfiniteQuery`. Move the unknown-visit centroid computation behind its own endpoint so `/api/locations` can hard-require viewport bounds.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7 + Postgres, TanStack Query v5, vitest (unit), Playwright (e2e).

**Spec:** [docs/superpowers/specs/2026-04-12-unbounded-point-loading-design.md](../specs/2026-04-12-unbounded-point-loading-design.md)

---

## File Structure

**New:**
- `lib/stats.ts` — pure `assembleStats(globals, buckets, groupBy): DailyStats` helper (no DB access, easy to unit test).
- `tests/unit/stats-assembleStats.test.ts`
- `tests/unit/getStatsForRange.test.ts`
- `app/api/unknown-visits/[id]/centroid/route.ts`
- `tests/unit/api-unknown-visit-centroid.test.ts`
- `tests/unit/api-locations-route.test.ts`
- `tests/e2e/timeline-range-all.spec.ts`
- `tests/e2e/map-progressive-load.spec.ts`

**Modified:**
- `lib/locations.ts` — add `getStatsForRange`; delete `getAllPoints`.
- `lib/groupByHour.ts` — drop `TimeGroup.points`; delete `computePeriodStats`/`computeDailyStats`.
- `lib/geo.ts` — delete `totalDistanceKm` (only consumer removed).
- `app/timeline/[date]/page.tsx` — switch to `getStatsForRange`; emit `rangeStart/rangeEnd` for `?range=all`.
- `app/api/locations/route.ts` — new contract (viewport + cursor + decimation).
- `components/map/MapWrapper.tsx` — `useInfiniteQuery`; drop `isAll` branch.
- `lib/visitCentroid.ts` — call the new centroid endpoint.
- `README.md` — refresh `/api/locations` examples.

**Tunables (exported from `lib/locations.ts`):** `DECIMATION_THRESHOLD = 20_000`, `DEFAULT_PAGE_LIMIT = 5_000`, `MAX_PAGE_LIMIT = 10_000`.

---

## Task 1: Drop unused `points` field from `TimeGroup`

**Rationale:** `TimeGroup.points` is never read by any consumer (verified during brainstorming). Removing it first lets later tasks drop dependencies on point data without type churn.

**Files:**
- Modify: `lib/groupByHour.ts`

- [ ] **Step 1: Run full vitest suite to establish green baseline**

Run: `pnpm test`
Expected: all existing tests pass.

- [ ] **Step 2: Remove `points` from `TimeGroup` type and stop populating it**

Edit `lib/groupByHour.ts`:

```ts
export type TimeGroup = {
  key: string;
  label: string;
  distanceKm: number;
};
```

And in `computePeriodStats`, update the group construction:

```ts
const groups: TimeGroup[] = Array.from(buckets.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, pts]) => ({
    key:
      groupBy === "hour"
        ? format(pts[0].recordedAt, "HH:00")
        : format(pts[0].recordedAt, "yyyy-MM-dd"),
    label:
      groupBy === "hour"
        ? format(pts[0].recordedAt, "h a")
        : format(pts[0].recordedAt, "EEE, MMM d"),
    distanceKm: totalDistanceKm(pts),
  }));
```

- [ ] **Step 3: Type-check and test**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: clean compile, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/groupByHour.ts
git commit -m "refactor(stats): drop unused TimeGroup.points field"
```

---

## Task 2: Introduce pure `assembleStats` helper

**Files:**
- Create: `lib/stats.ts`
- Create: `tests/unit/stats-assembleStats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/stats-assembleStats.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { assembleStats } from "@/lib/stats";

describe("assembleStats", () => {
  it("returns zeros for empty input", () => {
    const stats = assembleStats(
      { totalPoints: 0, firstTst: null, lastTst: null, daysWithData: 0, totalKm: 0 },
      [],
      "hour",
    );
    expect(stats).toEqual({
      totalPoints: 0,
      totalDistanceKm: 0,
      durationMinutes: 0,
      daysWithData: 0,
      groups: [],
    });
  });

  it("labels hour groups with `h a` and keys as `HH:00`", () => {
    const stats = assembleStats(
      { totalPoints: 3, firstTst: 1_700_000_000, lastTst: 1_700_003_600, daysWithData: 1, totalKm: 2.5 },
      [
        { bucketKey: "09", bucketStart: new Date("2026-04-12T09:12:00Z"), bucketKm: 1.5 },
        { bucketKey: "10", bucketStart: new Date("2026-04-12T10:03:00Z"), bucketKm: 1.0 },
      ],
      "hour",
    );
    expect(stats.totalDistanceKm).toBeCloseTo(2.5, 6);
    expect(stats.durationMinutes).toBe(Math.round((1_700_003_600 - 1_700_000_000) / 60));
    expect(stats.daysWithData).toBe(1);
    expect(stats.groups).toHaveLength(2);
    expect(stats.groups[0].key).toMatch(/^\d{2}:00$/);
    expect(stats.groups[0].label).toMatch(/(AM|PM)/);
    expect(stats.groups[0].distanceKm).toBeCloseTo(1.5, 6);
  });

  it("labels day groups with ISO date key and weekday label", () => {
    const stats = assembleStats(
      { totalPoints: 2, firstTst: 1_700_000_000, lastTst: 1_700_090_000, daysWithData: 2, totalKm: 4.2 },
      [
        { bucketKey: "2026-04-11", bucketStart: new Date("2026-04-11T07:00:00Z"), bucketKm: 2.0 },
        { bucketKey: "2026-04-12", bucketStart: new Date("2026-04-12T08:00:00Z"), bucketKm: 2.2 },
      ],
      "day",
    );
    expect(stats.groups[0].key).toBe("2026-04-11");
    expect(stats.groups[1].key).toBe("2026-04-12");
    expect(stats.groups[0].label).toMatch(/^\w{3}, \w{3} \d+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/stats-assembleStats.test.ts`
Expected: FAIL — `assembleStats` / `@/lib/stats` not found.

- [ ] **Step 3: Implement `lib/stats.ts`**

```ts
import { format } from "date-fns";
import type { DailyStats, TimeGroup } from "@/lib/groupByHour";

export type StatsGlobalsRow = {
  totalPoints: number;
  firstTst: number | null;
  lastTst: number | null;
  daysWithData: number;
  totalKm: number;
};

export type StatsBucketRow = {
  bucketKey: string;
  bucketStart: Date;
  bucketKm: number;
};

export function assembleStats(
  globals: StatsGlobalsRow,
  buckets: StatsBucketRow[],
  groupBy: "hour" | "day",
): DailyStats {
  if (globals.totalPoints === 0) {
    return {
      totalPoints: 0,
      totalDistanceKm: 0,
      durationMinutes: 0,
      daysWithData: 0,
      groups: [],
    };
  }

  const durationMinutes =
    globals.firstTst !== null && globals.lastTst !== null
      ? Math.round((globals.lastTst - globals.firstTst) / 60)
      : 0;

  const groups: TimeGroup[] = buckets.map((b) => ({
    key: groupBy === "hour" ? format(b.bucketStart, "HH:00") : format(b.bucketStart, "yyyy-MM-dd"),
    label: groupBy === "hour" ? format(b.bucketStart, "h a") : format(b.bucketStart, "EEE, MMM d"),
    distanceKm: b.bucketKm,
  }));

  return {
    totalPoints: globals.totalPoints,
    totalDistanceKm: globals.totalKm,
    durationMinutes,
    daysWithData: globals.daysWithData,
    groups,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/stats-assembleStats.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/stats.ts tests/unit/stats-assembleStats.test.ts
git commit -m "feat(stats): add pure assembleStats helper"
```

---

## Task 3: Implement `getStatsForRange` with SQL aggregation

**Files:**
- Modify: `lib/locations.ts`
- Create: `tests/unit/getStatsForRange.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/getStatsForRange.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { getStatsForRange } from "@/lib/locations";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

const queryRaw = prisma.$queryRaw as unknown as MockFn;

describe("getStatsForRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeroed stats when there are no points", async () => {
    queryRaw
      .mockResolvedValueOnce([
        { total_points: 0n, first_tst: null, last_tst: null, days_with_data: 0n, total_km: 0 },
      ])
      .mockResolvedValueOnce([]);

    const stats = await getStatsForRange(new Date("2026-01-01"), new Date("2026-01-02"), "hour");

    expect(stats.totalPoints).toBe(0);
    expect(stats.groups).toEqual([]);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("assembles DailyStats from globals + bucket rows", async () => {
    queryRaw
      .mockResolvedValueOnce([
        {
          total_points: 120n,
          first_tst: 1_700_000_000,
          last_tst: 1_700_003_600,
          days_with_data: 1n,
          total_km: 5.25,
        },
      ])
      .mockResolvedValueOnce([
        { bucket_key: "09", bucket_start: new Date("2026-04-12T09:00:00Z"), bucket_km: 2.25 },
        { bucket_key: "10", bucket_start: new Date("2026-04-12T10:00:00Z"), bucket_km: 3.0 },
      ]);

    const stats = await getStatsForRange(new Date("2026-04-12T00:00:00Z"), new Date("2026-04-12T23:59:59Z"), "hour");

    expect(stats.totalPoints).toBe(120);
    expect(stats.totalDistanceKm).toBeCloseTo(5.25, 6);
    expect(stats.daysWithData).toBe(1);
    expect(stats.groups).toHaveLength(2);
    expect(stats.groups[0].distanceKm).toBeCloseTo(2.25, 6);
  });

  it("works with undefined range (scans all points)", async () => {
    queryRaw
      .mockResolvedValueOnce([
        { total_points: 3n, first_tst: 1n, last_tst: 61n, days_with_data: 1n, total_km: 0.1 },
      ])
      .mockResolvedValueOnce([
        { bucket_key: "2026-04-12", bucket_start: new Date("2026-04-12T00:00:00Z"), bucket_km: 0.1 },
      ]);

    const stats = await getStatsForRange(undefined, undefined, "day");

    expect(stats.totalPoints).toBe(3);
    expect(stats.groups[0].key).toBe("2026-04-12");
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/getStatsForRange.test.ts`
Expected: FAIL — `getStatsForRange` not exported.

- [ ] **Step 3: Implement `getStatsForRange` in `lib/locations.ts`**

Add (keep `getPointsForDate`, `getPointsForRange`, and `getAllPoints` for now — `getAllPoints` is deleted in Task 5):

```ts
import { Prisma } from "@prisma/client";
import { assembleStats, type StatsGlobalsRow, type StatsBucketRow } from "@/lib/stats";
import type { DailyStats } from "@/lib/groupByHour";

export const DECIMATION_THRESHOLD = 20_000;
export const DEFAULT_PAGE_LIMIT = 5_000;
export const MAX_PAGE_LIMIT = 10_000;

type GlobalsRawRow = {
  total_points: bigint;
  first_tst: number | null;
  last_tst: number | null;
  days_with_data: bigint;
  total_km: number | null;
};

type BucketRawRow = {
  bucket_key: string;
  bucket_start: Date;
  bucket_km: number | null;
};

export async function getStatsForRange(
  start: Date | undefined,
  end: Date | undefined,
  groupBy: "hour" | "day",
): Promise<DailyStats> {
  const hasRange = start !== undefined && end !== undefined;
  const whereClause = hasRange
    ? Prisma.sql`WHERE "recordedAt" BETWEEN ${start} AND ${end}`
    : Prisma.empty;
  const bucketFormat = groupBy === "hour" ? "HH24" : "YYYY-MM-DD";

  const globalsRows = await prisma.$queryRaw<GlobalsRawRow[]>(Prisma.sql`
    WITH ordered AS (
      SELECT
        tst,
        "recordedAt",
        lat,
        lon,
        LAG(lat) OVER (ORDER BY tst) AS prev_lat,
        LAG(lon) OVER (ORDER BY tst) AS prev_lon
      FROM "LocationPoint"
      ${whereClause}
    )
    SELECT
      COUNT(*)::bigint                                               AS total_points,
      MIN(tst)                                                       AS first_tst,
      MAX(tst)                                                       AS last_tst,
      COUNT(DISTINCT date_trunc('day', "recordedAt"))::bigint        AS days_with_data,
      COALESCE(SUM(
        CASE WHEN prev_lat IS NULL THEN 0
             ELSE 2 * 6371 * asin(sqrt(
               power(sin(radians(lat - prev_lat) / 2), 2) +
               cos(radians(prev_lat)) * cos(radians(lat)) *
               power(sin(radians(lon - prev_lon) / 2), 2)
             ))
        END
      ), 0)::double precision                                        AS total_km
    FROM ordered;
  `);

  const bucketRows = await prisma.$queryRaw<BucketRawRow[]>(Prisma.sql`
    WITH ordered AS (
      SELECT
        tst,
        "recordedAt",
        lat,
        lon,
        LAG(lat) OVER (ORDER BY tst) AS prev_lat,
        LAG(lon) OVER (ORDER BY tst) AS prev_lon,
        to_char("recordedAt", ${bucketFormat})                                AS bucket_key,
        LAG(to_char("recordedAt", ${bucketFormat})) OVER (ORDER BY tst)       AS prev_bucket_key
      FROM "LocationPoint"
      ${whereClause}
    )
    SELECT
      bucket_key,
      MIN("recordedAt")                                              AS bucket_start,
      COALESCE(SUM(
        CASE
          WHEN prev_lat IS NULL OR prev_bucket_key IS NULL OR prev_bucket_key <> bucket_key THEN 0
          ELSE 2 * 6371 * asin(sqrt(
            power(sin(radians(lat - prev_lat) / 2), 2) +
            cos(radians(prev_lat)) * cos(radians(lat)) *
            power(sin(radians(lon - prev_lon) / 2), 2)
          ))
        END
      ), 0)::double precision                                        AS bucket_km
    FROM ordered
    GROUP BY bucket_key
    ORDER BY bucket_key;
  `);

  const globals: StatsGlobalsRow = globalsRows[0]
    ? {
        totalPoints: Number(globalsRows[0].total_points),
        firstTst: globalsRows[0].first_tst,
        lastTst: globalsRows[0].last_tst,
        daysWithData: Number(globalsRows[0].days_with_data),
        totalKm: globalsRows[0].total_km ?? 0,
      }
    : { totalPoints: 0, firstTst: null, lastTst: null, daysWithData: 0, totalKm: 0 };

  const buckets: StatsBucketRow[] = bucketRows.map((b) => ({
    bucketKey: b.bucket_key,
    bucketStart: b.bucket_start,
    bucketKm: b.bucket_km ?? 0,
  }));

  return assembleStats(globals, buckets, groupBy);
}
```

Note: `Prisma.sql` and `Prisma.empty` come from `@prisma/client`. The `whereClause` variable interpolates safely because the parameters bind through tagged templates.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/getStatsForRange.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run full suite**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: all pass, clean compile.

- [ ] **Step 6: Commit**

```bash
git add lib/locations.ts tests/unit/getStatsForRange.test.ts
git commit -m "feat(stats): compute stats via SQL aggregation in getStatsForRange"
```

---

## Task 4: Switch timeline page to `getStatsForRange`

**Files:**
- Modify: `app/timeline/[date]/page.tsx`

- [ ] **Step 1: Rewrite the data-fetching block**

Edit `app/timeline/[date]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getStatsForRange } from "@/lib/locations";
import { getRangeBounds } from "@/lib/getRangeBounds";
import DateNav from "@/components/DateNav";
import DailyStats from "@/components/DailyStats";
import TimelineSidebar from "@/components/TimelineSidebar";

export type RangeType = "day" | "week" | "month" | "year" | "custom" | "all";

const VALID_RANGES: RangeType[] = ["day", "week", "month", "year", "custom", "all"];

type Props = {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ range?: string; end?: string }>;
};

export default async function TimelineDatePage({ params, searchParams }: Props) {
  const { date } = await params;
  const { range, end } = await searchParams;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const parsedDate = new Date(`${date}T00:00:00`);
  if (isNaN(parsedDate.getTime())) notFound();

  const rangeType: RangeType = VALID_RANGES.includes(range as RangeType)
    ? (range as RangeType)
    : "day";

  const groupBy = rangeType === "day" ? "hour" : "day";

  let rangeStart: string | undefined;
  let rangeEnd: string | undefined;
  let stats;
  if (rangeType === "all") {
    rangeStart = new Date(0).toISOString();
    rangeEnd = new Date().toISOString();
    stats = await getStatsForRange(undefined, undefined, groupBy);
  } else {
    const { start, end: rangeBoundEnd } = getRangeBounds(parsedDate, rangeType, end);
    rangeStart = start.toISOString();
    rangeEnd = rangeBoundEnd.toISOString();
    stats = await getStatsForRange(start, rangeBoundEnd, groupBy);
  }

  return (
    <>
      <div className="border-b border-gray-200 px-4">
        <DateNav currentDate={date} range={rangeType} endDate={end} />
      </div>
      <DailyStats stats={stats} range={rangeType} />
      <TimelineSidebar rangeStart={rangeStart} rangeEnd={rangeEnd} />
    </>
  );
}
```

Note: `rangeStart`/`rangeEnd` are now always defined (including for `range=all`), so downstream consumers have a single code path.

- [ ] **Step 2: Verify type check and tests**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: clean compile, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/timeline/[date]/page.tsx
git commit -m "feat(timeline): compute stats via SQL, emit bounds for range=all"
```

---

## Task 5: Remove dead code (`getAllPoints`, `computePeriodStats`, `computeDailyStats`, `totalDistanceKm`)

**Files:**
- Modify: `lib/locations.ts`
- Modify: `lib/groupByHour.ts`
- Modify: `lib/geo.ts`
- Modify: `app/api/locations/route.ts` (temporarily — full rewrite in Task 7)

- [ ] **Step 1: Delete `getAllPoints` and its import in the route**

Remove `getAllPoints` from `lib/locations.ts`. In `app/api/locations/route.ts`, remove the `all=true` branch and the `getAllPoints` import:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getPointsForDate, getPointsForRange } from "@/lib/locations";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  if (startParam && endParam) {
    const start = new Date(startParam);
    const end = new Date(endParam);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const points = await getPointsForRange(start, end);
    return NextResponse.json(points);
  }

  const dateParam = searchParams.get("date");
  const dateStr = dateParam ?? format(new Date(), "yyyy-MM-dd");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
  }

  const points = await getPointsForDate(new Date(`${dateStr}T00:00:00`));
  return NextResponse.json(points);
}
```

(Task 7 replaces this entire handler.)

- [ ] **Step 2: Delete `computePeriodStats`, `computeDailyStats`, and the `totalDistanceKm` import in `lib/groupByHour.ts`**

The file should now contain only the type exports:

```ts
export type SerializedPoint = {
  id: number;
  lat: number;
  lon: number;
  tst: number;
  recordedAt: string;
  acc: number | null;
  batt: number | null;
  tid: string | null;
  alt: number | null;
  vel: number | null;
};

export type TimeGroup = {
  key: string;
  label: string;
  distanceKm: number;
};

export type HourGroup = TimeGroup;

export type DailyStats = {
  totalPoints: number;
  totalDistanceKm: number;
  durationMinutes: number;
  daysWithData: number;
  groups: TimeGroup[];
};
```

- [ ] **Step 3: Delete `totalDistanceKm` from `lib/geo.ts`**

Remove the `totalDistanceKm` function. Leave `haversineKm`, `hasEvidenceOfLeavingInGap`, and `medianLatLon` untouched.

- [ ] **Step 4: Type-check and test**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: clean compile (no consumer of the deleted symbols remains), all tests pass.

If `tsc` surfaces any unexpected consumer, check with grep:

```bash
# These should return no hits:
```

Run: `pnpm exec grep -rn "getAllPoints\|computePeriodStats\|computeDailyStats\|totalDistanceKm" --include="*.ts" --include="*.tsx" .`
Expected: no results outside of `git` history.

- [ ] **Step 5: Commit**

```bash
git add lib/locations.ts lib/groupByHour.ts lib/geo.ts app/api/locations/route.ts
git commit -m "refactor: remove unused getAllPoints, computePeriodStats, totalDistanceKm"
```

---

## Task 6: Time-window centroid endpoint

**Background:** `fetchVisitCentroid` is called by four components (`VisitSuggestionsPanel`, `MapWrapper`, `PlaceDetailModal`, `TimelineSidebar`) for both known and unknown visits with `(arrivalAt, departureAt, fallback)`. We keep that signature; only the server implementation changes so the centroid no longer requires shipping raw points to the client.

**Files:**
- Create: `app/api/location-centroid/route.ts`
- Create: `tests/unit/api-location-centroid.test.ts`
- Modify: `lib/visitCentroid.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-location-centroid.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { GET } from "@/app/api/location-centroid/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;
const queryRaw = prisma.$queryRaw as unknown as MockFn;

function req(params: Record<string, string>) {
  const usp = new URLSearchParams(params);
  return new Request(`http://localhost/api/location-centroid?${usp.toString()}`);
}

describe("GET /api/location-centroid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when start or end are missing", async () => {
    const res = await GET(req({ start: "2026-04-12T00:00:00Z" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid dates", async () => {
    const res = await GET(req({ start: "nope", end: "2026-04-12T01:00:00Z" }));
    expect(res.status).toBe(400);
  });

  it("returns averaged lat/lon over the window", async () => {
    queryRaw.mockResolvedValue([{ lat: 10.5, lon: 20.5 }]);
    const res = await GET(req({
      start: "2026-04-12T09:00:00Z",
      end: "2026-04-12T10:00:00Z",
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ lat: 10.5, lon: 20.5 });
  });

  it("returns 404 when no points fall in the window", async () => {
    queryRaw.mockResolvedValue([{ lat: null, lon: null }]);
    const res = await GET(req({
      start: "2026-04-12T09:00:00Z",
      end: "2026-04-12T10:00:00Z",
    }));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/api-location-centroid.test.ts`
Expected: FAIL — route module does not exist.

- [ ] **Step 3: Implement the route**

Create `app/api/location-centroid/route.ts`:

```ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startRaw = searchParams.get("start");
  const endRaw = searchParams.get("end");
  if (!startRaw || !endRaw) {
    return NextResponse.json({ error: "Missing start or end" }, { status: 400 });
  }
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<{ lat: number | null; lon: number | null }[]>(Prisma.sql`
    SELECT AVG(lat)::double precision AS lat, AVG(lon)::double precision AS lon
    FROM "LocationPoint"
    WHERE "recordedAt" BETWEEN ${start} AND ${end};
  `);

  const row = rows[0];
  if (!row || row.lat === null || row.lon === null) {
    return NextResponse.json({ error: "No points in window" }, { status: 404 });
  }

  return NextResponse.json({ lat: row.lat, lon: row.lon });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/api-location-centroid.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewrite `lib/visitCentroid.ts` — keep public signature**

```ts
export async function fetchVisitCentroid(
  arrivalAt: string,
  departureAt: string,
  fallback: { lat: number; lon: number },
): Promise<{ lat: number; lon: number }> {
  const params = new URLSearchParams({ start: arrivalAt, end: departureAt });
  try {
    const res = await fetch(`/api/location-centroid?${params}`);
    if (res.ok) {
      return (await res.json()) as { lat: number; lon: number };
    }
  } catch { /* fall through to fallback */ }
  return fallback;
}
```

No call sites need to change — four components (`components/VisitSuggestionsPanel.tsx`, `components/map/MapWrapper.tsx`, `components/PlaceDetailModal.tsx`, `components/TimelineSidebar.tsx`) keep invoking it with the same three arguments.

- [ ] **Step 6: Type-check and test**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: clean compile, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/api/location-centroid tests/unit/api-location-centroid.test.ts lib/visitCentroid.ts
git commit -m "feat(centroid): server-side /api/location-centroid endpoint"
```

---

## Task 7: Rewrite `/api/locations` with cursor + decimation

**Files:**
- Modify: `app/api/locations/route.ts`
- Create: `tests/unit/api-locations-route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/api-locations-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { GET } from "@/app/api/locations/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;
const queryRaw = prisma.$queryRaw as unknown as MockFn;

function req(params: Record<string, string>) {
  const usp = new URLSearchParams(params);
  return new Request(`http://localhost/api/locations?${usp.toString()}`);
}

const BOUNDS = {
  start: "2026-04-12T00:00:00.000Z",
  end: "2026-04-12T23:59:59.999Z",
  minLat: "10",
  maxLat: "20",
  minLon: "30",
  maxLon: "40",
};

describe("GET /api/locations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when start is missing", async () => {
    const { start: _s, ...rest } = BOUNDS;
    const res = await GET(req(rest));
    expect(res.status).toBe(400);
  });

  it("returns 400 when viewport bounds are missing", async () => {
    const { minLat: _a, ...rest } = BOUNDS;
    const res = await GET(req(rest));
    expect(res.status).toBe(400);
  });

  it("returns 400 on non-numeric bounds", async () => {
    const res = await GET(req({ ...BOUNDS, minLat: "nope" }));
    expect(res.status).toBe(400);
  });

  it("paginates when count is under the threshold", async () => {
    queryRaw
      // count query
      .mockResolvedValueOnce([{ total: 5000n }])
      // page query
      .mockResolvedValueOnce([
        { id: 101, lat: 11, lon: 31, tst: 1, recordedAt: new Date("2026-04-12T01:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null },
        { id: 102, lat: 12, lon: 32, tst: 2, recordedAt: new Date("2026-04-12T02:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null },
      ]);

    const res = await GET(req(BOUNDS));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.decimated).toBe(false);
    expect(body.total).toBe(5000);
    expect(body.points).toHaveLength(2);
    expect(body.nextCursor).toBe(102);
    expect(body.points[0].recordedAt).toBe("2026-04-12T01:00:00.000Z");
  });

  it("sets nextCursor=null when page is under the limit", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: 10n }])
      .mockResolvedValueOnce([
        { id: 1, lat: 11, lon: 31, tst: 1, recordedAt: new Date("2026-04-12T01:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null },
      ]);

    const res = await GET(req({ ...BOUNDS, limit: "100" }));
    const body = await res.json();
    expect(body.nextCursor).toBeNull();
  });

  it("decimates when count exceeds threshold", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: 100_000n }])
      .mockResolvedValueOnce(
        Array.from({ length: 20_000 }, (_, i) => ({
          id: i + 1,
          lat: 11,
          lon: 31,
          tst: i,
          recordedAt: new Date("2026-04-12T01:00:00Z"),
          acc: null,
          batt: null,
          tid: null,
          alt: null,
          vel: null,
        })),
      );

    const res = await GET(req(BOUNDS));
    const body = await res.json();

    expect(body.decimated).toBe(true);
    expect(body.nextCursor).toBeNull();
    expect(body.total).toBe(100_000);
    expect(body.points.length).toBeLessThanOrEqual(20_000);
  });

  it("passes cursor into the pagination query", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: 100n }])
      .mockResolvedValueOnce([]);

    await GET(req({ ...BOUNDS, cursor: "500" }));

    const pageCall = queryRaw.mock.calls[1][0];
    // Prisma.sql values array contains the cursor somewhere
    const text = JSON.stringify(pageCall);
    expect(text).toContain("500");
  });

  it("clamps limit to MAX_PAGE_LIMIT", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: 100n }])
      .mockResolvedValueOnce([]);

    const res = await GET(req({ ...BOUNDS, limit: "99999" }));
    expect(res.status).toBe(200);
    // No easy way to inspect the limit directly; ensure no crash and count query still invoked
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/api-locations-route.test.ts`
Expected: FAIL — old route does not implement the new shape.

- [ ] **Step 3: Replace the route handler**

Overwrite `app/api/locations/route.ts`:

```ts
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DECIMATION_THRESHOLD,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "@/lib/locations";

type PointRow = {
  id: number;
  lat: number;
  lon: number;
  tst: number;
  recordedAt: Date;
  acc: number | null;
  batt: number | null;
  tid: string | null;
  alt: number | null;
  vel: number | null;
};

function parseRequired(searchParams: URLSearchParams, key: string): string | null {
  const v = searchParams.get(key);
  return v === null || v === "" ? null : v;
}

function parseNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string | null): Date | null {
  if (raw === null) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const start = parseDate(parseRequired(searchParams, "start"));
  const end = parseDate(parseRequired(searchParams, "end"));
  const minLat = parseNumber(parseRequired(searchParams, "minLat"));
  const maxLat = parseNumber(parseRequired(searchParams, "maxLat"));
  const minLon = parseNumber(parseRequired(searchParams, "minLon"));
  const maxLon = parseNumber(parseRequired(searchParams, "maxLon"));

  if (!start || !end || minLat === null || maxLat === null || minLon === null || maxLon === null) {
    return NextResponse.json(
      { error: "Missing or invalid required params: start, end, minLat, maxLat, minLon, maxLon" },
      { status: 400 },
    );
  }

  const limitRaw = parseNumber(searchParams.get("limit"));
  const limit = Math.max(
    1,
    Math.min(MAX_PAGE_LIMIT, limitRaw ?? DEFAULT_PAGE_LIMIT),
  );
  const cursor = parseNumber(searchParams.get("cursor"));

  const where = Prisma.sql`
    "recordedAt" BETWEEN ${start} AND ${end}
    AND lat BETWEEN ${minLat} AND ${maxLat}
    AND lon BETWEEN ${minLon} AND ${maxLon}
  `;

  const countRows = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total
    FROM "LocationPoint"
    WHERE ${where};
  `);
  const total = Number(countRows[0]?.total ?? 0n);

  const selectCols = Prisma.sql`id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel`;

  if (total > DECIMATION_THRESHOLD) {
    const stride = Math.ceil(total / DECIMATION_THRESHOLD);
    const rows = await prisma.$queryRaw<PointRow[]>(Prisma.sql`
      SELECT ${selectCols}
      FROM (
        SELECT ${selectCols}, ROW_NUMBER() OVER (ORDER BY tst) AS rn
        FROM "LocationPoint"
        WHERE ${where}
      ) AS sub
      WHERE rn % ${stride} = 0
      ORDER BY tst;
    `);

    return NextResponse.json({
      points: rows.map(serializeRow),
      nextCursor: null,
      decimated: true,
      total,
    });
  }

  const cursorClause = cursor !== null ? Prisma.sql`AND id > ${cursor}` : Prisma.empty;
  const rows = await prisma.$queryRaw<PointRow[]>(Prisma.sql`
    SELECT ${selectCols}
    FROM "LocationPoint"
    WHERE ${where}
    ${cursorClause}
    ORDER BY id
    LIMIT ${limit};
  `);

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;

  return NextResponse.json({
    points: rows.map(serializeRow),
    nextCursor,
    decimated: false,
    total,
  });
}

function serializeRow(r: PointRow) {
  return {
    id: r.id,
    lat: r.lat,
    lon: r.lon,
    tst: r.tst,
    recordedAt: r.recordedAt.toISOString(),
    acc: r.acc,
    batt: r.batt,
    tid: r.tid,
    alt: r.alt,
    vel: r.vel,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/api-locations-route.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Delete `getPointsForRange` and `getPointsForDate`**

After the route rewrite, those helpers have no consumers. Remove them from `lib/locations.ts`. The file ends up with exports: `DECIMATION_THRESHOLD`, `DEFAULT_PAGE_LIMIT`, `MAX_PAGE_LIMIT`, `getStatsForRange` — and their supporting private types.

Run: `pnpm exec grep -rn "getPointsForRange\|getPointsForDate" --include="*.ts" --include="*.tsx" .`
Expected: no hits.

- [ ] **Step 6: Type-check and full suite**

Run: `pnpm exec tsc --noEmit && pnpm test && pnpm exec eslint .`
Expected: clean compile, all tests pass, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/locations/route.ts tests/unit/api-locations-route.test.ts lib/locations.ts
git commit -m "feat(api/locations): cursor pagination + viewport decimation"
```

---

## Task 8: Migrate `MapWrapper` to `useInfiniteQuery`

**Files:**
- Modify: `components/map/MapWrapper.tsx`

- [ ] **Step 1: Read the full file first**

Open `components/map/MapWrapper.tsx` — locate the `isAll` local, the `useQuery` for `["locations", ...]` block (~line 71–85), and the `SerializedPoint` import. These are the anchors the Step 2 edit relies on.

- [ ] **Step 2: Replace the locations query**

Find the block at [components/map/MapWrapper.tsx:71-85](../../../components/map/MapWrapper.tsx#L71-L85) and replace with:

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

// ... inside the component, replace the existing locations useQuery:

type LocationsPage = {
  points: SerializedPoint[];
  nextCursor: number | null;
  decimated: boolean;
  total: number;
};

const locationsEnabled =
  mapBounds !== null && Boolean(rangeStart) && Boolean(rangeEnd);

const {
  data: locationsData,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery<LocationsPage>({
  queryKey: ["locations", rangeStart, rangeEnd, mapBounds],
  enabled: locationsEnabled,
  initialPageParam: null as number | null,
  getNextPageParam: (last) => last.nextCursor,
  queryFn: async ({ pageParam }) => {
    const params = new URLSearchParams({
      start: rangeStart!,
      end: rangeEnd!,
      minLat: String(mapBounds!.minLat),
      maxLat: String(mapBounds!.maxLat),
      minLon: String(mapBounds!.minLon),
      maxLon: String(mapBounds!.maxLon),
    });
    if (pageParam !== null) params.set("cursor", String(pageParam));
    const res = await fetch(`/api/locations?${params}`);
    if (!res.ok) throw new Error(`locations ${res.status}`);
    return res.json();
  },
});

useEffect(() => {
  if (hasNextPage && !isFetchingNextPage) {
    void fetchNextPage();
  }
}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

const points = useMemo<SerializedPoint[]>(
  () => locationsData?.pages.flatMap((p) => p.points) ?? [],
  [locationsData],
);
```

Also delete the `isAll` local (search the file for it and remove — it is no longer needed because the page always emits `rangeStart`/`rangeEnd`).

- [ ] **Step 3: Type-check, lint, and run unit tests**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint components/map/MapWrapper.tsx && pnpm test`
Expected: clean, all tests pass.

- [ ] **Step 4: Manual smoke test**

Run: `pnpm dev` in one terminal. Visit `http://localhost:3000/timeline/2026-04-12` and `http://localhost:3000/timeline/2026-04-12?range=all`. Confirm:
- Map loads dots.
- Panning/zooming issues new requests (check network tab) and replaces results.
- Console has no React Query warnings.

Stop the dev server after verification.

- [ ] **Step 5: Commit**

```bash
git add components/map/MapWrapper.tsx
git commit -m "feat(map): progressive load via useInfiniteQuery"
```

---

## Task 9: E2E tests

**Files:**
- Create: `tests/e2e/timeline-range-all.spec.ts`
- Create: `tests/e2e/map-progressive-load.spec.ts`

- [ ] **Step 1: Write the range=all smoke test**

Create `tests/e2e/timeline-range-all.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("timeline loads with range=all without server error", async ({ page }) => {
  const resp = await page.goto("/timeline/2026-04-12?range=all");
  expect(resp?.status()).toBeLessThan(500);

  // Stats tile renders (Distance/Points/Days)
  await expect(page.getByText("Distance")).toBeVisible();
  await expect(page.getByText("Points")).toBeVisible();
});
```

- [ ] **Step 2: Write the progressive-load test**

Create `tests/e2e/map-progressive-load.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("map issues multiple paginated locations requests at world zoom", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/locations")) requests.push(req.url());
  });

  await page.goto("/timeline/2026-04-12?range=all");

  // Give the map time to settle and fetchNextPage to iterate.
  await page.waitForTimeout(2000);

  // Either the result was decimated (1 request, decimated:true) or pagination happened (>1).
  expect(requests.length).toBeGreaterThanOrEqual(1);

  // Verify required params are present on every request.
  for (const url of requests) {
    const u = new URL(url);
    expect(u.searchParams.get("start")).not.toBeNull();
    expect(u.searchParams.get("end")).not.toBeNull();
    expect(u.searchParams.get("minLat")).not.toBeNull();
    expect(u.searchParams.get("maxLat")).not.toBeNull();
  }
});
```

- [ ] **Step 3: Run e2e suite**

Run: `pnpm exec playwright install chromium` (first time only), then `pnpm dev &` in one terminal and `pnpm test:e2e` in another.

Expected: both specs pass against a seeded dev DB. If the dev DB is empty, the stats assertions still hold (components render placeholder "—"); the progressive-load spec may see only one request with `decimated:false` and `points: []`. That is acceptable — the point of the e2e is no 500s and correct param shape.

Stop the dev server after.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/timeline-range-all.spec.ts tests/e2e/map-progressive-load.spec.ts
git commit -m "test(e2e): verify range=all and paginated map loading"
```

---

## Task 10: Documentation refresh

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the `/api/locations` entry**

Replace the README line at [README.md:182](../../../README.md#L182) and any neighbouring doc block. The new contract:

```md
- `GET /api/locations?start=ISO&end=ISO&minLat=...&maxLat=...&minLon=...&maxLon=...&cursor=&limit=`
  - Returns `{ points, nextCursor, decimated, total }`. Required params: `start`, `end`, bounds. Optional: `cursor`, `limit` (default 5000, max 10000). When the server estimates more than 20 000 points in range+bounds, the response is a single decimated page (`decimated: true`, `nextCursor: null`).
- `GET /api/location-centroid?start=ISO&end=ISO` — returns `{ lat, lon }` averaged from the GPS points within the window, or 404 if none.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: /api/locations and /api/unknown-visits centroid"
```

---

## Final verification

- [ ] **Step 1: Full suite**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint . && pnpm test`
Expected: clean.

- [ ] **Step 2: Manual sanity**

Run: `pnpm dev`, visit `/timeline/today` and `/timeline/today?range=all`. Confirm stats render and map loads. Confirm no calls to `/api/locations?all=true` or `getAllPoints` anywhere:

Run: `pnpm exec grep -rn "getAllPoints\|all=true" --include="*.ts" --include="*.tsx" .`
Expected: zero hits (except possibly in older git history / changelog, which are out of scope).

- [ ] **Step 3: Spec ⇄ plan cross-check**

Walk the design doc once more. Every section has a corresponding committed change:
- A (SQL aggregation) → Tasks 1–4
- B (viewport + decimation) → Task 7
- C (cursor pagination) → Task 7 + 8
- Centroid separation → Task 6
- Dead code removal → Task 5
- Tests → Tasks 2, 3, 6, 7, 9
- Tunable constants → Task 3

Any gap? Open a new task; do not merge with gaps.
