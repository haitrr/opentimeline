# Multi-Device Conflict Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create device filters (fromTime + toTime + deviceIds) that persist in the DB and are applied server-side to location queries, with frontend conflict detection to surface when filters are needed.

**Architecture:** A new `DeviceFilter` Prisma model stores filter rules. The `/api/locations` route loads all filters and post-processes returned points. Frontend detects conflicts (two devices far apart in the same time bucket) and exposes them in a new "Devices" sidebar tab via a shared React context.

**Tech Stack:** Prisma + PostgreSQL, Next.js App Router, React Query, Tailwind CSS, Vitest, Playwright

---

## File Map

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` |
| Create | `app/api/device-filters/route.ts` |
| Create | `app/api/device-filters/[id]/route.ts` |
| Modify | `lib/groupByHour.ts` — add `deviceId` to `SerializedPoint` |
| Create | `lib/device-filters.ts` — `applyDeviceFilters`, serialized type |
| Create | `lib/conflict-detection.ts` — pure `detectConflicts` function |
| Modify | `app/api/locations/route.ts` — add `deviceId` to response + apply filters |
| Create | `components/DeviceFilterProvider.tsx` — context + `useDeviceFilters` hook |
| Create | `components/ConflictResolutionDialog.tsx` — modal for creating a filter |
| Create | `components/ConflictsPanel.tsx` — sidebar panel |
| Modify | `app/timeline/layout.tsx` — add Devices tab + wrap in provider |
| Modify | `components/map/MapWrapper.tsx` — run conflict detection + map badge |
| Create | `tests/unit/apply-device-filters.test.ts` |
| Create | `tests/unit/conflict-detection.test.ts` |
| Create | `tests/unit/device-filters-api.test.ts` |

---

## Task 1: Add DeviceFilter model to schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add DeviceFilter model**

Open `prisma/schema.prisma` and append after the `AppSettings` model:

```prisma
model DeviceFilter {
  id        String   @id @default(cuid())
  fromTime  DateTime
  toTime    DateTime
  deviceIds String[]
  label     String?
  createdAt DateTime @default(now())

  @@index([fromTime, toTime])
}
```

- [ ] **Step 2: Run migration**

```bash
pnpm prisma migrate dev --name add-device-filter
```

Expected: migration file created in `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add DeviceFilter model"
```

---

## Task 2: Device filters API — GET and POST

**Files:**
- Create: `app/api/device-filters/route.ts`
- Create: `tests/unit/device-filters-api.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/device-filters-api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    deviceFilter: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { GET, POST } from "@/app/api/device-filters/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;
const findMany = prisma.deviceFilter.findMany as unknown as MockFn;
const create = prisma.deviceFilter.create as unknown as MockFn;

const FILTER_RECORD = {
  id: "clxxx",
  fromTime: new Date("2026-04-01T08:00:00Z"),
  toTime: new Date("2026-04-01T18:00:00Z"),
  deviceIds: ["phone"],
  label: "Left tablet at home",
  createdAt: new Date("2026-04-19T10:00:00Z"),
};

describe("GET /api/device-filters", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when no filters", async () => {
    findMany.mockResolvedValueOnce([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("serializes filter records to ISO strings", async () => {
    findMany.mockResolvedValueOnce([FILTER_RECORD]);
    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].fromTime).toBe("2026-04-01T08:00:00.000Z");
    expect(body[0].deviceIds).toEqual(["phone"]);
    expect(body[0].label).toBe("Left tablet at home");
  });
});

describe("POST /api/device-filters", () => {
  beforeEach(() => vi.clearAllMocks());

  function req(body: unknown) {
    return new Request("http://localhost/api/device-filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 when deviceIds missing", async () => {
    const res = await POST(req({ fromTime: "2026-04-01T08:00:00Z", toTime: "2026-04-01T18:00:00Z" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when deviceIds is empty", async () => {
    const res = await POST(req({ fromTime: "2026-04-01T08:00:00Z", toTime: "2026-04-01T18:00:00Z", deviceIds: [] }));
    expect(res.status).toBe(400);
  });

  it("creates and returns filter with 201", async () => {
    create.mockResolvedValueOnce(FILTER_RECORD);
    const res = await POST(req({ fromTime: "2026-04-01T08:00:00Z", toTime: "2026-04-01T18:00:00Z", deviceIds: ["phone"], label: "Left tablet at home" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("clxxx");
    expect(body.deviceIds).toEqual(["phone"]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test tests/unit/device-filters-api.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement route**

Create `app/api/device-filters/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const filters = await prisma.deviceFilter.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    filters.map((f) => ({
      id: f.id,
      fromTime: f.fromTime.toISOString(),
      toTime: f.toTime.toISOString(),
      deviceIds: f.deviceIds,
      label: f.label,
      createdAt: f.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const { fromTime, toTime, deviceIds, label } = body;

  if (!fromTime || !toTime || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return NextResponse.json(
      { error: "fromTime, toTime, and deviceIds are required" },
      { status: 400 }
    );
  }

  const from = new Date(fromTime);
  const to = new Date(toTime);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  const filter = await prisma.deviceFilter.create({
    data: { fromTime: from, toTime: to, deviceIds, label: label ?? null },
  });

  return NextResponse.json(
    {
      id: filter.id,
      fromTime: filter.fromTime.toISOString(),
      toTime: filter.toTime.toISOString(),
      deviceIds: filter.deviceIds,
      label: filter.label,
      createdAt: filter.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test tests/unit/device-filters-api.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/device-filters/route.ts tests/unit/device-filters-api.test.ts
git commit -m "feat: add GET/POST /api/device-filters"
```

---

## Task 3: Device filters API — DELETE

**Files:**
- Create: `app/api/device-filters/[id]/route.ts`
- Modify: `tests/unit/device-filters-api.test.ts`

- [ ] **Step 1: Add failing DELETE test**

Append to `tests/unit/device-filters-api.test.ts` (after the POST describe block):

```typescript
import { DELETE } from "@/app/api/device-filters/[id]/route";

const deleteFilter = prisma.deviceFilter.delete as unknown as MockFn;

describe("DELETE /api/device-filters/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 on success", async () => {
    deleteFilter.mockResolvedValueOnce(FILTER_RECORD);
    const res = await DELETE(new Request("http://localhost/"), {
      params: Promise.resolve({ id: "clxxx" }),
    });
    expect(res.status).toBe(204);
  });

  it("returns 404 when filter not found", async () => {
    deleteFilter.mockRejectedValueOnce(new Error("not found"));
    const res = await DELETE(new Request("http://localhost/"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });
});
```

Also add `deleteFilter` to the top-level `vi.mock` imports (it's already in the mock object, just add to the destructure).

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test tests/unit/device-filters-api.test.ts
```

Expected: FAIL — DELETE module not found.

- [ ] **Step 3: Implement DELETE route**

Create `app/api/device-filters/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.deviceFilter.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test tests/unit/device-filters-api.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/device-filters/[id]/route.ts tests/unit/device-filters-api.test.ts
git commit -m "feat: add DELETE /api/device-filters/[id]"
```

---

## Task 4: Add deviceId to SerializedPoint and apply filters in locations API

**Files:**
- Modify: `lib/groupByHour.ts`
- Create: `lib/device-filters.ts`
- Modify: `app/api/locations/route.ts`
- Create: `tests/unit/apply-device-filters.test.ts`

- [ ] **Step 1: Write failing filter tests**

Create `tests/unit/apply-device-filters.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { applyDeviceFilters } from "@/lib/device-filters";
import type { SerializedPoint } from "@/lib/groupByHour";

function pt(overrides: { deviceId?: string | null; recordedAt: string }): SerializedPoint {
  return { id: 1, lat: 10, lon: 10, tst: 0, acc: null, batt: null, tid: null, alt: null, vel: null, deviceId: null, ...overrides };
}

const FILTER = {
  id: "f1",
  fromTime: new Date("2026-04-01T08:00:00Z"),
  toTime: new Date("2026-04-01T18:00:00Z"),
  deviceIds: ["phone"],
  label: null as string | null,
  createdAt: new Date(),
};

describe("applyDeviceFilters", () => {
  it("returns all points when no filters", () => {
    expect(applyDeviceFilters([pt({ recordedAt: "2026-04-01T10:00:00Z", deviceId: "phone" })], [])).toHaveLength(1);
  });

  it("keeps point from allowed device in filter range", () => {
    expect(applyDeviceFilters([pt({ recordedAt: "2026-04-01T10:00:00Z", deviceId: "phone" })], [FILTER])).toHaveLength(1);
  });

  it("removes point from excluded device in filter range", () => {
    expect(applyDeviceFilters([pt({ recordedAt: "2026-04-01T10:00:00Z", deviceId: "tablet" })], [FILTER])).toHaveLength(0);
  });

  it("removes point with null deviceId in filter range", () => {
    expect(applyDeviceFilters([pt({ recordedAt: "2026-04-01T10:00:00Z", deviceId: null })], [FILTER])).toHaveLength(0);
  });

  it("keeps all points outside filter range regardless of device", () => {
    expect(applyDeviceFilters([pt({ recordedAt: "2026-04-01T20:00:00Z", deviceId: "tablet" })], [FILTER])).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test tests/unit/apply-device-filters.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Add deviceId to SerializedPoint**

In `lib/groupByHour.ts`, change the `SerializedPoint` type:

```typescript
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
  deviceId: string | null;
};
```

- [ ] **Step 4: Create lib/device-filters.ts**

```typescript
import type { SerializedPoint } from "@/lib/groupByHour";

export type DeviceFilterRecord = {
  id: string;
  fromTime: Date;
  toTime: Date;
  deviceIds: string[];
  label: string | null;
  createdAt: Date;
};

export function applyDeviceFilters(
  points: SerializedPoint[],
  filters: DeviceFilterRecord[]
): SerializedPoint[] {
  if (filters.length === 0) return points;
  return points.filter((point) => {
    const t = new Date(point.recordedAt).getTime();
    for (const filter of filters) {
      if (t >= filter.fromTime.getTime() && t <= filter.toTime.getTime()) {
        return point.deviceId !== null && filter.deviceIds.includes(point.deviceId);
      }
    }
    return true;
  });
}
```

- [ ] **Step 5: Run filter tests — expect PASS**

```bash
pnpm test tests/unit/apply-device-filters.test.ts
```

Expected: all PASS.

- [ ] **Step 6: Add deviceId to locations route**

In `app/api/locations/route.ts`, make these changes:

**Add `deviceId` to `PointRow` type** (line 6–17):
```typescript
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
  deviceId: string | null;
};
```

**Change `selectCols`** (line 59):
```typescript
const selectCols = Prisma.sql`id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel, "deviceId"`;
```

Also update the inline SELECT in the distance-bucket CTE (lines 137–138 and 148–149). Find all occurrences of:
```
SELECT id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel,
```
and add `"deviceId"` at the end of each field list:
```
SELECT id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel, "deviceId",
```

**Update `serializeRow`** (line 183–196):
```typescript
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
    deviceId: r.deviceId,
  };
}
```

**Add filter application at the start of the GET handler** — add these imports at the top of the file:
```typescript
import { applyDeviceFilters } from "@/lib/device-filters";
```

Then in each place where the route calls `return NextResponse.json({ points: rows.map(serializeRow), ... })`, add a filter step. There are 4 return points (lines 79, 127, 160, 175). For all four, change:

```typescript
// BEFORE
points: rows.map(serializeRow),

// AFTER (add at top of GET handler, before the first if block)
const deviceFilters = await prisma.deviceFilter.findMany();

// then at every return:
points: applyDeviceFilters(rows.map(serializeRow), deviceFilters),
```

To avoid repeating the `findMany`, move it to be the first line inside `GET()`:

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // ... param parsing unchanged ...

  const deviceFilters = await prisma.deviceFilter.findMany();

  // ... rest of function unchanged, but every `rows.map(serializeRow)` becomes:
  // applyDeviceFilters(rows.map(serializeRow), deviceFilters)
}
```

- [ ] **Step 7: Run existing locations tests**

```bash
pnpm test tests/unit/api-locations-route.test.ts
```

Expected: existing tests PASS (they don't test deviceId yet — that's fine).

- [ ] **Step 8: Commit**

```bash
git add lib/groupByHour.ts lib/device-filters.ts app/api/locations/route.ts tests/unit/apply-device-filters.test.ts
git commit -m "feat: add deviceId to locations response and apply device filters"
```

---

## Task 5: Conflict detection pure function

**Files:**
- Create: `lib/conflict-detection.ts`
- Create: `tests/unit/conflict-detection.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/conflict-detection.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { detectConflicts } from "@/lib/conflict-detection";
import type { SerializedPoint } from "@/lib/groupByHour";

function pt(overrides: { deviceId?: string | null; lat: number; lon: number; recordedAt: string }): SerializedPoint {
  return { id: 1, tst: 0, acc: null, batt: null, tid: null, alt: null, vel: null, deviceId: null, ...overrides };
}

describe("detectConflicts", () => {
  it("returns empty array for no points", () => {
    expect(detectConflicts([])).toEqual([]);
  });

  it("returns empty for only one device", () => {
    const points = [
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: "2026-04-01T08:00:00Z" }),
      pt({ deviceId: "phone", lat: 10.001, lon: 10.001, recordedAt: "2026-04-01T08:02:00Z" }),
    ];
    expect(detectConflicts(points)).toEqual([]);
  });

  it("returns empty when two devices are in the same location", () => {
    const points = [
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: "2026-04-01T08:00:00Z" }),
      pt({ deviceId: "tablet", lat: 10.001, lon: 10.001, recordedAt: "2026-04-01T08:01:00Z" }),
    ];
    // ~150m apart — under 200m threshold
    expect(detectConflicts(points)).toEqual([]);
  });

  it("detects conflict when devices are far apart in the same bucket", () => {
    const points = [
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: "2026-04-01T08:00:00Z" }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: "2026-04-01T08:01:00Z" }),
    ];
    // ~150km apart
    const conflicts = detectConflicts(points);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].deviceIds).toContain("phone");
    expect(conflicts[0].deviceIds).toContain("tablet");
  });

  it("merges adjacent conflict buckets into one range", () => {
    const base = new Date("2026-04-01T08:00:00Z").getTime();
    const bucket = 5 * 60 * 1000;
    const points = [
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: new Date(base).toISOString() }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: new Date(base + 1000).toISOString() }),
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: new Date(base + bucket).toISOString() }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: new Date(base + bucket + 1000).toISOString() }),
    ];
    expect(detectConflicts(points)).toHaveLength(1);
  });

  it("returns separate ranges for non-adjacent conflict buckets", () => {
    const base = new Date("2026-04-01T08:00:00Z").getTime();
    const bucket = 5 * 60 * 1000;
    const points = [
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: new Date(base).toISOString() }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: new Date(base + 1000).toISOString() }),
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: new Date(base + bucket * 3).toISOString() }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: new Date(base + bucket * 3 + 1000).toISOString() }),
    ];
    expect(detectConflicts(points)).toHaveLength(2);
  });

  it("ignores points with null deviceId", () => {
    const points = [
      pt({ deviceId: null, lat: 10, lon: 10, recordedAt: "2026-04-01T08:00:00Z" }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: "2026-04-01T08:01:00Z" }),
    ];
    expect(detectConflicts(points)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test tests/unit/conflict-detection.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement detectConflicts**

Create `lib/conflict-detection.ts`:

```typescript
import type { SerializedPoint } from "@/lib/groupByHour";

export type ConflictRange = {
  fromTime: Date;
  toTime: Date;
  deviceIds: string[];
};

const EARTH_RADIUS_M = 6371000;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function medianPosition(points: SerializedPoint[]): { lat: number; lon: number } {
  const lats = [...points.map((p) => p.lat)].sort((a, b) => a - b);
  const lons = [...points.map((p) => p.lon)].sort((a, b) => a - b);
  const mid = Math.floor(lats.length / 2);
  return { lat: lats[mid], lon: lons[mid] };
}

export function detectConflicts(
  points: SerializedPoint[],
  bucketMinutes = 5,
  distanceThresholdMeters = 200
): ConflictRange[] {
  const devicePoints = points.filter((p) => p.deviceId !== null);
  if (devicePoints.length === 0) return [];

  const devices = [...new Set(devicePoints.map((p) => p.deviceId as string))];
  if (devices.length < 2) return [];

  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets = new Map<number, Map<string, SerializedPoint[]>>();

  for (const point of devicePoints) {
    const t = new Date(point.recordedAt).getTime();
    const bucket = Math.floor(t / bucketMs);
    if (!buckets.has(bucket)) buckets.set(bucket, new Map());
    const deviceMap = buckets.get(bucket)!;
    if (!deviceMap.has(point.deviceId!)) deviceMap.set(point.deviceId!, []);
    deviceMap.get(point.deviceId!)!.push(point);
  }

  const conflictBuckets: number[] = [];
  const conflictDevicesMap = new Map<number, string[]>();

  for (const [bucket, deviceMap] of buckets) {
    if (deviceMap.size < 2) continue;
    const entries = [...deviceMap.entries()];
    const involved: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const pos1 = medianPosition(entries[i][1]);
        const pos2 = medianPosition(entries[j][1]);
        if (haversineMeters(pos1.lat, pos1.lon, pos2.lat, pos2.lon) > distanceThresholdMeters) {
          if (!involved.includes(entries[i][0])) involved.push(entries[i][0]);
          if (!involved.includes(entries[j][0])) involved.push(entries[j][0]);
        }
      }
    }

    if (involved.length > 0) {
      conflictBuckets.push(bucket);
      conflictDevicesMap.set(bucket, involved);
    }
  }

  if (conflictBuckets.length === 0) return [];

  conflictBuckets.sort((a, b) => a - b);
  const ranges: ConflictRange[] = [];
  let rangeStart = conflictBuckets[0];
  let rangeEnd = conflictBuckets[0];
  let rangeDevices = new Set(conflictDevicesMap.get(rangeStart)!);

  for (let i = 1; i < conflictBuckets.length; i++) {
    const b = conflictBuckets[i];
    if (b === rangeEnd + 1) {
      rangeEnd = b;
      conflictDevicesMap.get(b)!.forEach((d) => rangeDevices.add(d));
    } else {
      ranges.push({
        fromTime: new Date(rangeStart * bucketMs),
        toTime: new Date((rangeEnd + 1) * bucketMs),
        deviceIds: [...rangeDevices],
      });
      rangeStart = b;
      rangeEnd = b;
      rangeDevices = new Set(conflictDevicesMap.get(b)!);
    }
  }
  ranges.push({
    fromTime: new Date(rangeStart * bucketMs),
    toTime: new Date((rangeEnd + 1) * bucketMs),
    deviceIds: [...rangeDevices],
  });

  return ranges;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test tests/unit/conflict-detection.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/conflict-detection.ts tests/unit/conflict-detection.test.ts
git commit -m "feat: add client-side conflict detection"
```

---

## Task 6: DeviceFilterProvider context

**Files:**
- Create: `components/DeviceFilterProvider.tsx`

No test needed — this is a thin React context wrapper over the API. The API routes are already tested.

- [ ] **Step 1: Create DeviceFilterProvider**

Create `components/DeviceFilterProvider.tsx`:

```typescript
"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConflictRange } from "@/lib/conflict-detection";

export type SerializedDeviceFilter = {
  id: string;
  fromTime: string;
  toTime: string;
  deviceIds: string[];
  label: string | null;
  createdAt: string;
};

type DeviceFilterContextValue = {
  filters: SerializedDeviceFilter[];
  conflicts: ConflictRange[];
  setConflicts: (conflicts: ConflictRange[]) => void;
  createFilter: (filter: {
    fromTime: string;
    toTime: string;
    deviceIds: string[];
    label?: string;
  }) => Promise<void>;
  deleteFilter: (id: string) => Promise<void>;
};

const DeviceFilterContext = createContext<DeviceFilterContextValue | null>(null);

export function DeviceFilterProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [conflicts, setConflicts] = useState<ConflictRange[]>([]);

  const { data: filters = [] } = useQuery<SerializedDeviceFilter[]>({
    queryKey: ["device-filters"],
    queryFn: async () => {
      const res = await fetch("/api/device-filters");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createFilter = useCallback(
    async (filter: { fromTime: string; toTime: string; deviceIds: string[]; label?: string }) => {
      await fetch("/api/device-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filter),
      });
      queryClient.invalidateQueries({ queryKey: ["device-filters"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
    [queryClient]
  );

  const deleteFilter = useCallback(
    async (id: string) => {
      await fetch(`/api/device-filters/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["device-filters"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
    },
    [queryClient]
  );

  return (
    <DeviceFilterContext.Provider
      value={{ filters, conflicts, setConflicts, createFilter, deleteFilter }}
    >
      {children}
    </DeviceFilterContext.Provider>
  );
}

export function useDeviceFilters() {
  const ctx = useContext(DeviceFilterContext);
  if (!ctx) throw new Error("useDeviceFilters must be inside DeviceFilterProvider");
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/DeviceFilterProvider.tsx
git commit -m "feat: add DeviceFilterProvider context"
```

---

## Task 7: ConflictResolutionDialog component

**Files:**
- Create: `components/ConflictResolutionDialog.tsx`

- [ ] **Step 1: Create dialog**

Create `components/ConflictResolutionDialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { ConflictRange } from "@/lib/conflict-detection";
import { useDeviceFilters } from "@/components/DeviceFilterProvider";

type Props = {
  conflict: ConflictRange;
  onClose: () => void;
};

export default function ConflictResolutionDialog({ conflict, onClose }: Props) {
  const { createFilter } = useDeviceFilters();
  const [selectedDevices, setSelectedDevices] = useState<string[]>([conflict.deviceIds[0]]);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleDevice(deviceId: string) {
    setSelectedDevices((prev) =>
      prev.includes(deviceId) ? prev.filter((d) => d !== deviceId) : [...prev, deviceId]
    );
  }

  async function handleSave() {
    if (selectedDevices.length === 0) return;
    setSaving(true);
    try {
      await createFilter({
        fromTime: conflict.fromTime.toISOString(),
        toTime: conflict.toTime.toISOString(),
        deviceIds: selectedDevices,
        label: label || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-hidden rounded-lg bg-white shadow-xl sm:max-w-md">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Resolve Device Conflict</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Select which device(s) to show for this time range
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-1 text-xs text-gray-500">Time range</p>
            <p className="text-sm text-gray-900">
              {format(conflict.fromTime, "MMM d, HH:mm")} – {format(conflict.toTime, "HH:mm")}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs text-gray-500">Show data from</p>
            <div className="space-y-1.5">
              {conflict.deviceIds.map((deviceId) => (
                <label key={deviceId} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedDevices.includes(deviceId)}
                    onChange={() => toggleDevice(deviceId)}
                    disabled={saving}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="font-mono text-gray-900">{deviceId}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Left phone at home"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-gray-900 focus:border-blue-500 focus:outline-none"
              style={{ fontSize: "16px" }}
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            disabled={saving || selectedDevices.length === 0}
          >
            {saving ? "Saving…" : "Save filter"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ConflictResolutionDialog.tsx
git commit -m "feat: add ConflictResolutionDialog"
```

---

## Task 8: ConflictsPanel component

**Files:**
- Create: `components/ConflictsPanel.tsx`

- [ ] **Step 1: Create panel**

Create `components/ConflictsPanel.tsx`:

```typescript
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useDeviceFilters } from "@/components/DeviceFilterProvider";
import ConflictResolutionDialog from "@/components/ConflictResolutionDialog";
import type { ConflictRange } from "@/lib/conflict-detection";

export default function ConflictsPanel() {
  const { filters, conflicts, deleteFilter } = useDeviceFilters();
  const [resolvingConflict, setResolvingConflict] = useState<ConflictRange | null>(null);

  const unresolvedConflicts = conflicts.filter(
    (conflict) =>
      !filters.some(
        (f) =>
          new Date(f.fromTime) <= conflict.fromTime &&
          new Date(f.toTime) >= conflict.toTime
      )
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Unresolved Conflicts
        </h3>
        {unresolvedConflicts.length === 0 ? (
          <p className="text-xs text-gray-400">No conflicts detected for the current view.</p>
        ) : (
          <ul className="space-y-2">
            {unresolvedConflicts.map((conflict, i) => (
              <li key={i} className="rounded border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-medium text-orange-800">
                  {format(conflict.fromTime, "MMM d, HH:mm")} –{" "}
                  {format(conflict.toTime, "HH:mm")}
                </p>
                <p className="mt-0.5 text-xs text-orange-600">
                  Devices: {conflict.deviceIds.join(", ")}
                </p>
                <button
                  onClick={() => setResolvingConflict(conflict)}
                  className="mt-2 rounded bg-orange-500 px-2 py-1 text-xs font-medium text-white hover:bg-orange-600"
                >
                  Resolve
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Active Filters
        </h3>
        {filters.length === 0 ? (
          <p className="text-xs text-gray-400">No filters saved.</p>
        ) : (
          <ul className="space-y-2">
            {filters.map((filter) => (
              <li key={filter.id} className="rounded border border-gray-200 bg-gray-50 p-3">
                {filter.label && (
                  <p className="mb-0.5 text-xs font-medium text-gray-800">{filter.label}</p>
                )}
                <p className="text-xs text-gray-600">
                  {format(new Date(filter.fromTime), "MMM d, HH:mm")} –{" "}
                  {format(new Date(filter.toTime), "HH:mm")}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Showing: {filter.deviceIds.join(", ")}
                </p>
                <button
                  onClick={() => deleteFilter(filter.id)}
                  className="mt-2 rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resolvingConflict && (
        <ConflictResolutionDialog
          conflict={resolvingConflict}
          onClose={() => setResolvingConflict(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ConflictsPanel.tsx
git commit -m "feat: add ConflictsPanel"
```

---

## Task 9: Add Devices tab to layout and wrap with provider

**Files:**
- Modify: `app/timeline/layout.tsx`

- [ ] **Step 1: Add DevicesIcon function**

In `app/timeline/layout.tsx`, add after the `SettingsIcon` function (around line 62):

```typescript
function DevicesIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3A1.5 1.5 0 0 1 13 3.5V5h-1V3.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V5H7V3.5Z" />
      <path fillRule="evenodd" d="M6.5 6A1.5 1.5 0 0 0 5 7.5v8A1.5 1.5 0 0 0 6.5 17h7a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 13.5 6h-7ZM6 7.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-8Z" clipRule="evenodd" />
    </svg>
  );
}
```

- [ ] **Step 2: Add "devices" to SidebarTab and TABS**

Change the `SidebarTab` type (line 22):
```typescript
type SidebarTab = "timeline" | "places" | "suggestions" | "unknown" | "settings" | "devices";
```

Add to the `TABS` array (after the `unknown` entry):
```typescript
{ id: "devices", label: "Devices", Icon: DevicesIcon },
```

- [ ] **Step 3: Add devices panel to PanelContent**

In the `PanelContent` function, add after the `{activeTab === "unknown" && ...}` block:

```typescript
{activeTab === "devices" && (
  <div className="flex h-full flex-col overflow-hidden">
    <div className="border-b px-4 py-3">
      <h2 className="text-sm font-semibold">Device Filters</h2>
    </div>
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      <ConflictsPanel />
    </div>
  </div>
)}
```

Add the import at the top of the file:
```typescript
import ConflictsPanel from "@/components/ConflictsPanel";
import { DeviceFilterProvider } from "@/components/DeviceFilterProvider";
```

- [ ] **Step 4: Wrap TimelineShell return in DeviceFilterProvider**

In `TimelineShell`, wrap the outermost `<div>` in `<DeviceFilterProvider>`:

```typescript
return (
  <DeviceFilterProvider>
    <div className="flex h-dvh w-full overflow-hidden bg-background md:h-screen md:w-screen md:flex-row">
      {/* ... rest unchanged ... */}
    </div>
  </DeviceFilterProvider>
);
```

- [ ] **Step 5: Verify lint**

```bash
pnpm exec eslint app/timeline/layout.tsx
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/timeline/layout.tsx
git commit -m "feat: add Devices tab to sidebar with ConflictsPanel"
```

---

## Task 10: Wire conflict detection in MapWrapper + map filter badge

**Files:**
- Modify: `components/map/MapWrapper.tsx`

- [ ] **Step 1: Import detectConflicts and context**

Add to the imports in `components/map/MapWrapper.tsx`:

```typescript
import { detectConflicts } from "@/lib/conflict-detection";
import { useDeviceFilters } from "@/components/DeviceFilterProvider";
```

- [ ] **Step 2: Run conflict detection after points are fetched**

After line 117 (`const points = locationsData?.points ?? EMPTY_POINTS;`), add:

```typescript
const { setConflicts, filters: activeFilters } = useDeviceFilters();

useEffect(() => {
  setConflicts(detectConflicts(points));
}, [points, setConflicts]);
```

Add `useEffect` to the React import at top if not already present:
```typescript
import { useCallback, useEffect, useRef, useState } from "react";
```

- [ ] **Step 3: Add map filter badge**

In the `MapWrapper` return, change:

```typescript
return (
  <div className="h-full w-full">
    <MapLibreMap ... />
```

to:

```typescript
return (
  <div className="relative h-full w-full">
    {activeFilters.length > 0 && (
      <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-orange-500/90 px-3 py-1 text-xs font-medium text-white shadow">
        {activeFilters.length} device filter{activeFilters.length !== 1 ? "s" : ""} active
      </div>
    )}
    <MapLibreMap ... />
```

- [ ] **Step 4: Verify lint**

```bash
pnpm exec eslint components/map/MapWrapper.tsx
```

Expected: no errors.

- [ ] **Step 5: Run all unit tests**

```bash
pnpm test
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add components/map/MapWrapper.tsx
git commit -m "feat: run conflict detection in MapWrapper and show filter badge"
```

---

## Task 11: E2E verification

**Files:**
- Create: `tests/e2e/device-filters.spec.ts`

- [ ] **Step 1: Write e2e test**

Create `tests/e2e/device-filters.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("device filter CRUD via API", async ({ request }) => {
  // Create a filter
  const create = await request.post("/api/device-filters", {
    data: {
      fromTime: "2026-04-01T08:00:00Z",
      toTime: "2026-04-01T18:00:00Z",
      deviceIds: ["phone"],
      label: "Test filter",
    },
  });
  expect(create.status()).toBe(201);
  const { id } = await create.json();
  expect(typeof id).toBe("string");

  // List — should include new filter
  const list = await request.get("/api/device-filters");
  expect(list.status()).toBe(200);
  const filters = await list.json();
  expect(filters.some((f: { id: string }) => f.id === id)).toBe(true);

  // Delete
  const del = await request.delete(`/api/device-filters/${id}`);
  expect(del.status()).toBe(204);

  // List — should no longer include it
  const listAfter = await request.get("/api/device-filters");
  const filtersAfter = await listAfter.json();
  expect(filtersAfter.some((f: { id: string }) => f.id === id)).toBe(false);
});
```

- [ ] **Step 2: Run e2e test** (requires dev server running)

```bash
pnpm dev &
sleep 5
pnpm test:e2e tests/e2e/device-filters.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/device-filters.spec.ts
git commit -m "test: add e2e test for device filter CRUD"
```
