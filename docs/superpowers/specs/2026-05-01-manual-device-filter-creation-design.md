# Manual Device Filter Creation

**Date:** 2026-05-01

## Overview

Allow users to manually create device filters from the ConflictsPanel, without requiring the system to first detect a conflict or stationary device. The user selects a time range via an interactive slider, previews the result on a live map, and picks which devices to keep visible.

## Entry Point

A "Create filter" button is added to the top of the "Active Filters" section in `ConflictsPanel`. Clicking it opens the `CreateFilterDialog` modal.

## Dialog Layout (top to bottom)

1. **Time range slider** — dual-handle slider spanning the current map view's selected time range (`rangeStart`/`rangeEnd`). Handles snap to 1-minute increments. Labels show the selected start and end times.
2. **Mini map preview** — a lightweight MapLibre map (via `react-map-gl`, fixed ~250px height) that fetches and renders only location tracks for the selected slider range with the current device selection applied as a preview filter. Debounced 400ms on input changes.
3. **Device list** — same checkbox-style list as `ConflictResolutionDialog`. Lists unique `deviceId` values extracted from the location data already fetched for the preview map; user selects which devices to keep visible. Updates automatically when the slider range changes.
4. **Label input** — optional text field.
5. **Save / Cancel** buttons. Save is disabled until at least one device is selected.

## Components

### New

- **`CreateFilterDialog.tsx`** — the modal. Receives `rangeStart: string`, `rangeEnd: string`, and `onClose: () => void` from `ConflictsPanel`. Manages `sliderStart`, `sliderEnd`, `selectedDeviceIds`, and `label` state.
- **`TimeRangeSlider.tsx`** — dual-handle slider. Internally tracks handle positions as minute offsets from `rangeStart`. Emits `onChange(fromTime: string, toTime: string)` with ISO strings.
- **`FilterPreviewMap.tsx`** — lightweight `react-map-gl` map. Takes `fromTime`, `toTime`, `deviceIds` (kept devices). Fetches `/api/locations?start=...&end=...`, then client-side filters the result to only show `deviceIds`. Renders only the track layer. Debounced 400ms on prop changes.

### Modified

- **`ConflictsPanel.tsx`** — adds "Create filter" button and mounts `CreateFilterDialog` with current `rangeStart`/`rangeEnd`.

## Data Flow

1. User adjusts slider → `sliderStart`/`sliderEnd` state updates → `FilterPreviewMap` debounces 400ms → fetches `/api/locations?start=...&end=...` → renders filtered tracks on the map.
2. User selects/deselects devices → `FilterPreviewMap` re-filters the already-fetched location data client-side (no extra API call) → map re-renders.
3. User clicks Save → `createFilter({ fromTime, toTime, deviceIds, label })` via `useDeviceFilters()` → POST `/api/device-filters` → dialog closes → `ConflictsPanel` refreshes Active Filters list.

## Testing

### Unit tests (vitest)

- **`TimeRangeSlider`**
  - Renders with correct initial handle positions given `rangeStart`/`rangeEnd`.
  - Emits correct ISO strings on handle movement.
  - Respects 1-minute snap increments.
- **`CreateFilterDialog`**
  - Shows correct devices after time range selection.
  - Disables Save when no devices are selected.
  - Calls `createFilter` with correct args on Save.

### E2E tests (Playwright)

Extend `tests/e2e/device-filters.spec.ts`:
- Open ConflictsPanel, click "Create filter".
- Adjust time range slider, verify map preview updates.
- Select devices.
- Save and verify new filter appears in Active Filters list.
