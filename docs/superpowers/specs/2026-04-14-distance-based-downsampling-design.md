# Distance-Based Downsampling for Location Points

## Problem

The `/api/locations` endpoint currently downsamples via stride decimation: `ROW_NUMBER() OVER (ORDER BY tst)` then keep every Nth row. This produces poor visual results because it ignores the geometry of the trajectory:

- Dense stationary clusters (e.g. phone pinging at a desk) are preserved proportionally, wasting the point budget on a single location.
- Sparse fast-moving segments (e.g. highway driving) drop a constant fraction of points, leaving straight lines under-sampled and corners lost.
- The resulting map line looks uneven and misrepresents paths.

## Goal

Replace stride decimation with **distance-bucket sampling**: keep one point per fixed distance interval along the trajectory, so the rendered line is evenly distributed along the actual path regardless of recording cadence.

## Non-Goals

- Temporal sampling (keeping points based on elapsed time). Fast travel with time-based sampling produces visually wrong sparse lines.
- Changing the response shape of `/api/locations`.
- Touching the `skipBoundsIfSmall` unbounded path (that branch already returns unfiltered data below the threshold).
- Line simplification algorithms like Douglas-Peucker (different problem; we want uniform density, not minimal vertices).

## Approach

### Adaptive distance threshold

Keep the existing output budget of `DECIMATION_THRESHOLD = 20_000` points. Pick the distance gap adaptively so the output size lands near the budget regardless of trajectory length:

```
D = totalKm / TARGET_POINTS
```

Where `totalKm` is the sum of haversine distances between consecutive points in the query range. This mirrors the existing total-distance computation in `lib/locations.ts:50-58`.

### SQL filter

A single query with two CTEs:

```sql
WITH ordered AS (
  SELECT id, lat, lon, tst, recordedAt, acc, batt, tid, alt, vel,
    SUM(
      CASE WHEN prev_lat IS NULL THEN 0
           ELSE 2 * 6371 * asin(sqrt(
             power(sin(radians(lat - prev_lat) / 2), 2) +
             cos(radians(prev_lat)) * cos(radians(lat)) *
             power(sin(radians(lon - prev_lon) / 2), 2)
           ))
      END
    ) OVER (ORDER BY tst) AS cum_km
  FROM (
    SELECT ..., LAG(lat) OVER (ORDER BY tst) AS prev_lat,
                LAG(lon) OVER (ORDER BY tst) AS prev_lon
    FROM "LocationPoint" WHERE <where>
  ) lagged
),
bucketed AS (
  SELECT *,
    floor(cum_km / $D)::bigint AS bucket,
    LAG(floor(cum_km / $D)::bigint) OVER (ORDER BY tst) AS prev_bucket
  FROM ordered
)
SELECT id, lat, lon, tst, recordedAt, acc, batt, tid, alt, vel
FROM bucketed
WHERE prev_bucket IS NULL OR bucket <> prev_bucket
ORDER BY tst;
```

This keeps the first point in each `floor(cum_km / D)` bucket, yielding points spaced roughly `D` km apart along the actual path.

### Pre-flight query

Before running the filter, a single lightweight query in the `where` range returns both `total_points` and `total_km` (same pattern as `lib/locations.ts:33-60`). Then:

- If `total_points <= DECIMATION_THRESHOLD`: skip filtering, return all rows (current behavior).
- Else if `total_km` is 0 or below a small epsilon (e.g. `< 0.001` km): fall back to stride decimation. Distance-bucketing collapses a stationary trace into bucket 0 and would return one point.
- Else: compute `D = total_km / DECIMATION_THRESHOLD` and run the distance-bucket query.

### Response shape

No changes. `{ points, decimated, boundsIgnored, total }` — `decimated: true` whenever the filter ran (distance-bucket or stride fallback).

## Files Affected

- [app/api/locations/route.ts](app/api/locations/route.ts) — replace the stride branch at [app/api/locations/route.ts:101-120](app/api/locations/route.ts#L101-L120). Pre-flight count query at [app/api/locations/route.ts:94-99](app/api/locations/route.ts#L94-L99) gains a `total_km` column.
- [lib/locations.ts](lib/locations.ts) — extract the haversine expression into a shared `Prisma.sql` fragment so the route and stats use the same formula. `DECIMATION_THRESHOLD` stays.
- [tests/unit/api-locations-route.test.ts](tests/unit/api-locations-route.test.ts) — update existing decimation tests; add cases for: stationary data (fallback), sparse highway-style data (even spacing preserved), mixed clustered+moving data (clusters collapse, curves stay dense).

## Testing

Unit tests (vitest) against a seeded Prisma test DB:

1. **Below threshold, no filter** — existing behavior, expect `decimated: false`.
2. **Above threshold, mixed trajectory** — seed points where half are clustered in one spot and half are spread along a line. Assert:
   - `decimated: true`
   - `points.length <= DECIMATION_THRESHOLD`
   - the cluster collapses to one or a few points (assert count in cluster bounds ≤ small constant)
   - the moving segment retains approximately uniform spacing (assert min/max gap ratio within tolerance).
3. **Above threshold, stationary** — all points at the same coords. Assert fallback to stride (not a single point). `decimated: true`, `points.length ≈ DECIMATION_THRESHOLD`.
4. **Above threshold, linear** — evenly spaced points along a line. Assert output is also evenly spaced and has ~`DECIMATION_THRESHOLD` points.

Follow the TDD workflow from `memory/feedback_tdd_vitest_playwright.md`: write failing tests first against the new behavior, then implement.

## Risks & Open Questions

- **Query cost.** The extra window functions add a sort and two passes. Current stride query already sorts by `tst`. Expect similar or slightly higher cost; validate on realistic data sizes (the repo has historical data for benchmarking).
- **Bucket overshoot.** Output size isn't guaranteed to hit exactly `TARGET_POINTS` — it depends on how points align with bucket boundaries. Expect ±10-20% variance, which is acceptable for map rendering. If variance turns out to be larger in practice, we can iterate by shrinking `D` slightly (e.g. `totalKm / (TARGET_POINTS * 1.1)`).
- **Epsilon for stationary fallback.** `total_km < 0.001` is a guess. Sanity check: any real trajectory over a 20k-point window that isn't "the user sat still" will easily exceed 1 meter.
