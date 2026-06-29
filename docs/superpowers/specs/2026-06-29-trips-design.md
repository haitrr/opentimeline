# Trips Feature Design

**Date:** 2026-06-29

## Overview

Trips are named time-range bookmarks on top of location history. The primary use case is saving a travel period (e.g., "Christmas in San Francisco — Dec 23–26") so you can quickly navigate back to it and see all visits and stats from that time.

Trips support two creation paths: manual (user picks name + dates) and auto-detected (geo-clustering over location points surfaces candidate trip periods for user review).

---

## Data Model

One new Prisma model added to `schema.prisma`:

```prisma
model Trip {
  id        Int      @id @default(autoincrement())
  name      String
  startDate DateTime
  endDate   DateTime
  createdAt DateTime @default(now())
}
```

No foreign keys to visits or places. Visits for a trip are queried on the fly using the trip's `startDate`/`endDate` as a date range filter — the same mechanism already used by the existing day/week/month/year/custom range views.

Overlapping trips are allowed. No uniqueness constraints on name or dates.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/trips` | List all trips, ordered by `startDate` descending |
| `POST` | `/api/trips` | Create a trip manually — body: `{ name, startDate, endDate }` |
| `PUT` | `/api/trips/:id` | Update name or dates |
| `DELETE` | `/api/trips/:id` | Delete a trip |
| `POST` | `/api/trips/detect` | Run geo-clustering and return suggested trips (not saved) |

### Detect endpoint

`POST /api/trips/detect` clusters location points by geographic proximity across days, identifies periods where activity is concentrated in an area distinct from the user's usual location patterns, and returns candidate objects:

```json
[
  {
    "name": "San Francisco, CA · Dec 2024",
    "startDate": "2024-12-23T00:00:00Z",
    "endDate": "2024-12-26T23:59:59Z"
  }
]
```

The name is auto-generated from reverse geocoding the cluster center + the month/year. Returns an empty array if there is insufficient location data. Results are not persisted — the user reviews and saves the ones they want via `POST /api/trips`.

### Validation

- `startDate` must be before `endDate` — API returns 400 otherwise
- `name` must be non-empty

---

## UI

### Trips tab (activity bar)

A new tab added to the left activity bar alongside Places, Suggestions, and Unknown Places.

Contents:
- **"Detect trips" button** at the top — runs the detect endpoint and shows returned suggestions in a review list. Each suggestion shows name and date range; user can confirm (saves via `POST /api/trips`) or dismiss.
- **"New trip" button** — opens a simple form with name field and date range picker. Saves via `POST /api/trips`.
- **Trip list** — saved trips as cards, ordered by start date descending. Each card shows:
  - Trip name
  - Date range (e.g., "Dec 23 – Dec 26, 2024")
  - Visit count (queried on the fly from visits in that range)
  - Clicking the card navigates the timeline to that date range (sets `startDate`/`endDate` as the active custom range)
  - Edit and delete actions per card

### Date range picker integration

When the user opens the existing date range selector, a "Trips" section appears below the standard options (day / week / month / year / custom / all), listing all saved trips as quick-picks. Selecting a trip sets the timeline range to that trip's `startDate`/`endDate`.

---

## Geo-Clustering Algorithm (detect)

The detection algorithm runs server-side:

1. Fetch all location points across the full history.
2. Group points by day.
3. Compute a daily centroid (average lat/lon for each day with points).
4. Cluster consecutive days whose centroids are within a configurable radius of each other (default: 50 km).
5. Filter clusters to those lasting 2+ days.
6. Compare each cluster's centroid against the user's "usual" area (median centroid across all days). Clusters more than a threshold distance away (default: 100 km) are surfaced as trip candidates.
7. Reverse geocode each cluster centroid to generate the candidate name.

Parameters are fixed defaults — no user-facing configuration needed at this stage.

---

## Testing

- **Unit tests (Vitest):** geo-clustering algorithm — cover cases: single-day clusters (filtered out), multi-day clusters within home area (filtered out), multi-day clusters away from home (surfaced), clusters spanning timezone boundaries.
- **API integration tests (Vitest):** all five endpoints — CRUD operations, 400 on invalid date range, empty array response from detect when no data.
- **E2E tests (Playwright):** create a trip manually and verify it appears in the trips tab and the date range picker; click a trip in the date range picker and verify the timeline navigates to the correct date range.
