# Stationary Device Suggestion — Design Spec

**Date:** 2026-04-22

## Overview

Auto-detect time ranges where one device is stationary while another is moving, and surface a suggestion inside `ConflictsPanel` to filter out the stationary device.

## Problem

When a user carries one tracker (phone) and leaves another behind (watch, car tracker), the stationary device still emits location points. This creates noise in the timeline without triggering the existing conflict detection (which only fires when devices diverge spatially). The user should be prompted to filter out the idle device.

## Data Flow

1. Map location points (already fetched by `MapWrapper`, passed into `DeviceFilterProvider`) are used as input — no new API calls.
2. `detectStationarySuggestions(points)` runs client-side whenever points change.
3. Results are stored in `DeviceFilterContext` as `stationarySuggestions`.
4. `ConflictsPanel` reads `stationarySuggestions` and renders a new section.
5. Clicking "Filter out" opens the existing `ConflictResolutionDialog` with pre-populated fields.

## Detection Algorithm (`lib/stationary-detection.ts`)

### Types

```typescript
type StationarySuggestion = {
  fromTime: Date;
  toTime: Date;
  stationaryDeviceId: string;
  movingDeviceId: string;
};
```

### Algorithm

1. Group all `SerializedPoint[]` by `deviceId`.
2. Skip devices with fewer than 3 points in the time range (not enough signal).
3. Split each device's points into **15-minute buckets** by `recordedAt`.
4. For each device+bucket, compute:
   - **Displacement**: max Haversine distance (meters) from the first point in the bucket to any other point in the bucket.
   - **Avg velocity**: mean of non-null `vel` values; treat all-null as 0.
5. Classify each bucket per device:
   - `stationary`: displacement < 100m AND avg velocity < 2 m/s
   - `moving`: displacement > 300m OR avg velocity > 5 m/s
   - `unknown`: anything else
6. For each pair of devices (A, B), find buckets where A is `stationary` AND B is `moving`.
7. Merge adjacent buckets (within one bucket gap) into contiguous `StationarySuggestion` ranges.
8. Deduplicate: discard suggestions where an existing `DeviceFilterRecord` already covers the same `stationaryDeviceId` and overlaps the time range.

### Thresholds (constants, easy to tune)

| Constant | Value | Meaning |
|----------|-------|---------|
| `BUCKET_MINUTES` | 15 | Time bucket size |
| `STATIONARY_RADIUS_M` | 100 | Max displacement to be considered stationary |
| `STATIONARY_VELOCITY_MS` | 2 | Max avg velocity to be considered stationary |
| `MOVING_RADIUS_M` | 300 | Min displacement to be considered moving |
| `MOVING_VELOCITY_MS` | 5 | Min avg velocity to be considered moving |
| `MIN_POINTS` | 3 | Minimum points per device to evaluate |

## `DeviceFilterProvider` Changes

- Add `stationarySuggestions: StationarySuggestion[]` to `DeviceFilterContext`.
- Call `detectStationarySuggestions(points)` whenever the points prop changes (same lifecycle as conflict detection).
- Pass `deviceFilters` into `detectStationarySuggestions` for deduplication against existing filters.

## `ConflictsPanel` UI Changes

Add a new section below existing conflict ranges: **"Stationary Device Detected"**.

Each suggestion renders:
- **Header**: `[stationaryDeviceId]` · `[fromTime] – [toTime]` (formatted same as existing conflict time ranges)
- **Subtext**: `Stationary while [movingDeviceId] was moving`
- **Action button**: "Filter out" → opens `ConflictResolutionDialog`

Section is hidden when `stationarySuggestions` is empty.

## `ConflictResolutionDialog` Changes

Add optional props:

```typescript
preselectedDeviceId?: string;
preselectedFromTime?: Date;
preselectedToTime?: Date;
```

When provided, pre-fill the device selector and time range inputs. Fields remain editable — the user can adjust before confirming.

## Testing

- Unit tests for `detectStationarySuggestions`:
  - Single stationary device with no moving counterpart → no suggestions
  - Two devices both moving → no suggestions
  - One stationary, one moving → one suggestion with correct time range
  - Existing filter covering the range → suggestion deduplicated out
  - Adjacent buckets merged into single suggestion
- E2E: render `ConflictsPanel` with mock suggestions → "Stationary Device Detected" section visible; click "Filter out" → dialog opens with pre-filled device and time range.

## Out of Scope

- Server-side detection
- Notifications or alerts outside the ConflictsPanel
- Automatic (no-confirmation) filter creation
