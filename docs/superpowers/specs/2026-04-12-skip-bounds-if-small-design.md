# Skip bbox filter when the time range has few points

**Date:** 2026-04-12
**Status:** Design

## Problem

`GET /api/locations` always filters by the viewport bounding box in addition to
the time range. When the selected time range contains few points overall,
panning or zooming the map changes the returned set even though the user has
not changed the time window. Points appear and disappear as the viewport moves,
which is confusing when the entire time range would fit on screen anyway.

## Goal

When the time range is small enough that all its points can be returned without
decimation, ignore the viewport bounding box and return every point in the time
range. The viewport filter remains useful only when the time range is large
enough that we would otherwise decimate.

## API change

`GET /api/locations` accepts a new query param:

- **`skipBoundsIfSmall`** — boolean, default `false`. When `true`, the route
  first evaluates the time range without the bbox and may omit the bbox filter
  from the result query.

Existing params (`start`, `end`, `minLat`, `maxLat`, `minLon`, `maxLon`,
`limit`, `cursor`) are unchanged. `minLat/maxLat/minLon/maxLon` remain required
so that the fallback path can still apply them.

### Behaviour

When `skipBoundsIfSmall=true`:

1. Count points in the time range only (no bbox):
   ```sql
   SELECT COUNT(*) FROM "LocationPoint"
   WHERE "recordedAt" BETWEEN $start AND $end;
   ```
2. If `count <= DECIMATION_THRESHOLD` (20,000), run the point query **without**
   the bbox filter. Pagination with `cursor` and `limit` behaves as today. No
   decimation.
3. If `count > DECIMATION_THRESHOLD`, fall back to the existing bounded flow:
   count within the bbox, then either decimate (above threshold within bbox) or
   paginate within the bbox.

When `skipBoundsIfSmall` is omitted or `false`: behaviour is unchanged.

### Response shape

Add one field to the JSON response:

- **`boundsIgnored`** — boolean. `true` only when the unbounded branch is
  taken; `false` in every other case (default param, fallback-to-bounded, and
  decimated).

Existing fields (`points`, `nextCursor`, `decimated`, `total`) are unchanged.
`total` reflects the count used to drive the decision: unbounded count on the
unbounded branch, bounded count on the bounded branch.

## Frontend change

`components/map/MapWrapper.tsx` sets `skipBoundsIfSmall=true` on every
`/api/locations` request. No other frontend changes. `boundsIgnored` is not
consumed by the UI; it exists for debuggability and tests.

## Edge cases

- **Pagination:** the decision (bounded vs unbounded) is recomputed per
  request. Because the count depends only on the time range, the decision is
  stable across cursor pages of the same time range, so cursors from one page
  work on the next.
- **Decimation only in the bounded fallback.** On the unbounded branch,
  `count <= DECIMATION_THRESHOLD` by construction, so decimation is never
  needed.
- **Required bbox params:** still required. Validation is unchanged, which
  keeps the contract simple and avoids a second set of error cases.

## Testing

TDD with vitest. New cases in `tests/unit/api-locations-route.test.ts`:

1. `skipBoundsIfSmall=true` and unbounded count ≤ threshold → the point query
   runs without the bbox predicate; response has `boundsIgnored: true` and
   `decimated: false`.
2. `skipBoundsIfSmall=true` and unbounded count > threshold → falls back to
   the bounded flow; response has `boundsIgnored: false`. If the bounded count
   also exceeds the threshold, `decimated: true`.
3. `skipBoundsIfSmall` absent or `false` → existing behaviour; `boundsIgnored`
   is `false`; bbox predicate is present in the query.
4. Pagination on the unbounded branch: a `cursor` param combined with
   `skipBoundsIfSmall=true` still runs without bbox and advances correctly.

Assertions on SQL use the existing `$queryRaw` mock style (inspect the
`Prisma.sql` fragments passed).

No e2e change required — the existing Playwright map test continues to
exercise the frontend path.

## Out of scope

- Changing `DECIMATION_THRESHOLD` or `MAX_PAGE_LIMIT`.
- Making the bbox params optional.
- Altering `/api/locations/bounds` or `/api/places`.
- Any UI treatment that surfaces `boundsIgnored` to the user.
