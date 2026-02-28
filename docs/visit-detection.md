# Visit Detection

Visit detection analyzes location history to identify time periods spent at a place. There are two detection modes: **known visits** (at user-defined places) and **unknown visits** (clusters of points not associated with any place).

Detection is triggered manually via the "Detect visits" button in the settings menu, or automatically when a new place is created.

---

## Configuration

All detection thresholds are stored in the database (`AppSettings` table, single row) and configurable via **Settings → Visit detection** in the UI. Changes take effect on the next detection run.

**API:** `GET /api/settings`, `PUT /api/settings`

---

## Known Visit Detection

**Source:** [lib/detectVisits.ts](../lib/detectVisits.ts)
**API:** `POST /api/visits/detect`

Detects visits to existing places by grouping nearby location points into sessions.

### Algorithm

1. **Filter points** — Find all `LocationPoint` records within the place's radius using the Haversine formula.
2. **Group into sessions** — Walk through the points chronologically. If the gap between consecutive nearby points exceeds the session gap threshold *and* there is evidence the person left (a point outside the radius recorded within that gap), start a new session. Otherwise, continue the current session (the gap is treated as time indoors with no GPS).
3. **Validate duration** — Discard sessions shorter than the minimum dwell time. Also require at least one point outside the radius recorded within the post-departure evidence window after the session ends, confirming the person actually departed.
4. **Deduplicate** — Skip any candidate that overlaps an existing visit (suggested or confirmed).
5. **Resolve conflicts** — When multiple places overlap in time, keep only the visit whose centroid is closest to its place.

### Key Functions

| Function | Purpose |
|---|---|
| `computeCandidateVisitsForPlace()` | Core grouping algorithm |
| `detectCandidateVisitsForPlace()` | Fetches points and runs grouping for one place |
| `selectClosestCandidatesPerTimeRange()` | Resolves overlapping candidates across places |
| `detectVisitsForPlace()` | Creates visit suggestions for one place |
| `reconcileVisitSuggestionsForPlace()` | Re-runs detection when a place's radius changes |
| `detectVisitsForAllPlaces()` | Batch entry point — fetches all points once, processes all places |

### Thresholds

All configurable via Settings → Visit detection → Known places.

| Parameter | Default | Description |
|---|---|---|
| Time gap to split sessions | 15 min | Gap between consecutive nearby points that triggers a session split (if leaving evidence exists) |
| Minimum dwell time | 15 min | Sessions shorter than this are discarded |
| Post-departure evidence window | 15 min | A point outside the place radius must appear within this window after the last session point to confirm departure |
| Day buffer for point queries | ±5 days | Fixed buffer applied when fetching points for a date range (not configurable) |

---

## Unknown Visit Detection

**Source:** [lib/detectUnknownVisits.ts](../lib/detectUnknownVisits.ts)
**API:** `POST /api/unknown-visits/detect`

Finds clusters of location points that do not fall within any known place, and surfaces them as unknown visit suggestions.

### Algorithm

1. **Build dwell clusters** — Walk through all points chronologically. Add each point to the current cluster if it is within the cluster radius of the cluster center and the time gap is within the session gap threshold (or there is no evidence of leaving during the gap). Otherwise start a new cluster. The cluster center is updated incrementally as points are added.
2. **Filter by dwell time** — Discard clusters with total dwell time below the minimum dwell time.
3. **Exclude known places** — Remove clusters whose center falls within any existing place's radius.
4. **Exclude boundary clusters** — Remove clusters that span outside the detection date range.
5. **Deduplicate** — Skip any cluster that overlaps an existing unknown visit suggestion.
6. **Persist** — Save remaining clusters as `UnknownVisitSuggestion` records.

### Thresholds

All configurable via Settings → Visit detection → Unknown places.

| Parameter | Default | Description |
|---|---|---|
| Cluster radius | 50 m | Points within this distance of a cluster's center are grouped into it |
| Time gap to split clusters | 15 min | Gap between consecutive points that triggers a new cluster (if leaving evidence exists) |
| Minimum dwell time | 15 min | Clusters shorter than this are discarded |

---

## Visit Period Detection

**API:** `GET /api/visits/detect-periods?lat=&lon=&radiusM=&rangeStart=&rangeEnd=`

**Source:** [app/api/visits/detect-periods/route.ts](../app/api/visits/detect-periods/route.ts)

A read-only variant used by the UI. Given a coordinate and radius, it groups location points into time periods using the same session logic and returns arrival/departure times with point counts. Used to preview historical visit periods when selecting a location for a new place. Uses hardcoded 15-minute defaults (not affected by settings).

---

## Data Models

```
LocationPoint        id, lat, lon, recordedAt, acc, batt, vel, …
Place                id, name, lat, lon, radius (meters, default 50)
Visit                id, placeId, arrivalAt, departureAt, status (suggested | confirmed | rejected)
UnknownVisitSuggestion  id, lat, lon, arrivalAt, departureAt, pointCount, status
AppSettings          id, sessionGapMinutes, minDwellMinutes, postDepartureMinutes,
                     unknownClusterRadiusM, unknownSessionGapMinutes, unknownMinDwellMinutes
```

---

## Geolocation Utilities

**Source:** [lib/geo.ts](../lib/geo.ts)

| Function | Purpose |
|---|---|
| `haversineKm()` | Distance between two coordinates |
| `hasEvidenceOfLeavingInGap()` | Binary search over a time gap to check if any point falls outside a radius |
| `totalDistanceKm()` | Sum of distances across a sequence of points |

`hasEvidenceOfLeavingInGap()` is the key function used to decide whether a gap between nearby points represents time spent indoors (no split) or an actual departure and return (split into two sessions).

---

## UI

- **[components/VisitSuggestionsPanel.tsx](../components/VisitSuggestionsPanel.tsx)** — Lists suggested known visits. Actions: Confirm, Reject, Create Place.
- **[components/UnknownVisitSuggestionsPanel.tsx](../components/UnknownVisitSuggestionsPanel.tsx)** — Lists unknown visit suggestions. Actions: Create Place, Edit times, Dismiss, Delete.
- **[components/SettingsModal.tsx](../components/SettingsModal.tsx)** — Settings modal with Visit detection tab for configuring all thresholds above.
- Detection is triggered from the settings menu in **[app/timeline/layout.tsx](../app/timeline/layout.tsx)**, which calls both detect endpoints and invalidates React Query caches.
