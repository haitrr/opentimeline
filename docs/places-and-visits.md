# Places & Visits

## Overview

Places are named points of interest (POIs) pinned on the map. The system automatically detects when your location history shows you spending time near a place and creates **visit suggestions** for you to confirm or reject.

---

## Creating a Place

1. Open the timeline and navigate to the map view.
2. Click anywhere on the map to drop a pin.
3. A modal appears — enter a **name** (required) and optionally adjust the **radius** (default: 50 meters).
4. Click **Create**. The place appears immediately on the map as an orange circle and in the **Places** panel in the sidebar.

Places are global — they are not tied to a specific date range and appear on the map regardless of which time period you are viewing.

---

## Visit Detection

When a place is created (or periodically in the background), the system scans all location points to find visits.

### Algorithm

1. All `LocationPoint` records are loaded and sorted by time.
2. Points within the place's **radius** are identified using the [Haversine formula](https://en.wikipedia.org/wiki/Haversine_formula).
3. Nearby points are grouped into **sessions**: a new session starts whenever the gap between two consecutive nearby points exceeds the **time window** (default: 15 minutes).
4. Each session that does not overlap an existing visit record becomes a **visit suggestion** with status `suggested`.

### Background Detection

- Detection runs **immediately** when a place is created.
- It also runs **every hour** in the background while the app is open (via a client-side polling interval).
- Manual trigger: `POST /api/visits/detect` runs detection for all places.

---

## Visit Suggestions Panel

Pending suggestions appear in the **Visit Suggestions** panel in the sidebar (below the Places panel). Each suggestion shows:

- The place name
- Arrival and departure times

### Actions

| Button | Effect |
|--------|--------|
| **Confirm** | Status changes to `confirmed`; the visit is counted against the place |
| **Reject** | Status changes to `rejected`; the suggestion is dismissed |

The badge on the panel header shows the number of pending suggestions.

---

## Managing Places

The **Places** panel in the sidebar lists all places with their radius and confirmed visit count. To delete a place, click the **✕** button next to it. Deleting a place also removes all associated visit records.

---

## Data Model

### Place

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary key |
| `name` | String | Display name |
| `lat` / `lon` | Float | Center coordinates |
| `radius` | Float | Detection radius in meters (default 50) |
| `createdAt` | DateTime | Creation timestamp |

### Visit

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary key |
| `placeId` | Int | Foreign key → Place |
| `arrivalAt` | DateTime | Start of the visit session |
| `departureAt` | DateTime | End of the visit session |
| `status` | String | `suggested` \| `confirmed` \| `rejected` |
| `createdAt` | DateTime | When the suggestion was created |

---

## API Reference

### Places

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/places` | List all places with visit counts |
| `POST` | `/api/places` | Create a place `{ name, lat, lon, radius? }` |
| `DELETE` | `/api/places/:id` | Delete a place and its visits |

### Visits

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/visits?status=suggested` | List visits (filter by status) |
| `PUT` | `/api/visits/:id` | Update status `{ status: "confirmed" \| "rejected" }` |
| `POST` | `/api/visits/detect` | Trigger detection for all places |

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/detectVisits.ts` | Visit detection algorithm |
| `app/api/places/route.ts` | Places list + create |
| `app/api/places/[id]/route.ts` | Place delete |
| `app/api/visits/route.ts` | Visits list |
| `app/api/visits/[id]/route.ts` | Visit status update |
| `app/api/visits/detect/route.ts` | Manual detection trigger |
| `components/PlaceCreationModal.tsx` | Map click → create place form |
| `components/PlacesPanel.tsx` | Sidebar places list |
| `components/VisitSuggestionsPanel.tsx` | Sidebar suggestions list |
| `components/BackgroundDetector.tsx` | Hourly polling (renders nothing) |
| `components/map/LeafletMap.tsx` | Map with place circles + click handler |
| `components/map/MapWrapper.tsx` | Place state, modal management |
