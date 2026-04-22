# Device Point Colors & Legend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color map points by device ID and show a bottom-right legend when the points layer is visible.

**Architecture:** A new `buildDeviceColorMap` utility assigns colors from a fixed palette to each unique `deviceId`. `useMapGeoJSON` calls it to encode `deviceColor`/`deviceStrokeColor` into each GeoJSON point feature property (same pattern as path segments) and returns the map. `MapLayers` reads colors via `["get", "deviceColor"]`. A new `PointsLegend` component reads the map and renders the legend.

**Tech Stack:** TypeScript, React, MapLibre GL (react-map-gl), Tailwind CSS, Vitest + @testing-library/react

---

## File Map

| Action | File |
|--------|------|
| Create | `lib/deviceColors.ts` |
| Create | `tests/unit/lib/deviceColors.test.ts` |
| Modify | `components/map/hooks/useMapGeoJSON.ts` |
| Modify | `components/map/MapLayers.tsx` |
| Create | `components/map/PointsLegend.tsx` |
| Create | `tests/unit/components/map/PointsLegend.test.tsx` |
| Modify | `components/map/MapLibreMap.tsx` |

---

### Task 1: Device color utility

**Files:**
- Create: `lib/deviceColors.ts`
- Create: `tests/unit/lib/deviceColors.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/lib/deviceColors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildDeviceColorMap, DEVICE_COLOR_PALETTE, NULL_DEVICE_COLOR } from "@/lib/deviceColors";

describe("buildDeviceColorMap", () => {
  it("returns empty map for empty input", () => {
    const result = buildDeviceColorMap([]);
    expect(result.size).toBe(0);
  });

  it("maps null deviceId to fallback blue", () => {
    const result = buildDeviceColorMap([null]);
    expect(result.get(null)).toEqual(NULL_DEVICE_COLOR);
  });

  it("assigns first palette color to first non-null device", () => {
    const result = buildDeviceColorMap(["phone"]);
    expect(result.get("phone")).toEqual(DEVICE_COLOR_PALETTE[0]);
  });

  it("assigns distinct colors to distinct devices", () => {
    const result = buildDeviceColorMap(["phone", "watch"]);
    const phoneColor = result.get("phone");
    const watchColor = result.get("watch");
    expect(phoneColor).toBeDefined();
    expect(watchColor).toBeDefined();
    expect(phoneColor?.color).not.toBe(watchColor?.color);
  });

  it("cycles colors when there are more devices than palette entries", () => {
    const ids = Array.from({ length: DEVICE_COLOR_PALETTE.length + 1 }, (_, i) => `dev-${i}`);
    const result = buildDeviceColorMap(ids);
    expect(result.get("dev-0")?.color).toBe(result.get(`dev-${DEVICE_COLOR_PALETTE.length}`)?.color);
  });

  it("is deterministic — same input always produces same color assignment", () => {
    const ids = ["alpha", "beta", null, "gamma"];
    const r1 = buildDeviceColorMap(ids);
    const r2 = buildDeviceColorMap(ids);
    for (const id of ids) {
      expect(r1.get(id)).toEqual(r2.get(id));
    }
  });

  it("deduplicates repeated device IDs", () => {
    const result = buildDeviceColorMap(["phone", "phone", "phone"]);
    expect(result.size).toBe(1);
    expect(result.get("phone")).toEqual(DEVICE_COLOR_PALETTE[0]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm exec vitest run tests/unit/lib/deviceColors.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the utility**

Create `lib/deviceColors.ts`:

```typescript
export type DeviceColor = { color: string; strokeColor: string };

export const NULL_DEVICE_COLOR: DeviceColor = {
  color: "#3b82f6",
  strokeColor: "#1d4ed8",
};

export const DEVICE_COLOR_PALETTE: DeviceColor[] = [
  { color: "#f97316", strokeColor: "#ea580c" },
  { color: "#a855f7", strokeColor: "#9333ea" },
  { color: "#06b6d4", strokeColor: "#0891b2" },
  { color: "#f59e0b", strokeColor: "#d97706" },
  { color: "#10b981", strokeColor: "#059669" },
  { color: "#ec4899", strokeColor: "#db2777" },
  { color: "#84cc16", strokeColor: "#65a30d" },
  { color: "#6366f1", strokeColor: "#4f46e5" },
];

export function buildDeviceColorMap(
  deviceIds: (string | null)[],
): Map<string | null, DeviceColor> {
  const result = new Map<string | null, DeviceColor>();
  let paletteIndex = 0;
  for (const id of deviceIds) {
    if (result.has(id)) continue;
    if (id === null) {
      result.set(null, NULL_DEVICE_COLOR);
    } else {
      result.set(id, DEVICE_COLOR_PALETTE[paletteIndex % DEVICE_COLOR_PALETTE.length]);
      paletteIndex++;
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm exec vitest run tests/unit/lib/deviceColors.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/deviceColors.ts tests/unit/lib/deviceColors.test.ts
git commit -m "feat: add device color assignment utility"
```

---

### Task 2: Encode device colors in `useMapGeoJSON`

**Files:**
- Modify: `components/map/hooks/useMapGeoJSON.ts`

- [ ] **Step 1: Add import and update `pointsGeoJSON` memo**

In `components/map/hooks/useMapGeoJSON.ts`, add the import after the existing imports:

```typescript
import { buildDeviceColorMap, NULL_DEVICE_COLOR } from "@/lib/deviceColors";
```

Replace the `pointsGeoJSON` memo (lines 84–100) with:

```typescript
  const deviceColors = useMemo(
    () => buildDeviceColorMap(points.map((p) => p.deviceId ?? null)),
    [points],
  );

  const pointsGeoJSON = useMemo(() => {
    const features: Array<{
      type: "Feature";
      geometry: { type: "Point"; coordinates: [number, number] };
      properties: {
        id: number;
        isFirst: boolean;
        isLast: boolean;
        batt: number | null;
        recordedAt: string;
        acc: number | null;
        vel: number | null;
        deviceId: string | null;
        deviceColor: string;
        deviceStrokeColor: string;
      };
    }> = [];
    points.forEach((p, i) => {
      const isFirst = i === 0;
      const isLast = i === points.length - 1;
      const dc = deviceColors.get(p.deviceId ?? null) ?? NULL_DEVICE_COLOR;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: {
          id: p.id,
          isFirst,
          isLast,
          batt: p.batt,
          recordedAt: p.recordedAt,
          acc: p.acc,
          vel: p.vel,
          deviceId: p.deviceId ?? null,
          deviceColor: dc.color,
          deviceStrokeColor: dc.strokeColor,
        },
      });
    });
    return { type: "FeatureCollection" as const, features };
  }, [points, deviceColors]);
```

- [ ] **Step 2: Add `deviceColors` to the return value**

Replace the existing `return` block at the bottom of `useMapGeoJSON` (currently lines 209–217):

```typescript
  return {
    pathGeoJSON,
    pointsGeoJSON,
    heatGeoJSON,
    placeCirclesGeoJSON,
    placeDotsGeoJSON,
    unknownVisitsGeoJSON,
    photosGeoJSON,
    deviceColors,
  };
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/map/hooks/useMapGeoJSON.ts
git commit -m "feat: encode device colors in pointsGeoJSON features"
```

---

### Task 3: Update `MapLayers` to use device colors

**Files:**
- Modify: `components/map/MapLayers.tsx`

- [ ] **Step 1: Update `circle-color` and `circle-stroke-color` paint**

In `components/map/MapLayers.tsx`, replace the `paint` block of the `location-points` layer (lines 160–174):

```tsx
          paint={{
            "circle-radius": ["case", ["any", ["get", "isFirst"], ["get", "isLast"]], 6, 4],
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/map/MapLayers.tsx
git commit -m "feat: color map points by device using GeoJSON deviceColor property"
```

---

### Task 4: `PointsLegend` component

**Files:**
- Create: `components/map/PointsLegend.tsx`
- Create: `tests/unit/components/map/PointsLegend.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/components/map/PointsLegend.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PointsLegend from "@/components/map/PointsLegend";
import type { DeviceColor } from "@/lib/deviceColors";

function makeColors(entries: [string | null, DeviceColor][]): Map<string | null, DeviceColor> {
  return new Map(entries);
}

describe("PointsLegend", () => {
  it("renders nothing when hidePoints is true", () => {
    const { container } = render(
      <PointsLegend
        deviceColors={makeColors([["phone", { color: "#f97316", strokeColor: "#ea580c" }]])}
        hidePoints={true}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a row for each device when visible", () => {
    render(
      <PointsLegend
        deviceColors={makeColors([
          ["phone", { color: "#f97316", strokeColor: "#ea580c" }],
          ["watch", { color: "#a855f7", strokeColor: "#9333ea" }],
        ])}
        hidePoints={false}
      />,
    );
    expect(screen.getByText("phone")).toBeInTheDocument();
    expect(screen.getByText("watch")).toBeInTheDocument();
  });

  it('labels null deviceId as "Unknown"', () => {
    render(
      <PointsLegend
        deviceColors={makeColors([[null, { color: "#3b82f6", strokeColor: "#1d4ed8" }]])}
        hidePoints={false}
      />,
    );
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("renders a color swatch with the device color", () => {
    render(
      <PointsLegend
        deviceColors={makeColors([["phone", { color: "#f97316", strokeColor: "#ea580c" }]])}
        hidePoints={false}
      />,
    );
    const swatch = document.querySelector('[data-testid="swatch-phone"]') as HTMLElement;
    expect(swatch).toBeTruthy();
    expect(swatch.style.backgroundColor).toBe("rgb(249, 115, 22)");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm exec vitest run tests/unit/components/map/PointsLegend.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `PointsLegend`**

Create `components/map/PointsLegend.tsx`:

```tsx
"use client";

import React from "react";
import type { DeviceColor } from "@/lib/deviceColors";

type Props = {
  deviceColors: Map<string | null, DeviceColor>;
  hidePoints: boolean;
};

export default function PointsLegend({ deviceColors, hidePoints }: Props) {
  if (hidePoints || deviceColors.size === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-900 rounded-lg border border-gray-200 bg-white/90 px-3 py-2 shadow-md">
      <div className="flex flex-col gap-1">
        {Array.from(deviceColors.entries()).map(([id, { color }]) => (
          <div key={id ?? "__null__"} className="flex items-center gap-2">
            <span
              data-testid={`swatch-${id ?? "__null__"}`}
              className="h-3 w-3 flex-shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-gray-700">{id ?? "Unknown"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm exec vitest run tests/unit/components/map/PointsLegend.test.tsx
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/map/PointsLegend.tsx tests/unit/components/map/PointsLegend.test.tsx
git commit -m "feat: add PointsLegend component"
```

---

### Task 5: Wire `PointsLegend` into `MapLibreMap`

**Files:**
- Modify: `components/map/MapLibreMap.tsx`

- [ ] **Step 1: Import `PointsLegend`**

Add to the import block at the top of `components/map/MapLibreMap.tsx` (after the existing local imports):

```typescript
import PointsLegend from "@/components/map/PointsLegend";
```

- [ ] **Step 2: Render `PointsLegend` after the `</Map>` closing tag**

`PointsLegend` must render outside `<Map>` (react-map-gl's Map only accepts map-specific children). In `components/map/MapLibreMap.tsx`, insert it immediately after `</Map>` (currently line 322), before the place hover tooltip:

```tsx
      </Map>

      <PointsLegend
        deviceColors={geoJSON.deviceColors}
        hidePoints={layerSettings.hidePoints}
      />

      {/* Place hover tooltip */}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all unit tests**

```bash
pnpm exec vitest run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/map/MapLibreMap.tsx
git commit -m "feat: show device color legend on map when points layer is visible"
```
