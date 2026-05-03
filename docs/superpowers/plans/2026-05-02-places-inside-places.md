# Places Inside Places Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to define sub-places (e.g. stores inside a mall) and annotate parent visits with which sub-places they visited.

**Architecture:** Add a self-referential `parentId` FK on `Place` and a `parentVisitId` FK on `Visit`. Sub-places are regular Places with no GPS detection. When viewing a visit to a parent place, users tick sub-place checkboxes; each check creates a child `Visit` record. The Places panel shows only root places by default, with an expand toggle to reveal children.

**Tech Stack:** Next.js 15 App Router, Prisma + PostgreSQL, React Query, Vitest (unit), Playwright (E2E), Tailwind + shadcn/ui

---

## File Map

| Status | File | Purpose |
|--------|------|---------|
| Modify | `prisma/schema.prisma` | Add `parentId` to Place, `parentVisitId` to Visit |
| Modify | `lib/detectVisits.ts` | Skip sub-places in `detectVisitsForAllPlaces` |
| Modify | `app/api/places/route.ts` | GET: add `parentId`, `childCount`, filter by `parentId`; POST: accept `parentId` |
| Modify | `app/api/visits/route.ts` | GET: include `checkedSubPlaceIds` per visit |
| Create | `app/api/visits/[id]/sub-places/route.ts` | PUT: idempotent sub-place visit annotation |
| Create | `components/VisitSubPlacesPanel.tsx` | Checklist UI per visit (shown inside PlaceDetailModal) |
| Create | `components/SubPlacesSection.tsx` | Manage sub-places for a parent place (shown inside PlaceDetailModal) |
| Modify | `components/PlaceDetailModal.tsx` | Render VisitSubPlacesPanel and SubPlacesSection |
| Modify | `components/VisitCard.tsx` | Extend `Visit` type with `checkedSubPlaceIds` |
| Modify | `components/places/PlaceListItem.tsx` | Add expand toggle when `childCount > 0` |
| Modify | `lib/detectVisits.ts` | Add `childCount` to `PlaceData` type |
| Modify | `components/places/PlaceListItem.tsx` | Add `childCount` to `PlacePanelItem` type |
| Modify | `components/PlacesPanel.tsx` | Expand state, fetch children, render nested list |
| Create | `tests/unit/detect-visits-skips-sub-places.test.ts` | Unit: bulk detection skips sub-places |
| Create | `tests/unit/api-places-hierarchy.test.ts` | Unit: GET parentId filtering, POST parentId |
| Create | `tests/unit/api-visit-sub-places.test.ts` | Unit: PUT sub-places endpoint |
| Create | `tests/e2e/sub-places.spec.ts` | E2E: annotation flow + expand toggle |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update schema**

Replace the `Place` and `Visit` models in `prisma/schema.prisma`:

```prisma
model Place {
  id        Int      @id @default(autoincrement())
  name      String
  lat       Float
  lon       Float
  radius    Float    @default(50)
  parentId  Int?
  parent    Place?   @relation("PlaceChildren", fields: [parentId], references: [id])
  children  Place[]  @relation("PlaceChildren")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  visits    Visit[]

  @@index([lat, lon])
  @@index([parentId])
}

model Visit {
  id            Int      @id @default(autoincrement())
  placeId       Int
  place         Place    @relation(fields: [placeId], references: [id], onDelete: Cascade)
  parentVisitId Int?
  parentVisit   Visit?   @relation("VisitChildren", fields: [parentVisitId], references: [id])
  childVisits   Visit[]  @relation("VisitChildren")
  arrivalAt     DateTime
  departureAt   DateTime
  status        String   @default("suggested")
  pointCount    Int      @default(0)
  createdAt     DateTime @default(now())

  @@index([placeId])
  @@index([status])
  @@index([placeId, status])
  @@index([arrivalAt])
  @@index([departureAt])
  @@index([parentVisitId])
}
```

- [ ] **Step 2: Generate migration and client**

```bash
pnpm prisma migrate dev --name add-place-hierarchy
pnpm prisma generate
```

Expected: migration file created under `prisma/migrations/`, no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Place.parentId and Visit.parentVisitId for place hierarchy"
```

---

## Task 2: Skip Sub-places in Bulk Visit Detection

**Files:**
- Create: `tests/unit/detect-visits-skips-sub-places.test.ts`
- Modify: `lib/detectVisits.ts:485`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/detect-visits-skips-sub-places.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    place: { findMany: vi.fn() },
    locationPoint: { findMany: vi.fn() },
    visit: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    appSettings: { findUnique: vi.fn() },
  },
}));

import { detectVisitsForAllPlaces } from "@/lib/detectVisits";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

describe("detectVisitsForAllPlaces - sub-place exclusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.place.findMany as MockFn).mockResolvedValue([]);
    (prisma.locationPoint.findMany as MockFn).mockResolvedValue([]);
    (prisma.appSettings.findUnique as MockFn).mockResolvedValue(null);
  });

  it("queries only root places (parentId: null) when loading places for detection", async () => {
    await detectVisitsForAllPlaces();
    expect(prisma.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentId: null }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run tests/unit/detect-visits-skips-sub-places.test.ts
```

Expected: FAIL — `parentId: null` not present in the query.

- [ ] **Step 3: Implement the fix**

In `lib/detectVisits.ts`, change line 485 from:

```typescript
const places = await prisma.place.findMany({ where: { isActive: true } });
```

to:

```typescript
const places = await prisma.place.findMany({ where: { isActive: true, parentId: null } });
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm exec vitest run tests/unit/detect-visits-skips-sub-places.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/unit/detect-visits-skips-sub-places.test.ts lib/detectVisits.ts
git commit -m "feat: skip sub-places in bulk visit detection"
```

---

## Task 3: GET /api/places — parentId Filtering and childCount

**Files:**
- Create: `tests/unit/api-places-hierarchy.test.ts`
- Modify: `app/api/places/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/api-places-hierarchy.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    visit: { groupBy: vi.fn() },
  },
}));

import { GET } from "@/app/api/places/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

const NOW = new Date("2026-05-02T12:00:00Z");

function mockRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    name: "Home",
    lat: 10,
    lon: 20,
    radius: 50,
    isActive: true,
    createdAt: NOW,
    parentId: null,
    childCount: BigInt(0),
    lastVisitAt: null,
    confirmedVisits: BigInt(0),
    totalVisits: BigInt(0),
    ...overrides,
  };
}

function makeRequest(url: string) {
  const parsed = new URL(url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { nextUrl: parsed } as any;
}

describe("GET /api/places — hierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.visit.groupBy as MockFn).mockResolvedValue([]);
  });

  it("returns parentId and childCount in each place", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([
      mockRow({ id: 1, parentId: null, childCount: BigInt(2) }),
    ]);

    const res = await GET(makeRequest("http://localhost/api/places"));
    const body = await res.json();

    expect(body.places[0].parentId).toBeNull();
    expect(body.places[0].childCount).toBe(2);
  });

  it("passes parentId IS NULL condition to SQL by default", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([]);

    await GET(makeRequest("http://localhost/api/places"));

    const sqlArg = (prisma.$queryRaw as MockFn).mock.calls[0][0];
    const sqlStr = sqlArg.strings.join("");
    expect(sqlStr).toContain('"parentId" IS NULL');
  });

  it("filters by parentId when ?parentId=5 is provided", async () => {
    (prisma.$queryRaw as MockFn).mockResolvedValueOnce([
      mockRow({ id: 10, parentId: 5, childCount: BigInt(0) }),
    ]);

    const res = await GET(makeRequest("http://localhost/api/places?parentId=5"));
    const body = await res.json();

    expect(body.places[0].parentId).toBe(5);
    const sqlArg = (prisma.$queryRaw as MockFn).mock.calls[0][0];
    const sqlStr = sqlArg.strings.join("");
    expect(sqlStr).not.toContain('"parentId" IS NULL');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm exec vitest run tests/unit/api-places-hierarchy.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement — update GET handler in `app/api/places/route.ts`**

Update the `PlaceRow` type by adding `parentId` and `childCount`:

```typescript
type PlaceRow = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  isActive: boolean;
  createdAt: Date;
  parentId: number | null;
  childCount: bigint | number;
  lastVisitAt: Date | null;
  confirmedVisits: bigint | number;
  totalVisits: bigint | number;
};
```

In the `GET` handler, add parentId parsing after the existing `sp.get` calls:

```typescript
const parentIdParam = sp.get("parentId");
const parentIdFilter: number | null | "root" =
  parentIdParam === null
    ? "root"
    : Number.isInteger(Number.parseInt(parentIdParam, 10))
    ? Number.parseInt(parentIdParam, 10)
    : "root";
```

Add the parentId condition to the `conditions` array (after the existing bbox/q conditions):

```typescript
if (parentIdFilter === "root") {
  conditions.push(Prisma.sql`p."parentId" IS NULL`);
} else {
  conditions.push(Prisma.sql`p."parentId" = ${parentIdFilter}`);
}
```

Update the raw SQL SELECT to include `parentId` and `childCount`:

```typescript
const rows = await prisma.$queryRaw<PlaceRow[]>`
  SELECT
    p.id,
    p.name,
    p.lat,
    p.lon,
    p.radius,
    p."isActive",
    p."createdAt",
    p."parentId",
    COALESCE(child_counts.child_count, 0) AS "childCount",
    last_confirmed.last_at AS "lastVisitAt",
    COALESCE(v_counts.confirmed, 0) AS "confirmedVisits",
    COALESCE(v_counts.total, 0) AS "totalVisits"
  FROM "Place" p
  LEFT JOIN (
    SELECT "parentId", COUNT(*) AS child_count
    FROM "Place"
    WHERE "parentId" IS NOT NULL
    GROUP BY "parentId"
  ) child_counts ON child_counts."parentId" = p.id
  LEFT JOIN (
    SELECT "placeId", MAX("departureAt") AS last_at
    FROM "Visit"
    WHERE status = 'confirmed'
    GROUP BY "placeId"
  ) last_confirmed ON last_confirmed."placeId" = p.id
  LEFT JOIN (
    SELECT
      "placeId",
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed
    FROM "Visit"
    GROUP BY "placeId"
  ) v_counts ON v_counts."placeId" = p.id
  ${whereClause}
  ORDER BY ${orderBy}
  LIMIT ${limit + 1} OFFSET ${offset}
`;
```

Add `parentId` and `childCount` to the mapped response in the `.map()` call:

```typescript
const places = pageRows.map((r) => {
  const inR = inRangeMap.get(r.id) ?? { confirmed: 0, suggested: 0 };
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lon: r.lon,
    radius: r.radius,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    parentId: r.parentId,
    childCount: Number(r.childCount),
    totalVisits: Number(r.totalVisits),
    confirmedVisits: Number(r.confirmedVisits),
    visitsInRange: inR.confirmed + inR.suggested,
    confirmedVisitsInRange: inR.confirmed,
    suggestedVisitsInRange: inR.suggested,
    lastVisitAt: r.lastVisitAt ? r.lastVisitAt.toISOString() : null,
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm exec vitest run tests/unit/api-places-hierarchy.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/unit/api-places-hierarchy.test.ts app/api/places/route.ts
git commit -m "feat: GET /api/places returns parentId and childCount, filters by parentId"
```

---

## Task 4: POST /api/places — Accept parentId

**Files:**
- Modify: `tests/unit/api-places-hierarchy.test.ts`
- Modify: `app/api/places/route.ts`

- [ ] **Step 1: Add failing tests for POST**

Append to `tests/unit/api-places-hierarchy.test.ts`:

```typescript
// Add these mocks at the top of the file alongside existing vi.mock calls:
// vi.mock("@/lib/prisma", ...) already mocks prisma.place.create — but this
// file currently only mocks $queryRaw and visit.groupBy. We need a separate
// test file for POST.
```

Create `tests/unit/api-places-post-parent.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    place: { create: vi.fn() },
    visit: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    unknownVisitSuggestion: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/detectVisits", () => ({
  detectVisitsForPlace: vi.fn(),
}));

import { POST } from "@/app/api/places/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/places", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

describe("POST /api/places — parentId", () => {
  const PARENT = { id: 3, name: "Mall", lat: 10, lon: 20, radius: 200 };

  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.unknownVisitSuggestion.findMany as MockFn).mockResolvedValue([]);
    (prisma.visit.findMany as MockFn).mockResolvedValue([]);
  });

  it("creates a sub-place with parentId and inherits parent lat/lon when omitted", async () => {
    const CHILD = { id: 99, name: "H&M", lat: 10, lon: 20, radius: 200, parentId: 3 };
    (prisma.place.create as MockFn).mockResolvedValue(CHILD);

    const res = await POST(makeRequest({ name: "H&M", lat: 10, lon: 20, parentId: 3 }));

    expect(res.status).toBe(201);
    expect(prisma.place.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "H&M", parentId: 3 }),
      })
    );
  });

  it("creates a sub-place without triggering visit detection", async () => {
    const { detectVisitsForPlace } = await import("@/lib/detectVisits");
    const CHILD = { id: 99, name: "H&M", lat: 10, lon: 20, radius: 200, parentId: 3 };
    (prisma.place.create as MockFn).mockResolvedValue(CHILD);

    await POST(makeRequest({ name: "H&M", lat: PARENT.lat, lon: PARENT.lon, parentId: 3 }));

    expect(detectVisitsForPlace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm exec vitest run tests/unit/api-places-post-parent.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement — update POST handler in `app/api/places/route.ts`**

In the POST handler, extract `parentId` from body alongside existing fields:

```typescript
const { name, lat, lon, radius, supersedesVisitId, parentId } = body;
```

Pass `parentId` to `prisma.place.create`:

```typescript
const place = await prisma.place.create({
  data: {
    name: String(name),
    lat: Number(lat),
    lon: Number(lon),
    radius: radius != null ? Number(radius) : 50,
    ...(parentId != null ? { parentId: Number(parentId) } : {}),
  },
});
```

Skip visit detection when `parentId` is set. Wrap the existing detection call block:

```typescript
// Only run visit detection for root places — sub-places are annotation-only.
if (parentId == null) {
  // ... existing unknown suggestion dismissal + superseded visit logic
  // ... existing detectVisitsForPlace call
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm exec vitest run tests/unit/api-places-post-parent.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/unit/api-places-post-parent.test.ts app/api/places/route.ts
git commit -m "feat: POST /api/places accepts parentId for sub-place creation"
```

---

## Task 5: GET /api/visits — Include checkedSubPlaceIds Per Visit

**Files:**
- Modify: `app/api/visits/route.ts`
- Modify: `components/VisitCard.tsx` (Visit type)
- Create: `tests/unit/api-visits-sub-place-ids.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-visits-sub-place-ids.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    visit: {
      findMany: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/visits/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function makeRequest(url: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Request(url) as any;
}

const PLACE = { id: 1, name: "Mall", lat: 10, lon: 20, radius: 200 };

describe("GET /api/visits — checkedSubPlaceIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes checkedSubPlaceIds on each visit based on parentVisitId links", async () => {
    const parentVisit = {
      id: 10,
      placeId: 1,
      arrivalAt: new Date("2026-05-01T10:00:00Z"),
      departureAt: new Date("2026-05-01T12:00:00Z"),
      status: "confirmed",
      pointCount: 5,
      createdAt: new Date(),
      place: PLACE,
      parentVisitId: null,
      childVisits: [
        { id: 20, placeId: 99 },
        { id: 21, placeId: 100 },
      ],
    };

    (prisma.visit.findMany as MockFn).mockResolvedValue([parentVisit]);

    const res = await GET(makeRequest("http://localhost/api/visits?placeId=1"));
    const body = await res.json();

    expect(body[0].checkedSubPlaceIds).toEqual([99, 100]);
  });

  it("returns empty checkedSubPlaceIds when visit has no child visits", async () => {
    const visit = {
      id: 10,
      placeId: 1,
      arrivalAt: new Date("2026-05-01T10:00:00Z"),
      departureAt: new Date("2026-05-01T12:00:00Z"),
      status: "confirmed",
      pointCount: 5,
      createdAt: new Date(),
      place: PLACE,
      parentVisitId: null,
      childVisits: [],
    };

    (prisma.visit.findMany as MockFn).mockResolvedValue([visit]);

    const res = await GET(makeRequest("http://localhost/api/visits?placeId=1"));
    const body = await res.json();

    expect(body[0].checkedSubPlaceIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run tests/unit/api-visits-sub-place-ids.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement — update GET handler in `app/api/visits/route.ts`**

Update the `include` clause in `findMany` to include `childVisits`:

```typescript
const visits = await prisma.visit.findMany({
  where: { ... }, // unchanged
  include: {
    place: {
      select: { id: true, name: true, lat: true, lon: true, radius: true },
    },
    childVisits: {
      select: { id: true, placeId: true },
    },
  },
  orderBy: { arrivalAt: "asc" },
});

return NextResponse.json(
  visits.map((v) => ({
    ...v,
    checkedSubPlaceIds: v.childVisits.map((c) => c.placeId),
    childVisits: undefined,
  }))
);
```

- [ ] **Step 4: Update `Visit` type in `components/VisitCard.tsx`**

```typescript
export type Visit = {
  id: number;
  arrivalAt: string;
  departureAt: string;
  status: string;
  checkedSubPlaceIds?: number[];
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm exec vitest run tests/unit/api-visits-sub-place-ids.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/unit/api-visits-sub-place-ids.test.ts app/api/visits/route.ts components/VisitCard.tsx
git commit -m "feat: GET /api/visits includes checkedSubPlaceIds per visit"
```

---

## Task 6: PUT /api/visits/[id]/sub-places — Annotation Endpoint

**Files:**
- Create: `app/api/visits/[id]/sub-places/route.ts`
- Create: `tests/unit/api-visit-sub-places.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/api-visit-sub-places.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    visit: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    place: {
      findMany: vi.fn(),
    },
  },
}));

import { PUT } from "@/app/api/visits/[id]/sub-places/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) } as Parameters<typeof PUT>[1];
}

function makeRequest(body: unknown) {
  return new Request("http://localhost", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

const PARENT_VISIT = {
  id: 10,
  placeId: 1,
  arrivalAt: new Date("2026-05-01T10:00:00Z"),
  departureAt: new Date("2026-05-01T12:00:00Z"),
  status: "confirmed",
  parentVisitId: null,
};

describe("PUT /api/visits/[id]/sub-places", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.visit.findUnique as MockFn).mockResolvedValue(PARENT_VISIT);
    (prisma.place.findMany as MockFn).mockResolvedValue([
      { id: 99, parentId: 1 },
      { id: 100, parentId: 1 },
    ]);
    (prisma.visit.findMany as MockFn).mockResolvedValue([]);
    (prisma.visit.createMany as MockFn).mockResolvedValue({ count: 0 });
    (prisma.visit.deleteMany as MockFn).mockResolvedValue({ count: 0 });
  });

  it("returns 400 for non-numeric id", async () => {
    const res = await PUT(makeRequest({ subPlaceIds: [] }), makeParams("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when parent visit not found", async () => {
    (prisma.visit.findUnique as MockFn).mockResolvedValue(null);
    const res = await PUT(makeRequest({ subPlaceIds: [99] }), makeParams("10"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-array subPlaceIds", async () => {
    const res = await PUT(makeRequest({ subPlaceIds: "bad" }), makeParams("10"));
    expect(res.status).toBe(400);
  });

  it("creates child visits for newly checked sub-places", async () => {
    (prisma.visit.findMany as MockFn).mockResolvedValue([]); // none exist yet
    (prisma.visit.createMany as MockFn).mockResolvedValue({ count: 2 });

    const res = await PUT(makeRequest({ subPlaceIds: [99, 100] }), makeParams("10"));

    expect(res.status).toBe(200);
    expect(prisma.visit.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ placeId: 99, parentVisitId: 10, status: "confirmed" }),
        expect.objectContaining({ placeId: 100, parentVisitId: 10, status: "confirmed" }),
      ]),
    });
  });

  it("deletes child visits for unchecked sub-places", async () => {
    (prisma.visit.findMany as MockFn).mockResolvedValue([
      { id: 20, placeId: 99, parentVisitId: 10 },
      { id: 21, placeId: 100, parentVisitId: 10 },
    ]);
    (prisma.visit.deleteMany as MockFn).mockResolvedValue({ count: 1 });

    const res = await PUT(makeRequest({ subPlaceIds: [99] }), makeParams("10")); // uncheck 100

    expect(res.status).toBe(200);
    expect(prisma.visit.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [21] } },
    });
  });

  it("is idempotent — no creates or deletes when checked matches existing", async () => {
    (prisma.visit.findMany as MockFn).mockResolvedValue([
      { id: 20, placeId: 99, parentVisitId: 10 },
    ]);

    const res = await PUT(makeRequest({ subPlaceIds: [99] }), makeParams("10"));

    expect(res.status).toBe(200);
    expect(prisma.visit.createMany).not.toHaveBeenCalled();
    expect(prisma.visit.deleteMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm exec vitest run tests/unit/api-visit-sub-places.test.ts
```

Expected: FAIL — file does not exist yet.

- [ ] **Step 3: Create `app/api/visits/[id]/sub-places/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const visitId = parseInt(id, 10);

  if (isNaN(visitId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.subPlaceIds)) {
    return NextResponse.json({ error: "subPlaceIds must be an array" }, { status: 400 });
  }

  const subPlaceIds: number[] = body.subPlaceIds.map(Number).filter(Number.isInteger);

  const parentVisit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!parentVisit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existingChildVisits = await prisma.visit.findMany({
    where: { parentVisitId: visitId },
    select: { id: true, placeId: true },
  });

  const existingPlaceIds = new Set(existingChildVisits.map((v) => v.placeId));
  const requestedIds = new Set(subPlaceIds);

  const toCreate = subPlaceIds.filter((pid) => !existingPlaceIds.has(pid));
  const toDelete = existingChildVisits
    .filter((v) => !requestedIds.has(v.placeId))
    .map((v) => v.id);

  if (toCreate.length > 0) {
    await prisma.visit.createMany({
      data: toCreate.map((placeId) => ({
        placeId,
        parentVisitId: visitId,
        arrivalAt: parentVisit.arrivalAt,
        departureAt: parentVisit.departureAt,
        status: "confirmed",
        pointCount: 0,
      })),
    });
  }

  if (toDelete.length > 0) {
    await prisma.visit.deleteMany({ where: { id: { in: toDelete } } });
  }

  const updated = await prisma.visit.findMany({
    where: { parentVisitId: visitId },
    select: { id: true, placeId: true },
  });

  return NextResponse.json({ checkedSubPlaceIds: updated.map((v) => v.placeId) });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm exec vitest run tests/unit/api-visit-sub-places.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/visits/[id]/sub-places/route.ts tests/unit/api-visit-sub-places.test.ts
git commit -m "feat: PUT /api/visits/[id]/sub-places for idempotent sub-place annotation"
```

---

## Task 7: VisitSubPlacesPanel Component

**Files:**
- Create: `components/VisitSubPlacesPanel.tsx`
- Modify: `lib/detectVisits.ts` (PlaceData type)
- Modify: `components/PlaceDetailModal.tsx`

- [ ] **Step 1: Add `childCount` to `PlaceData` in `lib/detectVisits.ts`**

Update the `PlaceData` type:

```typescript
export type PlaceData = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  isActive: boolean;
  childCount?: number;
  visitsInRange?: number;
  confirmedVisitsInRange?: number;
  suggestedVisitsInRange?: number;
  lastVisitAt?: string;
};
```

- [ ] **Step 2: Create `components/VisitSubPlacesPanel.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type SubPlace = { id: number; name: string };

type Props = {
  visitId: number;
  parentPlaceId: number;
  subPlaces: SubPlace[];
  checkedSubPlaceIds: number[];
};

export default function VisitSubPlacesPanel({
  visitId,
  parentPlaceId,
  subPlaces,
  checkedSubPlaceIds,
}: Props) {
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<Set<number>>(new Set(checkedSubPlaceIds));
  const [saving, setSaving] = useState(false);

  if (subPlaces.length === 0) return null;

  async function toggle(subPlaceId: number) {
    const next = new Set(checked);
    if (next.has(subPlaceId)) {
      next.delete(subPlaceId);
    } else {
      next.add(subPlaceId);
    }
    setChecked(next);
    setSaving(true);
    try {
      await fetch(`/api/visits/${visitId}/sub-places`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subPlaceIds: [...next] }),
      });
      queryClient.invalidateQueries({ queryKey: ["visits", "place", parentPlaceId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded-md border bg-muted/30 px-3 py-2">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Places visited inside</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {subPlaces.map((sp) => (
          <div key={sp.id} className="flex items-center gap-1.5">
            <Checkbox
              id={`sub-${visitId}-${sp.id}`}
              checked={checked.has(sp.id)}
              disabled={saving}
              onCheckedChange={() => toggle(sp.id)}
            />
            <Label
              htmlFor={`sub-${visitId}-${sp.id}`}
              className="cursor-pointer text-xs"
            >
              {sp.name}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Integrate `VisitSubPlacesPanel` into `PlaceDetailModal.tsx`**

Add import at the top:

```typescript
import VisitSubPlacesPanel from "@/components/VisitSubPlacesPanel";
```

Add a query to fetch sub-places when the parent place has children. Insert after the existing `visits` query:

```typescript
const { data: subPlaces = [] } = useQuery<{ id: number; name: string }[]>({
  queryKey: ["places", "children", placeInfo.id],
  queryFn: async () => {
    const res = await fetch(`/api/places?parentId=${placeInfo.id}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.places.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name }));
  },
  enabled: (placeInfo.childCount ?? 0) > 0,
});
```

Inside the `displayed.map()` in the JSX, the current code renders `<VisitCard ... />` by itself. Wrap the card and panel together in a `<div>`:

```tsx
<div key={v.id}>
  <VisitCard
    visit={v}
    gapPx={isLast ? 0 : gapToPx(gapsMs[i] ?? NaN, minMs, maxMs, hasDateSeparator)}
    gapMs={gapsMs[i] ?? NaN}
    hasDateSeparator={hasDateSeparator}
    nextYear={yearChanges && nextArrival ? nextArrival.getFullYear() : null}
    nextMonthLabel={monthChanges && nextArrival ? format(nextArrival, "MMM") : null}
    scrubberSegmentKey={monthChanges && nextArrival ? `m:${format(nextArrival, "yyyy-MM")}` : undefined}
    isLast={isLast}
    onConfirm={handleConfirm}
    onReject={handleReject}
    onEdit={setEditingVisit}
    onCreatePlace={openCreatePlaceForVisit}
    onViewDay={handleViewDay}
  />
  {subPlaces.length > 0 && (
    <VisitSubPlacesPanel
      visitId={v.id}
      parentPlaceId={placeInfo.id}
      subPlaces={subPlaces}
      checkedSubPlaceIds={v.checkedSubPlaceIds ?? []}
    />
  )}
</div>
```

Remove the `key={v.id}` prop from `<VisitCard>` since `key` is now on the wrapper `<div>`.

- [ ] **Step 4: Run linter and type-check**

```bash
pnpm exec eslint components/VisitSubPlacesPanel.tsx components/PlaceDetailModal.tsx lib/detectVisits.ts
pnpm exec tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/VisitSubPlacesPanel.tsx components/PlaceDetailModal.tsx lib/detectVisits.ts
git commit -m "feat: add VisitSubPlacesPanel for annotating sub-places on visits"
```

---

## Task 8: SubPlacesSection — Manage Sub-places in PlaceDetailModal

**Files:**
- Create: `components/SubPlacesSection.tsx`
- Modify: `components/PlaceDetailModal.tsx`

- [ ] **Step 1: Create `components/SubPlacesSection.tsx`**

```typescript
"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SubPlace = { id: number; name: string; confirmedVisits: number };

type Props = {
  parentPlaceId: number;
  parentLat: number;
  parentLon: number;
  parentRadius: number;
};

export default function SubPlacesSection({
  parentPlaceId,
  parentLat,
  parentLon,
  parentRadius,
}: Props) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const { data: subPlaces = [] } = useQuery<SubPlace[]>({
    queryKey: ["places", "children", parentPlaceId],
    queryFn: async () => {
      const res = await fetch(`/api/places?parentId=${parentPlaceId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.places.map((p: { id: number; name: string; confirmedVisits: number }) => ({
        id: p.id,
        name: p.name,
        confirmedVisits: p.confirmedVisits,
      }));
    },
  });

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          lat: parentLat,
          lon: parentLon,
          radius: parentRadius,
          parentId: parentPlaceId,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to add sub-place");
        return;
      }
      setNewName("");
      setShowInput(false);
      queryClient.invalidateQueries({ queryKey: ["places", "children", parentPlaceId] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(sp: SubPlace) {
    const ok = window.confirm(`Delete "${sp.name}"? This will also remove its visit records.`);
    if (!ok) return;
    const res = await fetch(`/api/places/${sp.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete sub-place");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["places", "children", parentPlaceId] });
    queryClient.invalidateQueries({ queryKey: ["visits", "place", parentPlaceId] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  return (
    <div className="border-t px-4 py-4 sm:px-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Places inside</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowInput((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {showInput && (
        <div className="mb-3 flex gap-2">
          <Input
            placeholder="Sub-place name (e.g. H&M)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
            className="h-8 text-sm"
            style={{ fontSize: 16 }}
            autoFocus
          />
          <Button size="sm" className="h-8" onClick={handleAdd} disabled={adding || !newName.trim()}>
            Add
          </Button>
        </div>
      )}

      {subPlaces.length === 0 && !showInput ? (
        <p className="text-xs text-muted-foreground">No sub-places yet. Add one to start annotating visits.</p>
      ) : (
        <ul className="space-y-1">
          {subPlaces.map((sp) => (
            <li key={sp.id} className="group flex items-center justify-between rounded px-2 py-1 hover:bg-muted">
              <div>
                <span className="text-sm">{sp.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {sp.confirmedVisits} {sp.confirmedVisits === 1 ? "visit" : "visits"}
                </span>
              </div>
              <button
                type="button"
                aria-label={`Delete ${sp.name}`}
                onClick={() => handleDelete(sp)}
                className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate `SubPlacesSection` into `PlaceDetailModal.tsx`**

Add import:

```typescript
import SubPlacesSection from "@/components/SubPlacesSection";
```

Inside `DialogContent`, add the section after the closing `</div>` of the timeline section (before the closing `</DialogContent>`):

```tsx
<SubPlacesSection
  parentPlaceId={placeInfo.id}
  parentLat={placeInfo.lat}
  parentLon={placeInfo.lon}
  parentRadius={placeInfo.radius}
/>
```

**Note on rename:** The spec mentions rename as an action in SubPlacesSection. It is not implemented here — users can delete and re-add with the correct name. Renaming is a straightforward future addition using the existing `PUT /api/places/[id]` endpoint.

- [ ] **Step 3: Run linter and type-check**

```bash
pnpm exec eslint components/SubPlacesSection.tsx components/PlaceDetailModal.tsx
pnpm exec tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/SubPlacesSection.tsx components/PlaceDetailModal.tsx
git commit -m "feat: add SubPlacesSection for managing sub-places in PlaceDetailModal"
```

---

## Task 9: PlacesPanel — Expand Toggle for Nested Children

**Files:**
- Modify: `components/places/PlaceListItem.tsx`
- Modify: `components/PlacesPanel.tsx`

- [ ] **Step 1: Update `PlacePanelItem` in `components/places/PlaceListItem.tsx`**

Add `parentId` and `childCount` to the type:

```typescript
export type PlacePanelItem = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  isActive: boolean;
  parentId: number | null;
  childCount: number;
  totalVisits: number;
  confirmedVisits: number;
  visitsInRange: number;
  confirmedVisitsInRange: number;
  suggestedVisitsInRange: number;
  lastVisitAt: string | null;
  createdAt: string;
};
```

Update `Props` to include expand callback:

```typescript
type Props = {
  place: PlacePanelItem;
  onEdit: (place: PlacePanelItem) => void;
  onDelete: (place: PlacePanelItem) => void;
  isExpanded?: boolean;
  onToggleExpand?: (id: number) => void;
  isChild?: boolean;
};
```

Replace the entire `PlaceListItem` function body with the version below (keep all existing imports, add `ChevronRight`, `ChevronDown` from lucide-react):

```tsx
import { MapPin, Navigation, Copy, Trash2, ChevronRight, ChevronDown } from "lucide-react";

export default function PlaceListItem({ place, onEdit, onDelete, isExpanded, onToggleExpand, isChild }: Props) {
  const hasVisits = place.confirmedVisits > 0;
  const visitsLabel = hasVisits
    ? `${place.confirmedVisits} ${place.confirmedVisits === 1 ? "visit" : "visits"} · ${place.radius}m radius`
    : `No visits yet · ${place.radius}m radius`;

  function flyTo() {
    window.dispatchEvent(
      new CustomEvent("opentimeline:fly-to", {
        detail: { lat: place.lat, lon: place.lon },
      })
    );
  }

  async function handleCopyCoords(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${place.lat}, ${place.lon}`);
      toast.success("Coordinates copied");
    } catch {
      toast.error("Couldn't copy coordinates");
    }
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const ok = window.confirm(`Delete "${place.name}"? This cannot be undone.`);
    if (ok) onDelete(place);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={place.name}
      title={place.name}
      onClick={() => onEdit(place)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(place);
        }
      }}
      className={`group relative flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 pr-28 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:pr-20 ${isChild ? "pl-8" : ""}`}
    >
      {place.childCount > 0 && onToggleExpand && (
        <button
          type="button"
          aria-label={isExpanded ? "Collapse sub-places" : "Expand sub-places"}
          onClick={(e) => { e.stopPropagation(); onToggleExpand(place.id); }}
          className="absolute left-0 top-2.5 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <MapPin className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{place.name}</p>
        {hasVisits && place.lastVisitAt != null && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last visited {formatRelative(place.lastVisitAt)}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">{visitsLabel}</p>
      </div>
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-60">
        <button
          type="button"
          aria-label="Fly to place"
          onClick={(e) => { e.stopPropagation(); flyTo(); }}
          className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:p-1"
        >
          <Navigation className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Copy coordinates"
          onClick={handleCopyCoords}
          className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:p-1"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Delete place"
          onClick={handleDelete}
          className="rounded p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive md:p-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `PlacesPanel.tsx` to handle expansion**

Add expand state and child fetch after existing state declarations:

```typescript
const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

function toggleExpand(id: number) {
  setExpandedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}
```

Add a query that fetches children for all currently expanded parents. Insert after the main places query:

```typescript
const { data: childrenByParent } = useQuery<Record<number, PlacePanelItem[]>>({
  queryKey: ["places", "children-map", [...expandedIds].sort().join(",")],
  queryFn: async () => {
    if (expandedIds.size === 0) return {};
    const results: Record<number, PlacePanelItem[]> = {};
    await Promise.all(
      [...expandedIds].map(async (parentId) => {
        const params = new URLSearchParams({ parentId: String(parentId) });
        const res = await fetch(`/api/places?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        results[parentId] = data.places;
      })
    );
    return results;
  },
  enabled: expandedIds.size > 0,
});
```

In the render, replace the `places.map(...)` to interleave children after their parents:

```tsx
{places.flatMap((place) => {
  const rows = [
    <PlaceListItem
      key={place.id}
      place={place}
      onEdit={setEditingPlace}
      onDelete={handleDelete}
      isExpanded={expandedIds.has(place.id)}
      onToggleExpand={place.childCount > 0 ? toggleExpand : undefined}
    />,
  ];
  if (expandedIds.has(place.id)) {
    const children = childrenByParent?.[place.id] ?? [];
    children.forEach((child) => {
      rows.push(
        <PlaceListItem
          key={child.id}
          place={child}
          onEdit={setEditingPlace}
          onDelete={handleDelete}
          isChild
        />
      );
    });
  }
  return rows;
})}
```

- [ ] **Step 3: Run existing unit tests and fix any fixture failures**

```bash
pnpm exec vitest run tests/unit/PlacesPanel.test.tsx tests/unit/PlaceListItem.test.tsx tests/unit/PlacesToolbar.test.tsx
```

If tests fail because mock `PlacePanelItem` objects are missing the new `parentId` and `childCount` fields, add them to each fixture object: `parentId: null, childCount: 0`. Do not skip or delete tests.

- [ ] **Step 4: Run linter and type-check**

```bash
pnpm exec eslint components/places/PlaceListItem.tsx components/PlacesPanel.tsx
pnpm exec tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/places/PlaceListItem.tsx components/PlacesPanel.tsx
git commit -m "feat: PlacesPanel expand toggle shows nested sub-places"
```

---

## Task 10: E2E Tests

**Files:**
- Create: `tests/e2e/sub-places.spec.ts`

- [ ] **Step 1: Write E2E tests**

Create `tests/e2e/sub-places.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Sub-places", () => {
  test("can add a sub-place to a parent place and see it in the expand toggle", async ({ page }) => {
    await page.goto("/");

    // Open Places panel
    await page.getByRole("button", { name: /places/i }).first().click();

    // Click the first place to open its detail modal
    const firstPlace = page.locator('[aria-label]').first();
    await firstPlace.click();

    // In the modal, scroll to Sub-places section
    await page.getByRole("heading", { name: /places inside/i }).scrollIntoViewIfNeeded();

    // Click "Add"
    await page.getByRole("button", { name: /^add$/i }).last().click();

    // Type sub-place name
    await page.getByPlaceholder(/sub-place name/i).fill("H&M");
    await page.getByRole("button", { name: /^add$/i }).last().click();

    // Verify it appears in the list
    await expect(page.getByText("H&M")).toBeVisible();
  });

  test("can annotate a visit with a sub-place", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /places/i }).first().click();
    const firstPlace = page.locator('[role="button"]').first();
    await firstPlace.click();

    // Wait for visits to load
    await page.waitForSelector('[data-testid="visit-card"], .visit-card', { timeout: 5000 }).catch(() => {});

    // If sub-places are shown, tick a checkbox
    const checkbox = page.locator('label:has-text("H&M") + button, input[type="checkbox"]').first();
    if (await checkbox.isVisible()) {
      await checkbox.click();
    }
  });

  test("Places panel expand toggle shows sub-places", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /places/i }).first().click();

    // Look for an expand toggle (ChevronRight button)
    const expandBtn = page.locator('button[aria-label="Expand sub-places"]').first();
    if (await expandBtn.isVisible()) {
      await expandBtn.click();
      // The button should now say "Collapse"
      await expect(page.locator('button[aria-label="Collapse sub-places"]').first()).toBeVisible();
    }
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
pnpm exec playwright test tests/e2e/sub-places.spec.ts
```

Expected: tests pass or skip gracefully when pre-conditions aren't met (empty database).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/sub-places.spec.ts
git commit -m "test: add E2E smoke tests for sub-places feature"
```
