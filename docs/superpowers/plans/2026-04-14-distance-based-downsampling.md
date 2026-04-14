# Distance-Based Downsampling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stride decimation in `/api/locations` with distance-bucket sampling so the rendered map line stays evenly spaced along the trajectory regardless of recording cadence.

**Architecture:** The route already does a COUNT pre-flight when bounds apply. We extend that pre-flight to also return total path length (sum of haversine distances between consecutive points), then pick an adaptive per-point gap `D = totalKm / 20000`. A single SQL query with two window-function CTEs computes running cumulative distance and keeps the first point in each `floor(cum_km / D)` bucket. Stationary ranges (total_km ≈ 0) fall back to the current stride logic so we don't collapse to a single point.

**Tech Stack:** Next.js route handler, Prisma raw SQL (`$queryRaw` + `Prisma.sql`), Postgres window functions, vitest unit tests with mocked `$queryRaw`.

**Spec:** [docs/superpowers/specs/2026-04-14-distance-based-downsampling-design.md](docs/superpowers/specs/2026-04-14-distance-based-downsampling-design.md)

---

## File Structure

- [lib/locations.ts](lib/locations.ts) — export a reusable `haversineKmSql` `Prisma.sql` fragment so both the stats and the route use the identical formula. Shared constant `DECIMATION_THRESHOLD` already lives here.
- [app/api/locations/route.ts](app/api/locations/route.ts) — extend the bounded pre-flight query to also return `total_km`; replace the stride branch with distance-bucket sampling; add stationary fallback.
- [tests/unit/api-locations-route.test.ts](tests/unit/api-locations-route.test.ts) — update existing decimation test mocks (pre-flight now returns `total` + `total_km`); add stationary-fallback case; assert SQL shape for distance-bucket query.

Note: the `skipBoundsIfSmall` branch at [app/api/locations/route.ts:61-86](app/api/locations/route.ts#L61-L86) is unchanged — it only returns when the unbounded count is already under threshold.

---

### Task 1: Extract shared haversine SQL fragment

Pure refactor. Moves the haversine formula out of inline SQL so route.ts can reuse the exact expression stats uses. No behavior change.

**Files:**
- Modify: [lib/locations.ts](lib/locations.ts) (export new fragment, use it in both stats queries)

- [ ] **Step 1: Run existing tests to establish green baseline**

Run: `pnpm test`
Expected: all tests PASS (baseline before refactor).

- [ ] **Step 2: Add exported haversine fragment and use it in both stats queries**

In [lib/locations.ts](lib/locations.ts), add at the top of the file after the imports and `DECIMATION_THRESHOLD`:

```ts
// Haversine distance in km between (prev_lat, prev_lon) and (lat, lon) columns.
// Returns 0 when prev_lat / prev_lon is NULL (first row of a window).
export const haversineKmSql = Prisma.sql`
  CASE WHEN prev_lat IS NULL THEN 0
       ELSE 2 * 6371 * asin(sqrt(
         power(sin(radians(lat - prev_lat) / 2), 2) +
         cos(radians(prev_lat)) * cos(radians(lat)) *
         power(sin(radians(lon - prev_lon) / 2), 2)
       ))
  END
`;
```

Then in the `globalsRows` query at [lib/locations.ts:33-60](lib/locations.ts#L33-L60), replace the inlined `CASE WHEN prev_lat IS NULL THEN 0 ELSE 2 * 6371 * asin(...) END` with `${haversineKmSql}`. Do the same replacement inside the `bucketRows` query at [lib/locations.ts:62-92](lib/locations.ts#L62-L92) (but keep the `prev_bucket_key` guard — only the inner haversine expression is shared).

After editing the bucket query, the `CASE` becomes:
```sql
CASE
  WHEN prev_lat IS NULL OR prev_bucket_key IS NULL OR prev_bucket_key <> bucket_key THEN 0
  ELSE ${haversineKmSql_inner}
END
```

Since `haversineKmSql` already wraps in its own `CASE WHEN prev_lat IS NULL`, we need an inner fragment without the outer CASE for composition. Replace the fragment above with two exports:

```ts
// Inner haversine expression (no NULL guard) — for composing inside other CASEs.
export const haversineKmExprSql = Prisma.sql`
  2 * 6371 * asin(sqrt(
    power(sin(radians(lat - prev_lat) / 2), 2) +
    cos(radians(prev_lat)) * cos(radians(lat)) *
    power(sin(radians(lon - prev_lon) / 2), 2)
  ))
`;

// Haversine with NULL guard — safe to use directly in SUM().
export const haversineKmSql = Prisma.sql`
  CASE WHEN prev_lat IS NULL THEN 0 ELSE ${haversineKmExprSql} END
`;
```

In `globalsRows`: replace the inline CASE with `${haversineKmSql}`.
In `bucketRows`: replace the inner haversine expression (leaving the compound `CASE` with `prev_bucket_key` guards in place) with `${haversineKmExprSql}`.

- [ ] **Step 3: Run tests and typecheck**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add lib/locations.ts
git commit -m "refactor(locations): extract shared haversine SQL fragment"
```

---

### Task 2: Update route pre-flight mock expectations to accept total_km (test-only)

Before changing production SQL, adjust the existing test mocks so they return the new shape (`{ total, total_km }`). Run tests and confirm they still pass against the *unchanged* route (the route ignores `total_km` in the row; `Number(undefined)` is `NaN` but we'll handle it in Task 3). This step establishes the test contract we'll drive implementation against in later tasks.

Actually we do this in the opposite order: first add failing tests that assert the new pre-flight SQL shape and the new sampling behavior (Task 3). So skip this step — leave existing tests alone until Task 3 drives them.

This task is intentionally empty — kept as a numbering placeholder so reviewers see we considered it and rejected it. No files change. No commit. Proceed to Task 3.

- [ ] **Step 1: Confirm no action needed**

Run: `pnpm test`
Expected: all existing tests still PASS (baseline for Task 3 to modify).

---

### Task 3: Add failing test for distance-bucket sampling

Drive the new SQL with a unit test that asserts (a) the pre-flight query projects `total_km`, (b) the sampling query uses cumulative distance bucketing rather than `ROW_NUMBER() % stride`, and (c) the decimated response is returned.

**Files:**
- Modify: [tests/unit/api-locations-route.test.ts](tests/unit/api-locations-route.test.ts)

- [ ] **Step 1: Replace the existing "decimates when count exceeds threshold" test**

Open [tests/unit/api-locations-route.test.ts:68-93](tests/unit/api-locations-route.test.ts#L68-L93) and replace the whole `it("decimates when count exceeds threshold", ...)` block with:

```ts
it("uses distance-bucket sampling when count exceeds threshold and trajectory has length", async () => {
  queryRaw
    .mockResolvedValueOnce([{ total: BigInt(100000), total_km: 500 }])
    .mockResolvedValueOnce(
      Array.from({ length: 20000 }, (_, i) => ({
        id: i + 1,
        lat: 11 + i * 0.0001,
        lon: 31 + i * 0.0001,
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
  expect(body.boundsIgnored).toBe(false);
  expect(body.total).toBe(100000);
  expect(body.points.length).toBeLessThanOrEqual(20000);

  // Pre-flight count query now also returns total_km.
  const countSql = JSON.stringify(queryRaw.mock.calls[0]);
  expect(countSql).toContain("total_km");

  // Sampling query uses cumulative-distance bucketing, not ROW_NUMBER() % stride.
  const sampleSql = JSON.stringify(queryRaw.mock.calls[1]);
  expect(sampleSql).toContain("cum_km");
  expect(sampleSql).toContain("bucket");
  expect(sampleSql).not.toContain("ROW_NUMBER");
});
```

- [ ] **Step 2: Update the existing "skipBoundsIfSmall fallback" test mock**

At [tests/unit/api-locations-route.test.ts:119-149](tests/unit/api-locations-route.test.ts#L119-L149) the `"falls back to bounded flow when skipBoundsIfSmall=true but time-range count exceeds threshold"` test mocks a bounded pre-flight returning `{ total: BigInt(50000) }`. Change it to `{ total: BigInt(50000), total_km: 100 }` so the bounded branch has a trajectory length:

```ts
.mockResolvedValueOnce([{ total: BigInt(100000) }])
.mockResolvedValueOnce([{ total: BigInt(50000), total_km: 100 }])
```

(Only the second mock changes; the first is the unbounded time-range count which stays count-only.)

- [ ] **Step 3: Update the "under threshold" mock to include total_km**

At [tests/unit/api-locations-route.test.ts:49-66](tests/unit/api-locations-route.test.ts#L49-L66) change:
```ts
.mockResolvedValueOnce([{ total: BigInt(2) }])
```
to:
```ts
.mockResolvedValueOnce([{ total: BigInt(2), total_km: 0 }])
```

Also at [tests/unit/api-locations-route.test.ts:151-164](tests/unit/api-locations-route.test.ts#L151-L164) (the "keeps bbox when skipBoundsIfSmall is absent" test) change:
```ts
.mockResolvedValueOnce([{ total: BigInt(100) }])
```
to:
```ts
.mockResolvedValueOnce([{ total: BigInt(100), total_km: 1 }])
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm test -- api-locations-route`
Expected: FAIL on the new distance-bucket test (assertions about `total_km`, `cum_km`, `bucket`, absence of `ROW_NUMBER`). The other tests may or may not fail — they should still pass since they don't read `total_km`.

- [ ] **Step 5: Commit the failing test**

```bash
git add tests/unit/api-locations-route.test.ts
git commit -m "test(locations): assert distance-bucket sampling shape"
```

---

### Task 4: Implement distance-bucket sampling in the route

Replace the stride branch and extend the pre-flight query. Make Task 3's test pass.

**Files:**
- Modify: [app/api/locations/route.ts](app/api/locations/route.ts)

- [ ] **Step 1: Import the shared haversine fragment**

At the top of [app/api/locations/route.ts](app/api/locations/route.ts), change:
```ts
import { DECIMATION_THRESHOLD } from "@/lib/locations";
```
to:
```ts
import { DECIMATION_THRESHOLD, haversineKmSql } from "@/lib/locations";
```

- [ ] **Step 2: Extend the bounded pre-flight to return total_km**

Replace the count query at [app/api/locations/route.ts:94-99](app/api/locations/route.ts#L94-L99):

```ts
const countRows = await prisma.$queryRaw<{ total: bigint }[]>`
  SELECT COUNT(*)::bigint AS total
  FROM "LocationPoint"
  WHERE ${where};
`;
const total = Number(countRows[0]?.total ?? BigInt(0));
```

With:

```ts
const countRows = await prisma.$queryRaw<{ total: bigint; total_km: number | null }[]>`
  WITH lagged AS (
    SELECT lat, lon,
      LAG(lat) OVER (ORDER BY tst) AS prev_lat,
      LAG(lon) OVER (ORDER BY tst) AS prev_lon
    FROM "LocationPoint"
    WHERE ${where}
  )
  SELECT
    COUNT(*)::bigint AS total,
    COALESCE(SUM(${haversineKmSql}), 0)::double precision AS total_km
  FROM lagged;
`;
const total = Number(countRows[0]?.total ?? BigInt(0));
const totalKm = Number(countRows[0]?.total_km ?? 0);
```

- [ ] **Step 3: Replace the stride decimation branch with distance-bucket sampling**

Replace lines [app/api/locations/route.ts:101-120](app/api/locations/route.ts#L101-L120) (the `if (total > DECIMATION_THRESHOLD)` block) with:

```ts
const STATIONARY_EPSILON_KM = 0.001;

if (total > DECIMATION_THRESHOLD) {
  if (totalKm < STATIONARY_EPSILON_KM) {
    // Stationary trajectory — distance bucketing would collapse to one point.
    // Fall back to stride so the timeline still shows something.
    const stride = Math.ceil(total / DECIMATION_THRESHOLD);
    const rows = await prisma.$queryRaw<PointRow[]>`
      SELECT ${selectCols}
      FROM (
        SELECT ${selectCols}, ROW_NUMBER() OVER (ORDER BY tst) AS rn
        FROM "LocationPoint"
        WHERE ${where}
      ) AS sub
      WHERE (rn - 1) % ${stride} = 0
      ORDER BY tst;
    `;

    return NextResponse.json({
      points: rows.map(serializeRow),
      decimated: true,
      boundsIgnored: false,
      total,
    });
  }

  const bucketKm = totalKm / DECIMATION_THRESHOLD;
  const rows = await prisma.$queryRaw<PointRow[]>`
    WITH lagged AS (
      SELECT id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel,
        LAG(lat) OVER (ORDER BY tst) AS prev_lat,
        LAG(lon) OVER (ORDER BY tst) AS prev_lon
      FROM "LocationPoint"
      WHERE ${where}
    ),
    ordered AS (
      SELECT id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel,
        SUM(${haversineKmSql}) OVER (ORDER BY tst) AS cum_km
      FROM lagged
    ),
    bucketed AS (
      SELECT id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel,
        floor(cum_km / ${bucketKm})::bigint AS bucket,
        LAG(floor(cum_km / ${bucketKm})::bigint) OVER (ORDER BY tst) AS prev_bucket
      FROM ordered
    )
    SELECT ${selectCols}
    FROM bucketed
    WHERE prev_bucket IS NULL OR bucket <> prev_bucket
    ORDER BY tst;
  `;

  return NextResponse.json({
    points: rows.map(serializeRow),
    decimated: true,
    boundsIgnored: false,
    total,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- api-locations-route`
Expected: all tests in this file PASS, including the new `"uses distance-bucket sampling..."` case.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: full suite PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/locations/route.ts
git commit -m "feat(locations): distance-bucket sampling for dense ranges"
```

---

### Task 5: Add stationary-fallback test

Lock in the stationary fallback with an explicit test so later refactors can't silently remove it.

**Files:**
- Modify: [tests/unit/api-locations-route.test.ts](tests/unit/api-locations-route.test.ts)

- [ ] **Step 1: Add the failing test** (will actually pass since Task 4 already implemented it; this step is for regression safety)

Append inside the `describe("GET /api/locations", ...)` block:

```ts
it("falls back to stride sampling when trajectory is stationary", async () => {
  queryRaw
    .mockResolvedValueOnce([{ total: BigInt(100000), total_km: 0 }])
    .mockResolvedValueOnce(
      Array.from({ length: 20000 }, (_, i) => ({
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
  expect(body.points.length).toBeLessThanOrEqual(20000);

  const sampleSql = JSON.stringify(queryRaw.mock.calls[1]);
  // Stationary branch uses stride (ROW_NUMBER), not distance buckets.
  expect(sampleSql).toContain("ROW_NUMBER");
  expect(sampleSql).not.toContain("cum_km");
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test -- api-locations-route`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/api-locations-route.test.ts
git commit -m "test(locations): stationary trajectory falls back to stride"
```

---

### Task 6: Lint

- [ ] **Step 1: Run ESLint on the changed files**

Run: `pnpm exec eslint app/api/locations/route.ts lib/locations.ts tests/unit/api-locations-route.test.ts`
Expected: no errors.

If errors appear: fix them. Re-run. Commit the lint fixes as a separate commit with message `chore: lint`.

---

## Self-Review

**Spec coverage:**
- Adaptive `D = totalKm / TARGET_POINTS` → Task 4, Step 3 (`const bucketKm = totalKm / DECIMATION_THRESHOLD`).
- SQL filter with two CTEs and cumulative distance → Task 4, Step 3 query.
- Pre-flight returns `total_km` → Task 4, Step 2.
- `total <= DECIMATION_THRESHOLD` skips filtering → unchanged existing code after the replaced block.
- Stationary fallback on `total_km < epsilon` → Task 4, Step 3 (`STATIONARY_EPSILON_KM = 0.001`) and Task 5 test.
- Response shape unchanged → Task 4, Step 3 returns the same `{ points, decimated, boundsIgnored, total }`.
- Shared haversine SQL fragment → Task 1.
- Tests for mixed / stationary / below-threshold → Tasks 3 and 5 (mocked, so they assert SQL shape rather than real distributions; spec's note that distribution verification is e2e-level is acknowledged).

**Placeholder scan:** None — every step has exact code or exact commands.

**Type consistency:** `haversineKmSql` / `haversineKmExprSql` introduced in Task 1 and imported in Task 4. `total_km` column naming consistent between pre-flight query, mock values, and test assertions. `PointRow` type used unchanged from existing code.

No gaps found.

---

## Execution Handoff

Plan complete and saved to [docs/superpowers/plans/2026-04-14-distance-based-downsampling.md](docs/superpowers/plans/2026-04-14-distance-based-downsampling.md). Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
