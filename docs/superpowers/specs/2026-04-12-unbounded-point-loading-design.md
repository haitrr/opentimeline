# Bounded point loading for stats and map

**Date:** 2026-04-12

## Problem

`getAllPoints()` in [lib/locations.ts:9-30](../../../lib/locations.ts#L9-L30) loads every `LocationPoint` row into server memory. It has two callers:

1. [app/timeline/[date]/page.tsx:35](../../../app/timeline/[date]/page.tsx#L35) — when `?range=all` is requested, every point is fetched solely to feed `computePeriodStats`, which returns aggregate stats (counts, total distance, duration, per-hour/day distance groups). Points are never rendered as a list.
2. [app/api/locations/route.ts:9](../../../app/api/locations/route.ts#L9) — when `?all=true` is passed, every point is serialized to JSON and shipped to [components/map/MapWrapper.tsx:75](../../../components/map/MapWrapper.tsx#L75), which plots them on a map.

Both paths are OOM risks. The dataset grows monotonically; the server and the browser have no defense.

## Goal

- Remove unbounded point loading from the stats path and the map path.
- Preserve existing UX: stats are correct at every range, the map renders the full-history view at acceptable fidelity.
- Server and client memory bounded by tunable constants, independent of dataset size.

## Non-goals

- Changing how visits, places, or unknown visits are fetched.
- Changing persistence or ingestion.
- Replacing Leaflet/MapLibre or the map rendering engine.
- Adding a "full fidelity at every zoom" guarantee. Decimation is acceptable at world zoom.

## Design

Three coordinated changes, labelled A/B/C to mirror the brainstorm.

### A. SQL aggregation for stats (server page)

**New function:** `getStatsForRange(start?: Date, end?: Date, groupBy: "hour" | "day"): Promise<DailyStats>` in [lib/locations.ts](../../../lib/locations.ts).

**Implementation:** single raw SQL query via `prisma.$queryRaw`, using Postgres window functions. Schema of the query:

```sql
WITH ordered AS (
  SELECT
    id,
    tst,
    "recordedAt",
    lat,
    lon,
    LAG(lat) OVER (ORDER BY tst) AS prev_lat,
    LAG(lon) OVER (ORDER BY tst) AS prev_lon
  FROM "LocationPoint"
  WHERE "recordedAt" BETWEEN $1 AND $2   -- omitted entirely for range=all
),
with_dist AS (
  SELECT
    *,
    CASE
      WHEN prev_lat IS NULL THEN 0
      ELSE 2 * 6371 * asin(sqrt(
        power(sin(radians(lat - prev_lat) / 2), 2) +
        cos(radians(prev_lat)) * cos(radians(lat)) *
        power(sin(radians(lon - prev_lon) / 2), 2)
      ))
    END AS step_km,
    to_char("recordedAt", $3) AS bucket_key        -- 'HH24' or 'YYYY-MM-DD'
  FROM ordered
)
SELECT
  bucket_key,
  MIN("recordedAt") AS bucket_start,
  SUM(step_km)      AS bucket_km,
  COUNT(*)          AS bucket_points
FROM with_dist
GROUP BY bucket_key
ORDER BY bucket_key;
```

A second lightweight query returns global aggregates:

```sql
SELECT
  COUNT(*)                                      AS total_points,
  MIN(tst)                                      AS first_tst,
  MAX(tst)                                      AS last_tst,
  COUNT(DISTINCT date_trunc('day', "recordedAt")) AS days_with_data
FROM "LocationPoint"
WHERE "recordedAt" BETWEEN $1 AND $2;
```

`getStatsForRange` assembles these into the existing `DailyStats` shape:

```ts
{
  totalPoints,
  totalDistanceKm,   // SUM of all bucket_km
  durationMinutes,   // (last_tst - first_tst) / 60
  daysWithData,
  groups: [{ key, label, points: [], distanceKm }, ...],
}
```

**Breaking change inside `DailyStats`:** `TimeGroup.points` is now always `[]`. No current consumer reads it:

- [components/DailyStats.tsx](../../../components/DailyStats.tsx) only reads `totalPoints`, `totalDistanceKm`, `durationMinutes`, `daysWithData`.
- `groups` is computed but not rendered anywhere. Verified via grep during brainstorm.

Rather than keep a vestigial field, **remove `TimeGroup.points` entirely** from `DailyStats`. Type becomes `{ key, label, distanceKm }`.

**Page wiring:** [app/timeline/[date]/page.tsx:31-42](../../../app/timeline/[date]/page.tsx#L31-L42) becomes:

```ts
const groupBy = rangeType === "day" ? "hour" : "day";
let stats: DailyStats;
if (rangeType === "all") {
  stats = await getStatsForRange(undefined, undefined, groupBy);
} else {
  const { start, end: rangeBoundEnd } = getRangeBounds(parsedDate, rangeType, end);
  rangeStart = start.toISOString();
  rangeEnd = rangeBoundEnd.toISOString();
  stats = await getStatsForRange(start, rangeBoundEnd, groupBy);
}
```

No points are loaded on the server for this page.

**Dead code removal (after parity tests pass — see Testing below):**

- Delete `getAllPoints` from [lib/locations.ts](../../../lib/locations.ts).
- Delete `computePeriodStats` and `computeDailyStats` from [lib/groupByHour.ts](../../../lib/groupByHour.ts). `DailyStats`, `TimeGroup`, and `SerializedPoint` types stay (used by map/sidebar).
- Delete `totalDistanceKm` from [lib/geo.ts](../../../lib/geo.ts). Grep confirms its only consumer is `computePeriodStats`; `haversineKm` (used by many callers) stays untouched.

### B. Viewport + decimation for `/api/locations`

**New endpoint contract:**

```
GET /api/locations?start&end&minLat&maxLat&minLon&maxLon&cursor&limit
```

- `start`, `end`: ISO timestamps, **required**.
- `minLat`, `maxLat`, `minLon`, `maxLon`: floats, **required**.
- `cursor`: integer point `id`, optional (defaults to beginning).
- `limit`: integer, optional (default 5000, max 10000).

**Removed:** `?all=true`, `?date=YYYY-MM-DD`.

The `date=YYYY-MM-DD` shape is used only in the README example and not by any live caller (grep confirmed). It is removed along with `all=true` to keep the endpoint single-purpose.

**Existing non-map caller:** [lib/visitCentroid.ts:8](../../../lib/visitCentroid.ts#L8) currently calls `/api/locations?start&end` without bounds. Verified: this is only used by `PlaceCreationModal` to compute a centroid from one unknown visit's points, and unknown visits have narrow time windows (minutes to hours). Two options:

1. Give centroid its own endpoint (`/api/unknown-visits/:id/centroid`) that computes centroid server-side.
2. Allow `/api/locations` to accept an optional `unbounded=true` with server-enforced max `limit` (e.g., 1000) and no viewport requirement, scoped to short time windows.

**Choice: option 1.** Cleaner separation, centroid is a scalar result not a point list, and the unknown-visit record already has `lat/lon/pointCount` — the centroid endpoint can compute `AVG(lat), AVG(lon)` directly for points within the visit window without ever shipping raw points to the client.

**Server behavior under the new contract:**

1. Count rows matching range + viewport (cheap with the existing `recordedAt` and lat/lon indexes — verify indexes exist; add if not).
2. If `count > DECIMATION_THRESHOLD` (default 20000):
   - Compute `N = ceil(count / DECIMATION_THRESHOLD)`.
   - Return `{ points: every Nth point by tst, nextCursor: null, decimated: true, total: count }`.
   - Implementation: `SELECT ... FROM (SELECT *, row_number() OVER (ORDER BY tst) AS rn FROM ...) WHERE rn % $N = 0 ORDER BY tst`.
3. If `count <= DECIMATION_THRESHOLD`:
   - Return one page of up to `limit` points with `id > cursor`, ordered by `id`.
   - `nextCursor` = last point's `id`, or `null` if fewer than `limit` rows were returned.
   - `decimated: false`, `total: count`.

**Response type:**

```ts
type LocationsPage = {
  points: SerializedPoint[];
  nextCursor: number | null;
  decimated: boolean;
  total: number;
};
```

**Validation:**

- Missing `start`, `end`, or any bounds param → 400.
- Invalid numeric params → 400.
- `limit` clamped to `[1, 10000]`.

### C. Cursor pagination in the map client

[components/map/MapWrapper.tsx:71-85](../../../components/map/MapWrapper.tsx#L71-L85) switches from `useQuery` to `useInfiniteQuery`:

```ts
const { data } = useInfiniteQuery<LocationsPage>({
  queryKey: ["locations", rangeStart, rangeEnd, mapBounds],
  enabled: mapBounds !== null && !!rangeStart && !!rangeEnd,
  queryFn: async ({ pageParam }) => {
    const params = new URLSearchParams({
      start: rangeStart!,
      end: rangeEnd!,
      minLat: String(mapBounds!.minLat),
      maxLat: String(mapBounds!.maxLat),
      minLon: String(mapBounds!.minLon),
      maxLon: String(mapBounds!.maxLon),
    });
    if (pageParam) params.set("cursor", String(pageParam));
    const res = await fetch(`/api/locations?${params}`);
    if (!res.ok) throw new Error("failed");
    return res.json();
  },
  getNextPageParam: (last) => last.nextCursor,
  initialPageParam: null as number | null,
});

const points = useMemo(
  () => data?.pages.flatMap((p) => p.points) ?? [],
  [data]
);
```

`useInfiniteQuery`'s `fetchNextPage` is called in a `useEffect` while `hasNextPage` and `!isFetchingNextPage`. React Query cancels in-flight pages automatically when `queryKey` changes (viewport pan/zoom).

**`range=all` handling on the client:** when `rangeType === "all"`, the page emits `rangeStart = "1970-01-01T00:00:00.000Z"` and `rangeEnd = new Date().toISOString()` so the map uses a single code path. The `isAll` branch in `MapWrapper` disappears. The `recordedAt BETWEEN $1 AND $2` predicate remains index-friendly for the degenerate unbounded case.

## Data flow

### Stats path
```
page.tsx ──► getStatsForRange(start, end, groupBy)
               │
               ├─► Postgres: windowed aggregate (1 query)
               └─► Postgres: global aggregate (1 query)
               │
               ◄── DailyStats { totalPoints, totalDistanceKm, ..., groups: [{key,label,distanceKm}] }
                 │
                 └─► DailyStats component renders scalars
```

### Map path
```
MapWrapper ──► useInfiniteQuery (gated on mapBounds)
                │
                ├─► GET /api/locations?start&end&bounds&cursor=...
                │       ├─ count query
                │       ├─ if > threshold: decimated snapshot (one page, nextCursor=null)
                │       └─ else: cursor page
                │
                └─► appends pages to flattened points array; triggers fetchNextPage while hasNextPage
```

## Error handling

- **Stats:** Postgres errors bubble to the Next.js page as 500. No new error surface.
- **Locations API:** 400 on missing/invalid params, 500 on DB error. Client's `useInfiniteQuery` shows existing empty-map state on error (no regression; current code returns `[]` on non-ok).
- **Centroid endpoint:** 404 if unknown visit not found, 500 on DB error.

## Testing

TDD per [CLAUDE.md](../../../CLAUDE.md). Write failing tests first.

### Unit (vitest)

1. `getStatsForRange` (new test file `tests/unit/getStatsForRange.test.ts`):
   - Empty result set → zero stats, empty groups.
   - Single day of seeded points → groups by hour, per-hour distance matches a fresh-computed haversine sum over the same seeded points.
   - Multi-day range with `groupBy: "day"` → daily groups, `daysWithData` correct.
   - `start`/`end` undefined → scans all points.
   - Parity check: for a seeded fixture, assert `totalPoints`, `totalDistanceKm` (within 1e-6 km), `durationMinutes`, and `daysWithData` equal values computed in-test from the same seeded array via the pre-existing `computePeriodStats`. This test runs against the old implementation before `computePeriodStats` is deleted; once parity is proven and merged, a follow-up commit in the same PR removes `computePeriodStats` along with the parity check (the remaining assertions above stand alone).

2. `/api/locations` route (new test file `tests/unit/api-locations-route.test.ts`):
   - Missing `start` → 400.
   - Missing bounds → 400.
   - Small result (under threshold) → pagination with `nextCursor`, `decimated: false`.
   - Large result (seeded to exceed threshold, or threshold lowered for the test) → `decimated: true`, `nextCursor: null`, point count ≈ threshold.
   - `cursor` honored: second page has no overlap with first.
   - Viewport filter honored: points outside bounds are excluded.

3. New centroid endpoint test (`tests/unit/api-unknown-visit-centroid.test.ts`):
   - Returns `{ lat, lon }` averaged over points in the unknown visit's time window.
   - 404 when unknown visit id does not exist.

### E2E (playwright)

1. `tests/e2e/timeline-range-all.spec.ts`: load `/timeline/today?range=all` with a large seeded dataset; page renders stats within a timeout; no server 500.
2. `tests/e2e/map-progressive-load.spec.ts`: load map at world zoom with large dataset; confirm points appear progressively (multiple network calls observed) and eventually render decimated set; pan to a dense region, confirm finer-detail points load.

## Tunable constants

Defined in [lib/locations.ts](../../../lib/locations.ts), exported for tests to override:

- `DECIMATION_THRESHOLD = 20_000`
- `DEFAULT_PAGE_LIMIT = 5_000`
- `MAX_PAGE_LIMIT = 10_000`

## Out-of-scope follow-ups

- Smarter decimation (time-bucketed averaging, Douglas-Peucker) — current uniform sampling is good enough for dot plots.
- Server-Sent Events or HTTP/2 push for streaming pages — cursor pagination is sufficient for now.
- Indexing audit: verify `LocationPoint` has a composite index `(recordedAt, lat, lon)` for viewport queries; add if missing. Flag during implementation but not a blocker here.
