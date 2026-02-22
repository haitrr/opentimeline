# GPX Import

OpenTimeline can import location history from GPX files as an alternative to the live OwnTracks webhook.

## How to use

1. Open any day on the timeline (`/timeline/YYYY-MM-DD`).
2. Click **Import GPX** in the top-left sidebar.
3. Select a `.gpx` file from your device.
4. The button shows progress inline (`Parsing…` → `Importing…`), then reports how many points were added.
5. The map and timeline refresh automatically when new points are imported.

## Supported GPX elements

| GPX element / attribute | Stored as |
|--------------------------|-----------|
| `lat` / `lon` attributes on `<trkpt>` or `<wpt>` | `lat` / `lon` |
| `<time>` | `tst` (Unix timestamp) and `recordedAt` |
| `<ele>` | `alt` (altitude, metres) |
| `<speed>` (extension) | `vel` (converted from m/s to km/h) |
| `<course>` (extension) | `cog` (course over ground, degrees) |

Standard GPX fields that have no equivalent in the data model (`acc`, `batt`, `tid`) are stored as `null`. All imported points are tagged with `trigger = "gpx-import"`.

Both track points (`<trkpt>`) and waypoints (`<wpt>`) are processed. Route points (`<rtept>`) are not included because they represent planned routes rather than recorded tracks.

## Deduplication

Points are deduplicated on import using the Unix timestamp (`tst`). If a point with the same timestamp already exists in the database, it is silently skipped. Re-importing the same file is therefore safe.

## Implementation details

| File | Role |
|------|------|
| [`lib/parseGpx.ts`](../lib/parseGpx.ts) | Client-side parser — uses the browser's native `DOMParser` to extract trackpoints from the GPX XML |
| [`app/api/import/route.ts`](../app/api/import/route.ts) | `POST /api/import` — receives parsed points as JSON, deduplicates against the DB, and bulk-inserts new records via Prisma |
| [`components/ImportGpxButton.tsx`](../components/ImportGpxButton.tsx) | React client component — file picker, status feedback, and calls `router.refresh()` after a successful import |

### Data flow

```
User selects .gpx file
        ↓
parseGpx() (browser, DOMParser)
        ↓
POST /api/import  { points: GpxPoint[] }
        ↓
Deduplicate against existing tst values
        ↓
prisma.locationPoint.createMany()
        ↓
router.refresh() → page re-fetches /api/locations
```
