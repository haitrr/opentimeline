# Point Drag-to-Correct Design

**Date:** 2026-06-21

## Overview

When the point layer is enabled, holding CMD activates a drag-to-correct mode. Hovering over a GPS point enlarges it and shows a grab cursor. Dragging moves a marker to a new position; releasing shows a confirm dialog before permanently updating the point's coordinates in the database.

## Interaction Flow

1. Point layer is visible (`!hidePoints`) and user holds **CMD (Meta)**
2. Hovering a `location-points` circle: the circle enlarges (via MapLibre feature-state) and cursor becomes `grab`
3. User clicks and drags — cursor becomes `grabbing`, a draggable `<Marker>` (react-map-gl) tracks the mouse. Map pan is disabled during the drag.
4. On drop: map pan re-enables. A confirm dialog appears:
   - Title: *"Move point to new location?"*
   - Body: *"This will permanently update the GPS coordinates. This cannot be undone."*
   - Actions: **Confirm** / **Cancel**
5. **Confirm** → `PATCH /api/locations/[id]` with `{ lat, lon }` → refetch GeoJSON so the circle re-renders at the corrected position
6. **Cancel** → marker disappears, circle stays at original position

The CMD key state is already tracked in `MapLibreMap` as `isCtrlPressed` (Meta key). The feature is only active when both `isCtrlPressed` and `!layerSettings.hidePoints` are true.

## Components

### `useDraggablePoints` hook

New hook extracted into `components/map/hooks/useDraggablePoints.ts`. Manages:

- `hoveredPoint: { id: number; lat: number; lon: number } | null` — point under cursor when CMD is held
- `pendingMove: { id: number; originalLat: number; originalLon: number; newLat: number; newLon: number } | null` — populated on drag end, drives the confirm dialog
- `onMouseMove(e: MapLayerMouseEvent)` — queries `location-points` features at cursor, sets `hoveredPoint`
- `onMouseLeave()` — clears `hoveredPoint`
- `onDragStart()` — calls `map.dragPan.disable()`
- `onDragEnd(e: MarkerDragEvent)` — calls `map.dragPan.enable()`, sets `pendingMove`
- `confirmMove()` — calls API, clears state, triggers GeoJSON refetch
- `cancelMove()` — clears `pendingMove`

The hook receives `mapRef`, `isActive` (CMD held + point layer visible), and a `onPointMoved` callback.

### MapLibreMap changes

- When `isActive`, wire `mousemove`/`mouseleave` on the `location-points` layer to the hook handlers
- Render a draggable `<Marker>` at `hoveredPoint` position when `hoveredPoint` is set and `pendingMove` is null
- Render `<ConfirmPointMoveDialog>` when `pendingMove` is set

### Visual hover highlight

Use MapLibre feature-state to enlarge the hovered circle:

```
// In MapLayers.tsx — location-points circle-radius paint
"circle-radius": [
  "case",
  ["boolean", ["feature-state", "hover"], false],
  8,   // enlarged when hovered
  ["interpolate", ["linear"], ["zoom"], 12, 4, 16, 6]  // default
]
```

Set/unset via `map.setFeatureState({ source: "location-points", id: pointId }, { hover: true/false })`.

This requires the GeoJSON source to have `generateId: true` (or explicit `id` on each feature).

### `ConfirmPointMoveDialog` component

New file: `components/map/ConfirmPointMoveDialog.tsx`. A shadcn `AlertDialog` (already used in the project) with:

- Destructive confirm button
- On confirm: calls `confirmMove()` from the hook
- On cancel/close: calls `cancelMove()`

## API

### `PATCH /api/locations/[id]`

New route at `app/api/locations/[id]/route.ts`.

**Request body:**
```json
{ "lat": number, "lon": number }
```

**Validation:**
- Both `lat` and `lon` must be finite numbers
- `lat` in range `[-90, 90]`
- `lon` in range `[-180, 180]`
- Returns 400 with error message if invalid

**Handler:**
```ts
await prisma.location.update({
  where: { id: Number(params.id) },
  data: { lat, lon },
})
```

Returns 200 with the updated record, 404 if the location doesn't exist.

## GeoJSON Refetch

After a confirmed move, the client calls the existing data refetch mechanism in `MapWrapper` to reload the `location-points` GeoJSON source. No optimistic update — the circle re-renders after the server confirms the write.

## Testing

### Unit tests (vitest)

- `useDraggablePoints.test.ts`: hover sets `hoveredPoint`, drag end sets `pendingMove`, confirm calls API and clears state, cancel clears `pendingMove` only
- `PATCH /api/locations/[id]`: valid body updates DB; invalid lat/lon returns 400; missing id returns 404

### E2E tests (Playwright)

- Enable point layer, hold CMD, hover a point → circle grows
- Drag point to new position, confirm → circle re-renders at new position
- Drag point to new position, cancel → circle stays at original position
- Without point layer visible, CMD+hover does nothing
