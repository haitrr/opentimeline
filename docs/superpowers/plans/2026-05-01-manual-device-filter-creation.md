# Manual Device Filter Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Create filter" button to ConflictsPanel that opens a modal where users can select a time range via an interactive slider, preview results on a live map, pick devices to keep, and save the filter.

**Architecture:** Three new components — `TimeRangeSlider` (dual-handle slider converting ISO strings ↔ minute offsets), `FilterPreviewMap` (lightweight MapLibre map rendering filtered location tracks), and `CreateFilterDialog` (composes the two, manages debounced fetch and device selection) — plus a small modification to `ConflictsPanel` to mount the dialog.

**Tech Stack:** React, TypeScript, react-map-gl + maplibre-gl, @base-ui/react Slider, TanStack React Query, date-fns, @testing-library/react, Vitest, Playwright.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `components/TimeRangeSlider.tsx` | Dual-handle slider; converts ISO ↔ minute offset |
| Create | `components/FilterPreviewMap.tsx` | Lightweight MapLibre map; renders track lines from `SerializedPoint[]` |
| Create | `components/CreateFilterDialog.tsx` | Dialog; manages debounced fetch, device selection, save |
| Modify | `components/ConflictsPanel.tsx` | Add "Create filter" button + mount `CreateFilterDialog` |
| Create | `tests/unit/time-range-slider.test.tsx` | Unit tests for `TimeRangeSlider` |
| Create | `tests/unit/create-filter-dialog.test.tsx` | Unit tests for `CreateFilterDialog` |
| Modify | `tests/e2e/device-filters.spec.ts` | E2E smoke test for dialog open/close |

---

## Task 1: TimeRangeSlider — write failing tests

**Files:**
- Create: `tests/unit/time-range-slider.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/unit/time-range-slider.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TimeRangeSlider from "@/components/TimeRangeSlider";

vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    onValueChange,
    value,
    min,
    max,
    step,
  }: {
    onValueChange: (v: number[]) => void;
    value: number[];
    min: number;
    max: number;
    step: number;
  }) => (
    <div
      data-testid="slider"
      data-value={value.join(",")}
      data-min={min}
      data-max={max}
      data-step={step}
      onClick={() => onValueChange([60, 600])}
    />
  ),
}));

const MIN = "2026-05-01T08:00:00.000Z"; // 08:00 UTC
const MAX = "2026-05-01T20:00:00.000Z"; // 720 minutes total

describe("TimeRangeSlider", () => {
  it("renders two thumb positions derived from value ISO strings", () => {
    const from = "2026-05-01T09:00:00.000Z"; // 60 min offset
    const to = "2026-05-01T18:00:00.000Z";   // 600 min offset
    render(
      <TimeRangeSlider min={MIN} max={MAX} value={[from, to]} onChange={vi.fn()} />
    );
    const slider = screen.getByTestId("slider");
    expect(slider.dataset.value).toBe("60,600");
    expect(slider.dataset.min).toBe("0");
    expect(slider.dataset.max).toBe("720");
    expect(slider.dataset.step).toBe("1");
  });

  it("calls onChange with ISO strings when slider emits new minute offsets", async () => {
    const onChange = vi.fn();
    render(
      <TimeRangeSlider min={MIN} max={MAX} value={[MIN, MAX]} onChange={onChange} />
    );
    await userEvent.click(screen.getByTestId("slider"));
    expect(onChange).toHaveBeenCalledOnce();
    const [from, to] = onChange.mock.calls[0];
    // 60 minutes after MIN → "2026-05-01T09:00:00.000Z"
    expect(from).toBe("2026-05-01T09:00:00.000Z");
    // 600 minutes after MIN → "2026-05-01T18:00:00.000Z"
    expect(to).toBe("2026-05-01T18:00:00.000Z");
  });

  it("passes step=1 to Slider for 1-minute snap", () => {
    render(
      <TimeRangeSlider min={MIN} max={MAX} value={[MIN, MAX]} onChange={vi.fn()} />
    );
    expect(screen.getByTestId("slider").dataset.step).toBe("1");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test -- tests/unit/time-range-slider.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/TimeRangeSlider'`

---

## Task 2: TimeRangeSlider — implement

**Files:**
- Create: `components/TimeRangeSlider.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/TimeRangeSlider.tsx
"use client";

import { useMemo } from "react";
import { format, addMinutes, differenceInMinutes } from "date-fns";
import { Slider } from "@/components/ui/slider";

type Props = {
  min: string;
  max: string;
  value: [string, string];
  onChange: (from: string, to: string) => void;
};

export default function TimeRangeSlider({ min, max, value, onChange }: Props) {
  const minDate = useMemo(() => new Date(min), [min]);
  const totalMinutes = useMemo(
    () => differenceInMinutes(new Date(max), minDate),
    [max, minDate],
  );

  const sliderValue = useMemo(
    () => [
      differenceInMinutes(new Date(value[0]), minDate),
      differenceInMinutes(new Date(value[1]), minDate),
    ],
    [value, minDate],
  );

  function handleChange(v: number | readonly number[]) {
    const arr = Array.isArray(v) ? (v as number[]) : [v as number];
    const [a, b] = arr;
    onChange(
      addMinutes(minDate, a).toISOString(),
      addMinutes(minDate, b).toISOString(),
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-gray-700">
        <span>{format(new Date(value[0]), "HH:mm")}</span>
        <span>{format(new Date(value[1]), "HH:mm")}</span>
      </div>
      <Slider
        min={0}
        max={totalMinutes}
        step={1}
        value={sliderValue}
        onValueChange={handleChange}
      />
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{format(minDate, "HH:mm")}</span>
        <span>{format(new Date(max), "HH:mm")}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
pnpm test -- tests/unit/time-range-slider.test.tsx
```

Expected: PASS — 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add components/TimeRangeSlider.tsx tests/unit/time-range-slider.test.tsx
git commit -m "feat: add TimeRangeSlider component"
```

---

## Task 3: FilterPreviewMap — implement

**Files:**
- Create: `components/FilterPreviewMap.tsx`

No unit test: MapLibre rendering requires a real browser; covered by E2E in Task 7.

- [ ] **Step 1: Create the component**

```tsx
// components/FilterPreviewMap.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import Map, { Source, Layer, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Feature } from "geojson";
import type { SerializedPoint } from "@/lib/groupByHour";
import { computeInitialViewState } from "@/components/map/mapUtils";

type Props = {
  points: SerializedPoint[];
  className?: string;
};

const PATH_SPLIT_SEC = 600;

function buildPathGeoJSON(points: SerializedPoint[]): FeatureCollection {
  const sorted = [...points].sort((a, b) => a.tst - b.tst);
  const features: Feature[] = [];
  if (sorted.length < 2) return { type: "FeatureCollection", features };

  let current: [number, number][] = [[sorted[0].lon, sorted[0].lat]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].tst - sorted[i - 1].tst;
    if (gap > PATH_SPLIT_SEC) {
      if (current.length >= 2) {
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: current },
          properties: {},
        });
      }
      current = [];
    }
    current.push([sorted[i].lon, sorted[i].lat]);
  }
  if (current.length >= 2) {
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: current },
      properties: {},
    });
  }
  return { type: "FeatureCollection", features };
}

export default function FilterPreviewMap({ points, className }: Props) {
  const mapRef = useRef<MapRef>(null);
  const pathGeoJSON = useMemo(() => buildPathGeoJSON(points), [points]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialViewState = useMemo(() => computeInitialViewState(points), []);

  useEffect(() => {
    if (points.length === 0) return;
    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    mapRef.current?.fitBounds(bounds, { padding: 40, duration: 300, maxZoom: 14 });
  }, [points]);

  return (
    <div className={className} style={{ height: 250 }}>
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <Source id="filter-preview-path" type="geojson" data={pathGeoJSON}>
          <Layer
            id="filter-preview-line"
            type="line"
            paint={{
              "line-color": "#3b82f6",
              "line-width": 2,
              "line-opacity": 0.8,
            }}
          />
        </Source>
      </Map>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/FilterPreviewMap.tsx
git commit -m "feat: add FilterPreviewMap component"
```

---

## Task 4: CreateFilterDialog — write failing tests

**Files:**
- Create: `tests/unit/create-filter-dialog.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/unit/create-filter-dialog.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CreateFilterDialog from "@/components/CreateFilterDialog";
import type { ReactNode } from "react";

vi.mock("@/components/FilterPreviewMap", () => ({
  default: () => <div data-testid="filter-preview-map" />,
}));

vi.mock("@/components/TimeRangeSlider", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: [string, string];
    onChange: (f: string, t: string) => void;
  }) => (
    <div
      data-testid="time-range-slider"
      onClick={() => onChange(value[0], value[1])}
    />
  ),
}));

const mockCreateFilter = vi.fn();
vi.mock("@/components/DeviceFilterProvider", () => ({
  useDeviceFilters: () => ({ createFilter: mockCreateFilter }),
}));

const RANGE_START = "2026-05-01T08:00:00.000Z";
const RANGE_END = "2026-05-01T20:00:00.000Z";

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("CreateFilterDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ points: [] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("populates device list from fetched location data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            points: [
              {
                id: 1, lat: 1, lon: 1, tst: 1, recordedAt: RANGE_START,
                acc: null, batt: null, tid: null, alt: null, vel: null,
                deviceId: "phone",
              },
              {
                id: 2, lat: 2, lon: 2, tst: 2, recordedAt: RANGE_START,
                acc: null, batt: null, tid: null, alt: null, vel: null,
                deviceId: "tablet",
              },
            ],
          }),
      }),
    );

    render(
      <CreateFilterDialog rangeStart={RANGE_START} rangeEnd={RANGE_END} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText("phone")).toBeInTheDocument();
      expect(screen.getByText("tablet")).toBeInTheDocument();
    });
  });

  it("disables Save when no devices are available", async () => {
    render(
      <CreateFilterDialog rangeStart={RANGE_START} rangeEnd={RANGE_END} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save filter" })).toBeDisabled();
    });
  });

  it("calls createFilter with correct args and invokes onClose on save", async () => {
    mockCreateFilter.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            points: [
              {
                id: 1, lat: 1, lon: 1, tst: 1, recordedAt: RANGE_START,
                acc: null, batt: null, tid: null, alt: null, vel: null,
                deviceId: "phone",
              },
            ],
          }),
      }),
    );

    const onClose = vi.fn();
    render(
      <CreateFilterDialog rangeStart={RANGE_START} rangeEnd={RANGE_END} onClose={onClose} />,
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(screen.getByText("phone")).toBeInTheDocument());

    await userEvent.type(
      screen.getByPlaceholderText("e.g. Left phone at home"),
      "Test label",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save filter" }));

    await waitFor(() => {
      expect(mockCreateFilter).toHaveBeenCalledWith({
        fromTime: RANGE_START,
        toTime: RANGE_END,
        deviceIds: ["phone"],
        label: "Test label",
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test -- tests/unit/create-filter-dialog.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/CreateFilterDialog'`

---

## Task 5: CreateFilterDialog — implement

**Files:**
- Create: `components/CreateFilterDialog.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/CreateFilterDialog.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDeviceFilters } from "@/components/DeviceFilterProvider";
import TimeRangeSlider from "@/components/TimeRangeSlider";
import FilterPreviewMap from "@/components/FilterPreviewMap";
import type { SerializedPoint } from "@/lib/groupByHour";

type LocationsResponse = {
  points: SerializedPoint[];
};

type Props = {
  rangeStart: string;
  rangeEnd: string;
  onClose: () => void;
};

export default function CreateFilterDialog({ rangeStart, rangeEnd, onClose }: Props) {
  const { createFilter } = useDeviceFilters();

  const [fromTime, setFromTime] = useState(rangeStart);
  const [toTime, setToTime] = useState(rangeEnd);
  const [debouncedFrom, setDebouncedFrom] = useState(rangeStart);
  const [debouncedTo, setDebouncedTo] = useState(rangeEnd);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedFrom(fromTime);
      setDebouncedTo(toTime);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fromTime, toTime]);

  const { data: locationsData } = useQuery<LocationsResponse>({
    queryKey: ["filter-preview-locations", debouncedFrom, debouncedTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        start: debouncedFrom,
        end: debouncedTo,
        minLat: "-90",
        maxLat: "90",
        minLon: "-180",
        maxLon: "180",
        skipBoundsIfSmall: "true",
      });
      const res = await fetch(`/api/locations?${params}`);
      if (!res.ok) return { points: [] };
      return res.json();
    },
  });

  const allPoints = locationsData?.points ?? [];
  const availableDeviceIds = useMemo(
    () =>
      [...new Set(allPoints.map((p) => p.deviceId).filter(Boolean))] as string[],
    [allPoints],
  );

  // Auto-select all devices whenever the available set changes
  useEffect(() => {
    setSelectedDeviceIds(availableDeviceIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDeviceIds.join(",")]);

  const previewPoints = useMemo(
    () =>
      selectedDeviceIds.length > 0
        ? allPoints.filter((p) => p.deviceId && selectedDeviceIds.includes(p.deviceId))
        : [],
    [allPoints, selectedDeviceIds],
  );

  function toggleDevice(deviceId: string) {
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId)
        ? prev.filter((d) => d !== deviceId)
        : [...prev, deviceId],
    );
  }

  async function handleSave() {
    if (selectedDeviceIds.length === 0) return;
    setSaving(true);
    try {
      await createFilter({
        fromTime,
        toTime,
        deviceIds: selectedDeviceIds,
        label: label || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-hidden rounded-lg bg-white shadow-xl sm:max-w-md">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Create Device Filter</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Select a time range and which devices to show
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-xs text-gray-500">Time range</p>
            <TimeRangeSlider
              min={rangeStart}
              max={rangeEnd}
              value={[fromTime, toTime]}
              onChange={(from, to) => {
                setFromTime(from);
                setToTime(to);
              }}
            />
          </div>

          <FilterPreviewMap
            points={previewPoints}
            className="overflow-hidden rounded border border-gray-200"
          />

          <div>
            <p className="mb-1.5 text-xs text-gray-500">Show data from</p>
            {availableDeviceIds.length === 0 ? (
              <p className="text-xs text-gray-400">No devices found in this time range.</p>
            ) : (
              <div className="space-y-1.5">
                {availableDeviceIds.map((deviceId) => (
                  <label
                    key={deviceId}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDeviceIds.includes(deviceId)}
                      onChange={() => toggleDevice(deviceId)}
                      disabled={saving}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="font-mono text-gray-900">{deviceId}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Left phone at home"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-gray-900 focus:border-blue-500 focus:outline-none"
              style={{ fontSize: "16px" }}
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            disabled={saving || selectedDeviceIds.length === 0}
          >
            {saving ? "Saving…" : "Save filter"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run unit tests to confirm they pass**

```bash
pnpm test -- tests/unit/create-filter-dialog.test.tsx
```

Expected: PASS — 3 tests pass

- [ ] **Step 3: Commit**

```bash
git add components/CreateFilterDialog.tsx tests/unit/create-filter-dialog.test.tsx
git commit -m "feat: add CreateFilterDialog component"
```

---

## Task 6: Wire up ConflictsPanel

**Files:**
- Modify: `components/ConflictsPanel.tsx`

- [ ] **Step 1: Add `creatingFilter` state and import `CreateFilterDialog`**

Add to imports at the top of `components/ConflictsPanel.tsx` (after existing imports):

```tsx
import CreateFilterDialog from "@/components/CreateFilterDialog";
```

Add a new state variable after the existing `useState` declarations (around line 48):

```tsx
const [creatingFilter, setCreatingFilter] = useState(false);
```

- [ ] **Step 2: Add "Create filter" button to the Active Filters section header**

Replace the Active Filters section heading (currently at line 143-145):

```tsx
<section>
  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
    Active Filters
  </h3>
```

With:

```tsx
<section>
  <div className="mb-2 flex items-center justify-between">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      Active Filters
    </h3>
    {rangeStart && rangeEnd && (
      <button
        onClick={() => setCreatingFilter(true)}
        className="rounded bg-blue-500 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-blue-600"
      >
        + Create filter
      </button>
    )}
  </div>
```

- [ ] **Step 3: Mount `CreateFilterDialog` at the bottom of the component**

Add after the `{editingFilter && ...}` block at the bottom (before the closing `</>`):

```tsx
{creatingFilter && rangeStart && rangeEnd && (
  <CreateFilterDialog
    rangeStart={rangeStart}
    rangeEnd={rangeEnd}
    onClose={() => setCreatingFilter(false)}
  />
)}
```

- [ ] **Step 4: Run unit tests to confirm nothing is broken**

```bash
pnpm test
```

Expected: PASS — all existing tests plus the new ones pass

- [ ] **Step 5: Commit**

```bash
git add components/ConflictsPanel.tsx
git commit -m "feat: add Create filter button to ConflictsPanel"
```

---

## Task 7: E2E smoke test

**Files:**
- Modify: `tests/e2e/device-filters.spec.ts`

- [ ] **Step 1: Write the failing E2E test**

Append to `tests/e2e/device-filters.spec.ts`:

```ts
test("manual create filter dialog opens and closes", async ({ page }) => {
  await page.goto("/timeline?date=all");

  // Open the Device Filters panel
  await page.getByRole("button", { name: /Device Filters/i }).click();

  // The "Create filter" button should be visible
  const createBtn = page.getByRole("button", { name: "+ Create filter" });
  await expect(createBtn).toBeVisible();

  // Open the dialog
  await createBtn.click();

  // Dialog should appear with expected elements
  await expect(page.getByText("Create Device Filter")).toBeVisible();
  await expect(page.getByPlaceholder("e.g. Left phone at home")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save filter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();

  // Cancel closes the dialog
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Create Device Filter")).not.toBeVisible();
});
```

- [ ] **Step 2: Run E2E tests**

Ensure the dev server is running first, then:

```bash
pnpm test:e2e -- --grep "manual create filter"
```

Expected: PASS — dialog opens and closes correctly

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/device-filters.spec.ts
git commit -m "test: add E2E smoke test for manual device filter creation dialog"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Entry point (Task 6), time range slider (Tasks 1–2), map preview (Task 3), device list + label + save (Task 5), E2E (Task 7) — all spec sections covered.
- [x] **No placeholders:** All steps include exact code.
- [x] **Type consistency:** `SerializedPoint` used consistently from `@/lib/groupByHour`; `FilterPayload` from `DeviceFilterProvider`; `MapRef` from `react-map-gl/maplibre`. `TimeRangeSlider` props `[string, string]` match `CreateFilterDialog` call site `[fromTime, toTime]`.
