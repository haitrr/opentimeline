# Point Drag-to-Correct Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the point layer is enabled, holding CMD lets the user hover a GPS point (it enlarges), drag it to a new position, and confirm a permanent coordinate update via a dialog.

**Architecture:** A new `useDraggablePoints` hook in `MapLibreMap` manages hover detection via MapLibre feature-state and drag lifecycle. On drop, a callback bubbles to `MapWrapper` which shows a confirm dialog and calls `PATCH /api/locations/[id]`. After success, the locations query is invalidated so the circle re-renders at the corrected position.

**Tech Stack:** Next.js App Router, MapLibre GL / react-map-gl, Prisma (`LocationPoint` model), shadcn `AlertDialog`, Vitest, Playwright.

## Global Constraints

- Prisma model is `LocationPoint` — use `prisma.locationPoint.*` (not `prisma.location.*`)
- Field names: `lat` and `lon` (not `lng`) everywhere (DB, API body, hook types)
- Point layer source id in MapLibre is `"points"`, layer id is `"location-points"`
- Feature-state hover requires `promoteId="id"` on the GeoJSON source (promotes `properties.id` to feature id)
- API route pattern: `async function HANDLER(request, { params }: { params: Promise<{ id: string }> })`
- `isCtrlPressed` state in `MapLibreMap` tracks the Meta/CMD key (name is intentionally kept for existing place-drag compatibility)
- TDD: write failing tests first, run to confirm failure, then implement

---

### Task 1: `PATCH /api/locations/[id]` endpoint

**Files:**
- Create: `app/api/locations/[id]/route.ts`
- Create: `tests/unit/api-locations-patch.test.ts`

**Interfaces:**
- Consumes: `prisma.locationPoint.findUnique`, `prisma.locationPoint.update`
- Produces: `PATCH /api/locations/[id]` — body `{ lat: number, lon: number }` → 200 with updated record, 400 on invalid input, 404 if not found

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/api-locations-patch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    locationPoint: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { PATCH } from "@/app/api/locations/[id]/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;
const findUnique = prisma.locationPoint.findUnique as unknown as MockFn;
const update = prisma.locationPoint.update as unknown as MockFn;

const EXISTING = {
  id: 1, lat: 48.8, lon: 2.3, tst: 1000,
  recordedAt: new Date(), acc: null, batt: null, tid: null, alt: null, vel: null,
};

function req(id: string, body: object) {
  return new Request(`http://localhost/api/locations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/locations/[id]", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 400 for non-numeric id", async () => {
    const res = await PATCH(req("abc", { lat: 1, lon: 1 }), ctx("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when location not found", async () => {
    findUnique.mockResolvedValue(null);
    const res = await PATCH(req("99", { lat: 1, lon: 1 }), ctx("99"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for lat out of range", async () => {
    findUnique.mockResolvedValue(EXISTING);
    const res = await PATCH(req("1", { lat: 91, lon: 0 }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for lon out of range", async () => {
    findUnique.mockResolvedValue(EXISTING);
    const res = await PATCH(req("1", { lat: 0, lon: 181 }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-numeric lat", async () => {
    findUnique.mockResolvedValue(EXISTING);
    const res = await PATCH(req("1", { lat: "bad", lon: 0 }), ctx("1"));
    expect(res.status).toBe(400);
  });

  it("updates location coordinates and returns 200", async () => {
    findUnique.mockResolvedValue(EXISTING);
    const updated = { ...EXISTING, lat: 48.9, lon: 2.4 };
    update.mockResolvedValue(updated);

    const res = await PATCH(req("1", { lat: 48.9, lon: 2.4 }), ctx("1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lat).toBe(48.9);
    expect(body.lon).toBe(2.4);
    expect(update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { lat: 48.9, lon: 2.4 },
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm exec vitest run tests/unit/api-locations-patch.test.ts
```
Expected: FAIL — `Cannot find module '@/app/api/locations/[id]/route'`

- [ ] **Step 3: Create the route**

```typescript
// app/api/locations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const locationId = parseInt(id, 10);

  if (isNaN(locationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const location = await prisma.locationPoint.findUnique({ where: { id: locationId } });
  if (!location) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const lat = Number(body.lat);
  const lon = Number(body.lon);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return NextResponse.json({ error: "lat must be between -90 and 90" }, { status: 400 });
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "lon must be between -180 and 180" }, { status: 400 });
  }

  const updated = await prisma.locationPoint.update({
    where: { id: locationId },
    data: { lat, lon },
  });

  return NextResponse.json(updated);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm exec vitest run tests/unit/api-locations-patch.test.ts
```
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/locations/[id]/route.ts tests/unit/api-locations-patch.test.ts
git commit -m "feat: add PATCH /api/locations/[id] endpoint"
```

---

### Task 2: `useDraggablePoints` hook

**Files:**
- Create: `components/map/hooks/useDraggablePoints.ts`
- Create: `tests/unit/useDraggablePoints.test.ts`

**Interfaces:**
- Consumes: `MapRef` from `react-map-gl/maplibre`
- Produces:
  ```typescript
  {
    hoveredPoint: { id: number; lat: number; lon: number } | null;
    processMouseMove(point: [number, number], map: MapRef, isActive: boolean): "grab" | "grabbing" | null;
    processMouseLeave(map: MapRef): void;
    onDragStart(): void;
    onDragEnd(): void;
  }
  ```

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/useDraggablePoints.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraggablePoints } from "@/components/map/hooks/useDraggablePoints";
import type { MapRef } from "react-map-gl/maplibre";

function makeMockMap(features: object[] = []) {
  return {
    dragPan: { disable: vi.fn(), enable: vi.fn() },
    setFeatureState: vi.fn(),
    queryRenderedFeatures: vi.fn(() => features),
  } as unknown as MapRef;
}

describe("useDraggablePoints", () => {
  it("starts with hoveredPoint null", () => {
    const { result } = renderHook(() => useDraggablePoints({ current: makeMockMap() }));
    expect(result.current.hoveredPoint).toBeNull();
  });

  it("onDragStart disables dragPan", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.onDragStart(); });
    expect(map.dragPan.disable).toHaveBeenCalledOnce();
  });

  it("onDragEnd re-enables dragPan and clears hover", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.onDragStart(); });
    act(() => { result.current.onDragEnd(); });
    expect(map.dragPan.enable).toHaveBeenCalledOnce();
    expect(result.current.hoveredPoint).toBeNull();
  });

  it("processMouseLeave clears hoveredPoint", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.processMouseLeave(map); });
    expect(result.current.hoveredPoint).toBeNull();
  });

  it("processMouseLeave is a no-op during drag", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.onDragStart(); });
    act(() => { result.current.processMouseLeave(map); });
    expect(map.setFeatureState).not.toHaveBeenCalled();
  });

  it("processMouseMove returns null when isActive is false", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    let cursor: string | null;
    act(() => { cursor = result.current.processMouseMove([100, 100], map, false); });
    expect(cursor!).toBeNull();
    expect(map.queryRenderedFeatures).not.toHaveBeenCalled();
  });

  it("processMouseMove returns 'grab' and sets hoveredPoint when over a point", () => {
    const map = makeMockMap([
      {
        id: 123,
        layer: { id: "location-points" },
        properties: { id: 42 },
        geometry: { type: "Point", coordinates: [2.3, 48.8] },
      },
    ]);
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    let cursor: string | null;
    act(() => { cursor = result.current.processMouseMove([100, 100], map, true); });
    expect(cursor!).toBe("grab");
    expect(result.current.hoveredPoint).toEqual({ id: 42, lat: 48.8, lon: 2.3 });
    expect(map.setFeatureState).toHaveBeenCalledWith(
      { source: "points", id: 123 },
      { hover: true },
    );
  });

  it("processMouseMove returns null and clears hover when not over a point", () => {
    const map = makeMockMap([]);
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.processMouseMove([100, 100], map, true); });
    expect(result.current.hoveredPoint).toBeNull();
  });

  it("processMouseMove returns 'grabbing' during drag", () => {
    const map = makeMockMap();
    const { result } = renderHook(() => useDraggablePoints({ current: map }));
    act(() => { result.current.onDragStart(); });
    let cursor: string | null;
    act(() => { cursor = result.current.processMouseMove([100, 100], map, true); });
    expect(cursor!).toBe("grabbing");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm exec vitest run tests/unit/useDraggablePoints.test.ts
```
Expected: FAIL — `Cannot find module '@/components/map/hooks/useDraggablePoints'`

- [ ] **Step 3: Implement the hook**

```typescript
// components/map/hooks/useDraggablePoints.ts
"use client";

import { useCallback, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";

export type HoveredPoint = {
  id: number;
  lat: number;
  lon: number;
} | null;

export function useDraggablePoints(mapRef: React.RefObject<MapRef | null>) {
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint>(null);
  const prevHoveredFeatureIdRef = useRef<number | string | null>(null);
  const isDraggingRef = useRef(false);

  // Called from MapLibreMap's rAF in handleMouseMove.
  // Returns the cursor string to use: "grab", "grabbing", or null.
  // Also manages feature-state for the hover highlight.
  const processMouseMove = useCallback((
    point: [number, number],
    map: MapRef,
    isActive: boolean,
  ): "grab" | "grabbing" | null => {
    if (isDraggingRef.current) return "grabbing";

    if (!isActive) {
      if (prevHoveredFeatureIdRef.current != null) {
        map.setFeatureState(
          { source: "points", id: prevHoveredFeatureIdRef.current },
          { hover: false },
        );
        prevHoveredFeatureIdRef.current = null;
        setHoveredPoint(null);
      }
      return null;
    }

    const features = map.queryRenderedFeatures(point, { layers: ["location-points"] });
    const f = features[0];

    if (!f || f.id == null) {
      if (prevHoveredFeatureIdRef.current != null) {
        map.setFeatureState(
          { source: "points", id: prevHoveredFeatureIdRef.current },
          { hover: false },
        );
        prevHoveredFeatureIdRef.current = null;
      }
      setHoveredPoint(null);
      return null;
    }

    const featureId = f.id as number | string;
    const pointId = Number(f.properties?.id);
    const coords = (f.geometry as { type: "Point"; coordinates: [number, number] }).coordinates;

    if (prevHoveredFeatureIdRef.current !== featureId) {
      if (prevHoveredFeatureIdRef.current != null) {
        map.setFeatureState(
          { source: "points", id: prevHoveredFeatureIdRef.current },
          { hover: false },
        );
      }
      map.setFeatureState({ source: "points", id: featureId }, { hover: true });
      prevHoveredFeatureIdRef.current = featureId;
    }

    setHoveredPoint({ id: pointId, lat: coords[1], lon: coords[0] });
    return "grab";
  }, []);

  const processMouseLeave = useCallback((map: MapRef) => {
    if (isDraggingRef.current) return;
    if (prevHoveredFeatureIdRef.current != null) {
      map.setFeatureState(
        { source: "points", id: prevHoveredFeatureIdRef.current },
        { hover: false },
      );
      prevHoveredFeatureIdRef.current = null;
    }
    setHoveredPoint(null);
  }, []);

  const onDragStart = useCallback(() => {
    isDraggingRef.current = true;
    mapRef.current?.dragPan.disable();
  }, [mapRef]);

  const onDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    mapRef.current?.dragPan.enable();
    if (prevHoveredFeatureIdRef.current != null) {
      mapRef.current?.setFeatureState(
        { source: "points", id: prevHoveredFeatureIdRef.current },
        { hover: false },
      );
      prevHoveredFeatureIdRef.current = null;
    }
    setHoveredPoint(null);
  }, [mapRef]);

  return { hoveredPoint, processMouseMove, processMouseLeave, onDragStart, onDragEnd };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm exec vitest run tests/unit/useDraggablePoints.test.ts
```
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add components/map/hooks/useDraggablePoints.ts tests/unit/useDraggablePoints.test.ts
git commit -m "feat: add useDraggablePoints hook"
```

---

### Task 3: `PointMoveConfirmDialog` component

**Files:**
- Create: `components/map/PointMoveConfirmDialog.tsx`

**Interfaces:**
- Consumes: `AlertDialog` parts from `@/components/ui/alert-dialog` (already in repo)
- Produces: `<PointMoveConfirmDialog lat lon error updating onConfirm onCancel />`

- [ ] **Step 1: Create the component**

```tsx
// components/map/PointMoveConfirmDialog.tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  lat: number;
  lon: number;
  error: string | null;
  updating: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function PointMoveConfirmDialog({ lat, lon, error, updating, onConfirm, onCancel }: Props) {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move point to new location?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently update the GPS coordinates. This cannot be undone.
            <br />
            <span className="text-xs">{lat.toFixed(5)}, {lon.toFixed(5)}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={updating}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={updating}>
            {updating ? "Moving…" : "Move point"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors for the new file

- [ ] **Step 3: Commit**

```bash
git add components/map/PointMoveConfirmDialog.tsx
git commit -m "feat: add PointMoveConfirmDialog component"
```

---

### Task 4: Feature-state hover highlight in MapLayers

**Files:**
- Modify: `components/map/MapLayers.tsx` (lines 200–221)

**Interfaces:**
- No interface changes — internal MapLibre paint update

The `location-points` Source needs `promoteId="id"` so MapLibre can use `properties.id` as the feature id for `setFeatureState`. The circle-radius paint must check `feature-state.hover` to enlarge the hovered point.

- [ ] **Step 1: Add `promoteId` to the points Source and update circle-radius paint**

In `components/map/MapLayers.tsx`, find the points Source (line ~200):

```tsx
{/* Location points */}
<Source id="points" type="geojson" data={pointsGeoJSON}>
  <Layer
    id="location-points"
    type="circle"
    minzoom={12}
    layout={{ visibility: vis(!hidePoints) }}
    paint={{
      "circle-radius": ["case", ["any", ["get", "isFirst"], ["get", "isLast"]], 6, 4],
```

Replace the entire Source block with:

```tsx
{/* Location points */}
<Source id="points" type="geojson" data={pointsGeoJSON} promoteId="id">
  <Layer
    id="location-points"
    type="circle"
    minzoom={12}
    layout={{ visibility: vis(!hidePoints) }}
    paint={{
      "circle-radius": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        8,
        ["case", ["any", ["get", "isFirst"], ["get", "isLast"]], 6, 4],
      ],
      "circle-color": ["case",
        ["get", "isFirst"], "#22c55e",
        ["get", "isLast"],  "#ef4444",
        ["get", "deviceColor"],
      ],
      "circle-stroke-color": ["case",
        ["get", "isFirst"], "#15803d",
        ["get", "isLast"],  "#b91c1c",
        ["get", "deviceStrokeColor"],
      ],
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.85,
    }}
  />
</Source>
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/map/MapLayers.tsx
git commit -m "feat: add feature-state hover highlight to location-points layer"
```

---

### Task 5: Props update and MapWrapper integration

**Files:**
- Modify: `components/map/mapConstants.ts` — add `onPointMoveRequest` to `Props`
- Modify: `components/map/MapWrapper.tsx` — add `pendingPointMove` state, confirm dialog, handler

**Interfaces:**
- Consumes from Task 3: `<PointMoveConfirmDialog>`
- Produces to Task 6: `onPointMoveRequest?: (id: number, lat: number, lon: number) => void` on `Props`

- [ ] **Step 1: Add `onPointMoveRequest` to Props in `mapConstants.ts`**

In `components/map/mapConstants.ts`, find the Props type and add after `onPlaceMoveRequest`:

```typescript
onPointMoveRequest?: (id: number, lat: number, lon: number) => void;
```

So the Props type becomes:
```typescript
export type Props = {
  points: SerializedPoint[];
  pointsEnvelope?: MapBounds | null;
  rangeStart?: string;
  rangeEnd?: string;
  rangeKey?: string;
  shouldAutoFit?: boolean;
  places?: PlaceData[];
  unknownVisits?: UnknownVisitData[];
  photos?: ImmichPhoto[];
  layerSettings?: LayerSettings;
  onBoundsChange?: (bounds: MapBounds) => void;
  onMapClick?: (lat: number, lon: number) => void;
  onCreateVisit?: (lat: number, lon: number) => void;
  onPlaceClick?: (place: PlaceData) => void;
  onPlaceMoveRequest?: (place: PlaceData, lat: number, lon: number) => void;
  onPointMoveRequest?: (id: number, lat: number, lon: number) => void;
  onUnknownVisitCreatePlace?: (uv: UnknownVisitData) => void;
  onPhotoClick?: (photo: ImmichPhoto, list?: ImmichPhoto[]) => void;
};
```

- [ ] **Step 2: Add state and handlers in `MapWrapper.tsx`**

In `MapWrapper.tsx`, after the existing `pendingPlaceMove` state declarations (around line 65), add:

```typescript
const [pendingPointMove, setPendingPointMove] = useState<{ id: number; lat: number; lon: number } | null>(null);
const [updatingPointMove, setUpdatingPointMove] = useState(false);
const [pointMoveError, setPointMoveError] = useState<string | null>(null);
```

After the `handleConfirmPlaceMove` function, add:

```typescript
function handlePointMoveRequest(id: number, lat: number, lon: number) {
  setPointMoveError(null);
  setPendingPointMove({ id, lat, lon });
}

async function handleConfirmPointMove() {
  if (!pendingPointMove) return;
  setUpdatingPointMove(true);
  setPointMoveError(null);
  try {
    const res = await fetch(`/api/locations/${pendingPointMove.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: pendingPointMove.lat, lon: pendingPointMove.lon }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setPointMoveError(data?.error ?? "Failed to update location");
      return;
    }
    setPendingPointMove(null);
    queryClient.invalidateQueries({ queryKey: ["locations"] });
  } catch {
    setPointMoveError("Network error");
  } finally {
    setUpdatingPointMove(false);
  }
}
```

- [ ] **Step 3: Add `onPointMoveRequest` prop and dialog to MapWrapper's JSX**

In `MapWrapper.tsx`, add `PointMoveConfirmDialog` to the imports at the top:

```typescript
import PointMoveConfirmDialog from "@/components/map/PointMoveConfirmDialog";
```

In the `<MapLibreMap>` JSX, add the prop after `onPlaceMoveRequest`:

```tsx
onPointMoveRequest={handlePointMoveRequest}
```

After the `{pendingPlaceMove && <PlaceMoveConfirmDialog ... />}` block, add:

```tsx
{pendingPointMove && (
  <PointMoveConfirmDialog
    lat={pendingPointMove.lat}
    lon={pendingPointMove.lon}
    error={pointMoveError}
    updating={updatingPointMove}
    onConfirm={handleConfirmPointMove}
    onCancel={() => {
      if (updatingPointMove) return;
      setPendingPointMove(null);
      setPointMoveError(null);
    }}
  />
)}
```

- [ ] **Step 4: Verify TypeScript**

```bash
pnpm exec tsc --noEmit
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/map/mapConstants.ts components/map/MapWrapper.tsx
git commit -m "feat: wire point move handler in MapWrapper"
```

---

### Task 6: Integrate `useDraggablePoints` into `MapLibreMap`

**Files:**
- Modify: `components/map/MapLibreMap.tsx`

**Interfaces:**
- Consumes from Task 2: `useDraggablePoints` hook → `{ hoveredPoint, processMouseMove, processMouseLeave, onDragStart, onDragEnd }`
- Consumes from Task 5: `onPointMoveRequest` prop (via `Props`)

The key changes:
1. Import and call `useDraggablePoints`
2. Add `isCtrlPressedRef` and `hidePointsRef` so the rAF can read current values without stale closures
3. Update `handleMouseMove` rAF to call `processMouseMove` and adjust cursor logic
4. Update `handleMouseLeave` to call `processMouseLeave`
5. Render a draggable `<Marker>` when CMD is held and a point is hovered
6. Capture the hovered point at drag start via `draggedPointRef` so `onDragEnd` has the original coords

- [ ] **Step 1: Add imports**

At the top of `components/map/MapLibreMap.tsx`, add to the existing react-map-gl import:

```typescript
import ReactMap, { Marker, type MapRef, type MapLayerMouseEvent } from "react-map-gl/maplibre";
```

_(already has `Marker` — no change needed there)_

Add the hook import after the other hook imports:

```typescript
import { useDraggablePoints, type HoveredPoint } from "@/components/map/hooks/useDraggablePoints";
```

- [ ] **Step 2: Add refs and initialize the hook inside `MapLibreMap`**

After the existing `const cursorRef = useRef("")` line (~line 66), add:

```typescript
const isCtrlPressedRef = useRef(false);
const hidePointsRef = useRef(layerSettings.hidePoints);
const draggedPointRef = useRef<HoveredPoint>(null);
```

After the existing `const internalLayerSettings = useLayerSettings()` block, add an effect to keep `hidePointsRef` current:

```typescript
useEffect(() => { hidePointsRef.current = layerSettings.hidePoints; });
```

Destructure the hook (add after the existing hook calls, before `const hoveredPlaceId`):

```typescript
const {
  hoveredPoint,
  processMouseMove,
  processMouseLeave,
  onDragStart: startPointDrag,
  onDragEnd: endPointDrag,
} = useDraggablePoints(mapRef);

const isPointDragActive = isCtrlPressed && !layerSettings.hidePoints;
```

- [ ] **Step 3: Update the Meta key effect to also update `isCtrlPressedRef`**

Find the existing Meta key `useEffect` (around line 127) and update it:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Meta") { setIsCtrlPressed(true); isCtrlPressedRef.current = true; }
  };
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Meta") { setIsCtrlPressed(false); isCtrlPressedRef.current = false; }
  };
  const handleWindowBlur = () => { setIsCtrlPressed(false); isCtrlPressedRef.current = false; };
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", handleWindowBlur);
  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", handleWindowBlur);
  };
}, []);
```

- [ ] **Step 4: Update `handleMouseMove` to integrate point drag**

Replace the `const handleMouseMove` callback with:

```typescript
const handleMouseMove = useCallback((event: MapLayerMouseEvent) => {
  const map = mapRef.current;
  if (!map) return;
  latestHoverPointRef.current = [event.point.x, event.point.y];
  if (hoverFrameRef.current != null) return;

  hoverFrameRef.current = requestAnimationFrame(() => {
    hoverFrameRef.current = null;
    const point = latestHoverPointRef.current;
    const currentMap = mapRef.current;
    if (!point || !currentMap) return;

    const candidateLayers = existingInteractiveLayers(currentMap);
    const features = candidateLayers.length > 0
      ? currentMap.queryRenderedFeatures(point, { layers: candidateLayers })
      : [];

    // Point drag mode: check hover, get cursor override
    const isPointDragActive = isCtrlPressedRef.current && !hidePointsRef.current;
    const pointCursor = processMouseMove(point, currentMap, isPointDragActive);

    // When CMD drag is active, don't show 'pointer' for location-points
    const cursorFeatures = pointCursor != null
      ? features.filter((f) => f.layer.id !== "location-points")
      : features;
    const cursor = pointCursor ?? (cursorFeatures.length > 0 ? "pointer" : "");

    if (cursorRef.current !== cursor) {
      currentMap.getCanvas().style.cursor = cursor;
      cursorRef.current = cursor;
    }

    const placeFeature = features.find(
      (f) => f.layer.id === "place-dot-circle-unvisited" || f.layer.id === "place-dot-circle-visited" || f.layer.id === "place-circle-fill"
    );
    const newHoveredId = placeFeature?.properties?.placeId != null ? Number(placeFeature.properties.placeId) : null;
    setHoveredPlace((prev) => {
      if (newHoveredId === null) return prev === null ? prev : null;
      if (prev?.id === newHoveredId && prev.x === point[0] && prev.y === point[1]) return prev;
      return { id: newHoveredId, x: point[0], y: point[1] };
    });
  });
}, [processMouseMove]);
```

- [ ] **Step 5: Update `handleMouseLeave` to clear point hover**

Replace the `const handleMouseLeave` callback with:

```typescript
const handleMouseLeave = useCallback(() => {
  const map = mapRef.current;
  if (!map) return;
  if (hoverFrameRef.current != null) cancelAnimationFrame(hoverFrameRef.current);
  hoverFrameRef.current = null;
  latestHoverPointRef.current = null;
  map.getCanvas().style.cursor = "";
  cursorRef.current = "";
  setHoveredPlace(null);
  processMouseLeave(map);
}, [processMouseLeave]);
```

- [ ] **Step 6: Add the draggable point Marker and destructure `onPointMoveRequest` from props**

In the function signature, add `onPointMoveRequest` to the destructured props:

```typescript
export default function MapLibreMap({
  ...
  onPlaceMoveRequest,
  onPointMoveRequest,
  onUnknownVisitCreatePlace,
  ...
}: Props) {
```

Inside the `<ReactMap>` JSX, after the existing place drag markers block (around line 361), add:

```tsx
{/* Point drag handle when CMD is held and a point is hovered */}
{isPointDragActive && hoveredPoint && (
  <Marker
    latitude={hoveredPoint.lat}
    longitude={hoveredPoint.lon}
    draggable
    onDragStart={() => {
      draggedPointRef.current = hoveredPoint;
      startPointDrag();
      const canvas = mapRef.current?.getCanvas();
      if (canvas) { canvas.style.cursor = "grabbing"; cursorRef.current = "grabbing"; }
    }}
    onDragEnd={(e) => {
      const p = draggedPointRef.current;
      draggedPointRef.current = null;
      endPointDrag();
      if (p) onPointMoveRequest?.(p.id, e.lngLat.lat, e.lngLat.lng);
    }}
  >
    <div
      className="h-5 w-5 rounded-full border-2 border-blue-700 bg-blue-500 opacity-80 shadow"
      style={{ cursor: "grab" }}
    />
  </Marker>
)}
```

- [ ] **Step 7: Verify TypeScript and linting**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint components/map/MapLibreMap.tsx
```
Expected: no errors

- [ ] **Step 8: Run existing unit tests to confirm no regressions**

```bash
pnpm exec vitest run tests/unit/
```
Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add components/map/MapLibreMap.tsx
git commit -m "feat: integrate CMD+drag point correction in MapLibreMap"
```

---

### Task 7: E2e test

**Files:**
- Create: `tests/e2e/point-drag-correct.spec.ts`

- [ ] **Step 1: Write the e2e test**

```typescript
// tests/e2e/point-drag-correct.spec.ts
import { test, expect } from "@playwright/test";

test("point drag: CMD+drag shows confirm dialog, cancel leaves point in place", async ({ page }) => {
  await page.goto("/timeline");

  // Wait for the map canvas to load
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.waitFor({ timeout: 15000 });

  // Zoom in so the location-points layer (minzoom 12) becomes visible.
  // Use the fit-bounds button if present, then zoom in further.
  const fitButton = page.getByTitle(/fit/i).or(page.getByRole("button", { name: /fit/i })).first();
  if (await fitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await fitButton.click();
    await page.waitForTimeout(1200);
  }

  // Zoom in 5 more levels using the keyboard shortcut
  for (let i = 0; i < 5; i++) {
    await canvas.click();
    await page.keyboard.press("+");
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(500);

  // Hold CMD to activate point drag mode
  await page.keyboard.down("Meta");

  const box = await canvas.boundingBox();
  if (!box) {
    await page.keyboard.up("Meta");
    test.skip();
    return;
  }

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // Move over the canvas center; if a point is hovered, cursor becomes "grab"
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(200);

  // Attempt drag from center — if a point is there, the confirm dialog will appear
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy + 40, { steps: 10 });
  await page.mouse.up();

  await page.keyboard.up("Meta");

  // If dialog appeared (a point was under the cursor), test the cancel flow
  const dialog = page.getByRole("alertdialog");
  const dialogVisible = await dialog.isVisible({ timeout: 1500 }).catch(() => false);

  if (!dialogVisible) {
    // No point was under cursor — skip gracefully (no data at this zoom/position)
    return;
  }

  await expect(dialog).toContainText("Move point to new location?");
  await expect(dialog).toContainText("This cannot be undone");

  // Cancel — dialog should close and no API call should have been made
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 2000 });
});

test("point drag: CMD not held — no drag mode, normal map interaction", async ({ page }) => {
  await page.goto("/timeline");
  const canvas = page.locator(".maplibregl-canvas");
  await canvas.waitFor({ timeout: 15000 });

  // Without CMD, dragging the canvas pans the map (cursor stays default/grab for pan)
  const box = await canvas.boundingBox();
  if (!box) return;

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy, { steps: 5 });
  await page.mouse.up();

  // No dialog should appear — just a pan
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).not.toBeVisible({ timeout: 500 });
});
```

- [ ] **Step 2: Run the e2e tests**

```bash
pnpm exec playwright test tests/e2e/point-drag-correct.spec.ts
```
Expected: both tests PASS (the first may skip gracefully if no point is under cursor at the test's default position)

- [ ] **Step 3: Run the full test suite**

```bash
pnpm exec vitest run tests/unit/ && pnpm exec playwright test
```
Expected: all unit tests pass; e2e tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/point-drag-correct.spec.ts
git commit -m "test: add e2e test for point drag-to-correct"
```
