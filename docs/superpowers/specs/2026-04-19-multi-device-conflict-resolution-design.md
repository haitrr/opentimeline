# Multi-Device Conflict Resolution

**Date:** 2026-04-19

## Problem

When a user carries one device and leaves another at home, the timeline merges location points from both devices, producing phantom travel lines between the two locations. There is currently no way to tell the app which device's data to trust for a given time range.

## Solution Overview

- **Conflict detection** runs on the frontend after location points are fetched
- **Resolution** is expressed as `DeviceFilter` records: a time range + the set of device IDs to include
- **Filters are persisted** in the database and applied server-side at query time
- **Non-destructive**: raw location data is never modified; removing a filter restores original data

---

## Database

### New table: `DeviceFilter`

```prisma
model DeviceFilter {
  id        String   @id @default(cuid())
  fromTime  DateTime
  toTime    DateTime
  deviceIds String[]
  label     String?
  createdAt DateTime @default(now())
}
```

No foreign keys to users or devices — kept simple, single-user app.

---

## Backend

### Query changes — `/api/locations`

On each request the server loads all `DeviceFilter` records and checks for overlap with the requested time range. For any sub-range covered by a filter, the query restricts `deviceId IN filter.deviceIds`. Outside filtered ranges all device points are returned unchanged.

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/device-filters` | Return all filters |
| POST | `/api/device-filters` | Create a filter `{ fromTime, toTime, deviceIds, label? }` |
| DELETE | `/api/device-filters/:id` | Delete a filter |

---

## Frontend: Conflict Detection

After location points are fetched, group points by `deviceId`. Bucket time into fixed windows (5 minutes). For each bucket, if two or more devices have points and their median positions are more than a configurable distance threshold apart (default: 200 m), mark that bucket as a conflict. Merge adjacent conflicting buckets into a single conflict range.

**Output:** an array of `{ fromTime, toTime, deviceIds: string[] }` conflict ranges, computed entirely in the client, never stored.

---

## Frontend: UI

### Timeline conflict indicators

Conflicted time ranges are rendered as a highlighted band (orange) on the timeline bar. Clicking the band opens a resolution panel pre-filled with:
- The detected time range (`fromTime` / `toTime`)
- A device selector listing all devices active in that range
- A "Save filter" button — POSTs a new `DeviceFilter`

### Sidebar — Conflicts section

Two sub-sections:

1. **Unresolved conflicts** — detected on frontend, no filter covers them yet. Each shows the time range, involved devices, and a "Resolve" button that opens the resolution panel.
2. **Active filters** — fetched from `GET /api/device-filters`. Each shows the time range, selected devices, optional label, and a delete button.

### Map indicator

When the currently viewed time range is covered by an active filter, a subtle badge displays "Filtered: [device IDs]" so the user is aware they're seeing filtered data.

---

## Data Flow

```
Page load
  → GET /api/device-filters          (load stored filters)
  → GET /api/locations?...           (server applies filters to query)
  → frontend groups points by device
  → conflict detection runs          (pure client computation)
  → conflicts rendered on timeline + sidebar

User clicks conflict → resolution panel → selects devices → Save
  → POST /api/device-filters
  → refetch /api/locations           (now filtered)
  → conflict clears from unresolved list
```

---

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| Bucket window | 5 min | Time window for grouping points during conflict detection |
| Distance threshold | 200 m | Minimum distance between device clusters to flag a conflict |

These can be hardcoded constants initially; no UI needed.

---

## Testing

- Unit tests for conflict detection function (pure function, easy to test with mock point arrays)
- Unit tests for filter application logic in `/api/locations`
- E2e: create a filter, verify filtered points are excluded, delete filter, verify points return
