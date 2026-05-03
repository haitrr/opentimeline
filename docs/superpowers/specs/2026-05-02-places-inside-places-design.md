# Places Inside Places — Design Spec

**Date:** 2026-05-02  
**Status:** Approved

## Problem

When visiting a building like a mall, GPS is unreliable indoors and cannot distinguish between sub-locations (individual stores, restaurants). The app currently has no way to record which specific places inside a building were visited.

## Goal

Support manual annotation of parent visits with a list of sub-places visited inside. Sub-places are pre-defined children of a parent place, reusable across visits, and tracked with their own visit history.

## Scope

- Not in scope: automatic indoor positioning or GPS-based sub-place detection
- Not in scope: time windows per sub-place visit (sub-places inherit parent visit times)

---

## Data Model

### Place schema change

Add optional `parentId` self-referential foreign key to `Place`:

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
```

No new tables. Sub-place visits are regular `Visit` records where `placeId` points to a child `Place`.

### Visit model

No changes. Sub-place visits use the existing `Visit` model with `arrivalAt`/`departureAt` copied from the parent visit and `status` set to `confirmed`.

---

## Visit Annotation Flow

When a user opens a visit to a parent place (a place with `children`):

1. The visit detail shows a **"Places visited inside"** section
2. All children of the parent place are listed as checkboxes
3. **Checking** a sub-place creates a `Visit` for that child:
   - `arrivalAt` / `departureAt` copied from the parent visit
   - `status: "confirmed"`
4. **Unchecking** a sub-place deletes that child visit
5. An **"Add sub-place"** inline button creates a new child `Place` (name only; lat/lon/radius inherited from parent) and immediately checks it
6. This annotation flow is available on both `suggested` and `confirmed` parent visits
7. Confirming a suggested parent visit with sub-places checked confirms the parent and creates all child visits atomically

---

## Visit Detection

Sub-places (`parentId IS NOT NULL`) are **excluded** from GPS-based visit detection. The `detectVisits` function skips any place with a `parentId`. Sub-place visits are created only through manual annotation.

---

## UI: Places Panel

- The panel lists only **root places** (`parentId IS NULL`) by default
- Root places with children show an **expand toggle**
- Expanded view shows children indented beneath the parent, each with their own visit count
- Visit counts are **not** rolled up — parent count reflects direct visits to the parent only; child counts reflect annotated sub-place visits

## UI: Place Detail Modal

- Parent places get a **"Sub-places"** section at the bottom
- Lists all children with name and visit count
- Actions: add sub-place (name only), rename, delete (cascades to that sub-place's visits)
- Sub-places do not show a map radius circle (no GPS detection)

---

## API Changes

### Places

| Method | Endpoint | Change |
|--------|----------|--------|
| `POST` | `/api/places` | Accept optional `parentId` in body |
| `GET`  | `/api/places` | Return `parentId` and optionally `children` in response |

### Visits

| Method | Endpoint | Change |
|--------|----------|--------|
| `PUT` | `/api/visits/[id]/sub-places` | Idempotent replace — accepts `{ subPlaceIds: number[] }`, creates Visit records for newly checked sub-places, deletes records for unchecked ones |

---

## Testing Plan

### Unit tests (vitest)
- `detectVisits` skips places with `parentId` set
- Creating sub-place visits copies parent visit time window correctly
- Deleting a sub-place cascades its visit records

### Integration tests (vitest)
- `POST /api/places` with `parentId` creates a child place
- `GET /api/places` returns hierarchy correctly
- Sub-place visit annotation creates/deletes visit records
- Confirming a parent visit with sub-places checked is atomic

### E2E tests (playwright)
- Annotating a parent visit with existing sub-places
- Adding a new sub-place inline from the visit annotation panel
- Places panel expand/collapse showing sub-places with counts
- Deleting a sub-place from the Place detail modal
