# Stationary Device Suggestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect time ranges where one device is stationary while another is moving, and surface a "Filter out" suggestion inside `ConflictsPanel`.

**Architecture:** A new `lib/stationary-detection.ts` module detects stationary/moving patterns from location points already in memory. Results flow through `DeviceFilterContext` (same pattern as conflicts), rendered as a new section in `ConflictsPanel`. Clicking "Filter out" opens the existing `ConflictResolutionDialog` with the stationary device and time range pre-filled.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest (unit tests in `tests/unit/`), date-fns (formatting)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `lib/stationary-detection.ts` | Detection algorithm: classifies device buckets, finds stationary+moving pairs, returns `StationarySuggestion[]` |
| Create | `tests/unit/stationary-detection.test.ts` | Unit tests for detection algorithm |
| Modify | `components/DeviceFilterProvider.tsx` | Add `stationarySuggestions` + `setStationarySuggestions` to context |
| Modify | `components/map/MapWrapper.tsx` | Call `setStationarySuggestions` whenever points change |
| Modify | `components/ConflictResolutionDialog.tsx` | Add optional `preselectedDeviceId?: string` prop |
| Modify | `components/ConflictsPanel.tsx` | Add "Stationary Device Detected" section + badge |

---

### Task 1: Detection Algorithm (TDD)

**Files:**
- Create: `lib/stationary-detection.ts`
- Create: `tests/unit/stationary-detection.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/stationary-detection.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { detectStationarySuggestions } from "@/lib/stationary-detection";
import type { SerializedPoint } from "@/lib/groupByHour";

function pt(overrides: {
  deviceId?: string | null;
  lat: number;
  lon: number;
  recordedAt: string;
  vel?: number | null;
}): SerializedPoint {
  return { id: 1, tst: 0, acc: null, batt: null, tid: null, alt: null, vel: null, deviceId: null, ...overrides };
}

// Generates points for a device staying near a fixed location (stationary)
function stationaryPoints(deviceId: string, baseTime: Date, durationMinutes: number): SerializedPoint[] {
  const points: SerializedPoint[] = [];
  for (let i = 0; i < durationMinutes; i++) {
    const t = new Date(baseTime.getTime() + i * 60_000).toISOString();
    points.push(pt({ deviceId, lat: 10.0001 * (1 + (i % 3) * 0.00001), lon: 10, recordedAt: t, vel: 0 }));
  }
  return points;
}

// Generates points for a device moving ~10 m/s northward
function movingPoints(deviceId: string, baseTime: Date, durationMinutes: number): SerializedPoint[] {
  const points: SerializedPoint[] = [];
  for (let i = 0; i < durationMinutes; i++) {
    const t = new Date(baseTime.getTime() + i * 60_000).toISOString();
    const lat = 10 + (i * 60 * 10) / 111_000; // 10 m/s * 60 s per point
    points.push(pt({ deviceId, lat, lon: 10, recordedAt: t, vel: 10 }));
  }
  return points;
}

describe("detectStationarySuggestions", () => {
  it("returns empty for no points", () => {
    expect(detectStationarySuggestions([])).toEqual([]);
  });

  it("returns empty for a single device", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = stationaryPoints("phone", base, 30);
    expect(detectStationarySuggestions(points)).toEqual([]);
  });

  it("returns empty when both devices are moving", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = [
      ...movingPoints("phone", base, 30),
      ...movingPoints("watch", base, 30),
    ];
    expect(detectStationarySuggestions(points)).toEqual([]);
  });

  it("returns empty when both devices are stationary", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = [
      ...stationaryPoints("phone", base, 30),
      ...stationaryPoints("watch", base, 30),
    ];
    expect(detectStationarySuggestions(points)).toEqual([]);
  });

  it("detects suggestion when one device is stationary and the other is moving", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = [
      ...stationaryPoints("watch", base, 60),
      ...movingPoints("phone", base, 60),
    ];
    const suggestions = detectStationarySuggestions(points);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].stationaryDeviceId).toBe("watch");
    expect(suggestions[0].movingDeviceId).toBe("phone");
    expect(suggestions[0].fromTime).toBeInstanceOf(Date);
    expect(suggestions[0].toTime).toBeInstanceOf(Date);
    expect(suggestions[0].toTime.getTime()).toBeGreaterThan(suggestions[0].fromTime.getTime());
  });

  it("merges adjacent suggestion buckets into one range", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = [
      ...stationaryPoints("watch", base, 60),
      ...movingPoints("phone", base, 60),
    ];
    const suggestions = detectStationarySuggestions(points);
    // All adjacent buckets should be merged into a single suggestion
    expect(suggestions).toHaveLength(1);
  });

  it("ignores points with null deviceId", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = [
      ...stationaryPoints("watch", base, 30),
      pt({ deviceId: null, lat: 20, lon: 20, recordedAt: new Date(base.getTime() + 5 * 60_000).toISOString(), vel: 10 }),
    ];
    expect(detectStationarySuggestions(points)).toEqual([]);
  });

  it("requires minimum 3 points per device per bucket to classify", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    // Only 1 point each — not enough signal
    const points = [
      pt({ deviceId: "watch", lat: 10, lon: 10, recordedAt: base.toISOString(), vel: 0 }),
      pt({ deviceId: "phone", lat: 11, lon: 10, recordedAt: new Date(base.getTime() + 60_000).toISOString(), vel: 10 }),
    ];
    expect(detectStationarySuggestions(points)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm exec vitest run tests/unit/stationary-detection.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/stationary-detection'`

- [ ] **Step 3: Implement `lib/stationary-detection.ts`**

```typescript
import type { SerializedPoint } from "@/lib/groupByHour";

export type StationarySuggestion = {
  fromTime: Date;
  toTime: Date;
  stationaryDeviceId: string;
  movingDeviceId: string;
};

const BUCKET_MINUTES = 15;
const STATIONARY_RADIUS_M = 100;
const STATIONARY_VELOCITY_MS = 2;
const MOVING_RADIUS_M = 300;
const MOVING_VELOCITY_MS = 5;
const MIN_POINTS = 3;

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Classification = "stationary" | "moving" | "unknown";

function classifyBucket(bucketPoints: SerializedPoint[]): Classification {
  if (bucketPoints.length < MIN_POINTS) return "unknown";

  const first = bucketPoints[0];
  let maxDist = 0;
  for (const p of bucketPoints) {
    const d = haversineMeters(first.lat, first.lon, p.lat, p.lon);
    if (d > maxDist) maxDist = d;
  }

  const vels = bucketPoints.map((p) => p.vel).filter((v): v is number => v !== null);
  const avgVel = vels.length > 0 ? vels.reduce((s, v) => s + v, 0) / vels.length : 0;

  if (maxDist < STATIONARY_RADIUS_M && avgVel < STATIONARY_VELOCITY_MS) return "stationary";
  if (maxDist > MOVING_RADIUS_M || avgVel > MOVING_VELOCITY_MS) return "moving";
  return "unknown";
}

export function detectStationarySuggestions(points: SerializedPoint[]): StationarySuggestion[] {
  const devicePoints = points.filter((p) => p.deviceId !== null);
  if (devicePoints.length === 0) return [];

  const devices = [...new Set(devicePoints.map((p) => p.deviceId as string))];
  if (devices.length < 2) return [];

  const bucketMs = BUCKET_MINUTES * 60 * 1000;

  // Group by device, then by bucket
  const deviceBuckets = new Map<string, Map<number, SerializedPoint[]>>();
  for (const point of devicePoints) {
    const t = new Date(point.recordedAt).getTime();
    const bucket = Math.floor(t / bucketMs);
    if (!deviceBuckets.has(point.deviceId!)) deviceBuckets.set(point.deviceId!, new Map());
    const bucketMap = deviceBuckets.get(point.deviceId!)!;
    if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
    bucketMap.get(bucket)!.push(point);
  }

  // Classify each device per bucket
  const classifications = new Map<string, Map<number, Classification>>();
  for (const [deviceId, bucketMap] of deviceBuckets) {
    const classMap = new Map<number, Classification>();
    for (const [bucket, pts] of bucketMap) {
      classMap.set(bucket, classifyBucket(pts));
    }
    classifications.set(deviceId, classMap);
  }

  // Find buckets where device A is stationary and device B is moving
  const suggestionBuckets: { bucket: number; stationaryDeviceId: string; movingDeviceId: string }[] = [];

  for (let i = 0; i < devices.length; i++) {
    for (let j = 0; j < devices.length; j++) {
      if (i === j) continue;
      const deviceA = devices[i];
      const deviceB = devices[j];
      const classA = classifications.get(deviceA)!;
      const classB = classifications.get(deviceB)!;

      for (const [bucket, classificationA] of classA) {
        if (classificationA === "stationary" && classB.get(bucket) === "moving") {
          suggestionBuckets.push({ bucket, stationaryDeviceId: deviceA, movingDeviceId: deviceB });
        }
      }
    }
  }

  if (suggestionBuckets.length === 0) return [];

  // Group by device pair and sort by bucket
  const pairKey = (s: string, m: string) => `${s}::${m}`;
  const byPair = new Map<string, number[]>();
  const pairDevices = new Map<string, { stationaryDeviceId: string; movingDeviceId: string }>();

  for (const { bucket, stationaryDeviceId, movingDeviceId } of suggestionBuckets) {
    const key = pairKey(stationaryDeviceId, movingDeviceId);
    if (!byPair.has(key)) {
      byPair.set(key, []);
      pairDevices.set(key, { stationaryDeviceId, movingDeviceId });
    }
    byPair.get(key)!.push(bucket);
  }

  // Merge adjacent buckets (within 1-bucket gap) per pair
  const suggestions: StationarySuggestion[] = [];

  for (const [key, buckets] of byPair) {
    buckets.sort((a, b) => a - b);
    const { stationaryDeviceId, movingDeviceId } = pairDevices.get(key)!;

    let rangeStart = buckets[0];
    let rangeEnd = buckets[0];

    for (let i = 1; i < buckets.length; i++) {
      if (buckets[i] <= rangeEnd + 2) {
        rangeEnd = buckets[i];
      } else {
        suggestions.push({
          fromTime: new Date(rangeStart * bucketMs),
          toTime: new Date((rangeEnd + 1) * bucketMs),
          stationaryDeviceId,
          movingDeviceId,
        });
        rangeStart = buckets[i];
        rangeEnd = buckets[i];
      }
    }
    suggestions.push({
      fromTime: new Date(rangeStart * bucketMs),
      toTime: new Date((rangeEnd + 1) * bucketMs),
      stationaryDeviceId,
      movingDeviceId,
    });
  }

  return suggestions;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm exec vitest run tests/unit/stationary-detection.test.ts
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/stationary-detection.ts tests/unit/stationary-detection.test.ts
git commit -m "feat: add stationary device detection algorithm"
```

---

### Task 2: Expose `stationarySuggestions` in `DeviceFilterContext`

**Files:**
- Modify: `components/DeviceFilterProvider.tsx`

- [ ] **Step 1: Update the context type and provider**

In `components/DeviceFilterProvider.tsx`, add the import and update the context:

```typescript
// Add to imports at top
import type { StationarySuggestion } from "@/lib/stationary-detection";
```

Replace the `DeviceFilterContextValue` type definition (currently lines 19–27):

```typescript
type DeviceFilterContextValue = {
  filters: SerializedDeviceFilter[];
  conflicts: ConflictRange[];
  setConflicts: (conflicts: ConflictRange[]) => void;
  stationarySuggestions: StationarySuggestion[];
  setStationarySuggestions: (suggestions: StationarySuggestion[]) => void;
  createFilter: (filter: FilterPayload) => Promise<void>;
  updateFilter: (id: string, filter: FilterPayload) => Promise<void>;
  deleteFilter: (id: string) => Promise<void>;
};
```

Add state inside `DeviceFilterProvider` (after the `conflicts` state, currently around line 31):

```typescript
const [stationarySuggestions, setStationarySuggestions] = useState<StationarySuggestion[]>([]);
```

Update the `value` prop of `DeviceFilterContext.Provider` (currently line 82):

```typescript
value={{ filters, conflicts, setConflicts, stationarySuggestions, setStationarySuggestions, createFilter, updateFilter, deleteFilter }}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/DeviceFilterProvider.tsx
git commit -m "feat: expose stationarySuggestions in DeviceFilterContext"
```

---

### Task 3: Call Detection in `MapWrapper`

**Files:**
- Modify: `components/map/MapWrapper.tsx` (around lines 18, 122–126)

- [ ] **Step 1: Add import and call `detectStationarySuggestions`**

Add to the existing imports near line 18:

```typescript
import { detectStationarySuggestions } from "@/lib/stationary-detection";
```

Update the destructure from `useDeviceFilters` (currently line 122):

```typescript
const { setConflicts, setStationarySuggestions, filters: activeFilters } = useDeviceFilters();
```

Update the `useEffect` (currently lines 124–126):

```typescript
useEffect(() => {
  setConflicts(detectConflicts(points));
  setStationarySuggestions(detectStationarySuggestions(points));
}, [points, setConflicts, setStationarySuggestions]);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/map/MapWrapper.tsx
git commit -m "feat: run stationary detection when map points change"
```

---

### Task 4: Pre-populate `ConflictResolutionDialog`

**Files:**
- Modify: `components/ConflictResolutionDialog.tsx`

- [ ] **Step 1: Add `preselectedDeviceId` prop**

Replace the `Props` type (currently lines 8–11):

```typescript
type Props = {
  conflict: ConflictRange;
  onClose: () => void;
  preselectedDeviceId?: string;
};
```

Update the function signature (currently line 13):

```typescript
export default function ConflictResolutionDialog({ conflict, onClose, preselectedDeviceId }: Props) {
```

Update the `selectedDevices` initial state (currently line 15):

```typescript
const [selectedDevices, setSelectedDevices] = useState<string[]>(
  preselectedDeviceId ? [preselectedDeviceId] : [conflict.deviceIds[0]]
);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/ConflictResolutionDialog.tsx
git commit -m "feat: add preselectedDeviceId prop to ConflictResolutionDialog"
```

---

### Task 5: Render Stationary Suggestions in `ConflictsPanel`

**Files:**
- Modify: `components/ConflictsPanel.tsx`

- [ ] **Step 1: Update imports and context destructure**

Add to imports at the top of `components/ConflictsPanel.tsx`:

```typescript
import type { StationarySuggestion } from "@/lib/stationary-detection";
```

Update the `useDeviceFilters` destructure (currently line 12):

```typescript
const { filters, conflicts, stationarySuggestions, deleteFilter } = useDeviceFilters();
```

- [ ] **Step 2: Derive `unresolvedStationary` and add state**

Add after the `unresolvedConflicts` derivation (currently around line 31):

```typescript
const unresolvedStationary = stationarySuggestions.filter(
  (s) =>
    !visibleFilters.some(
      (f) =>
        new Date(f.fromTime) <= s.fromTime &&
        new Date(f.toTime) >= s.toTime &&
        !f.deviceIds.includes(s.stationaryDeviceId)
    )
);
```

Update the `open` initial state (currently line 33) to also auto-open when there are stationary suggestions:

```typescript
const [open, setOpen] = useState(() => unresolvedConflicts.length > 0 || unresolvedStationary.length > 0);
```

Add state for the resolving stationary suggestion (after line 36, after existing state declarations):

```typescript
const [resolvingStationary, setResolvingStationary] = useState<StationarySuggestion | null>(null);
```

- [ ] **Step 3: Add badge for stationary suggestions in the header**

In the header badge area (currently lines 53–64), add a yellow badge after the orange conflicts badge:

```tsx
{unresolvedStationary.length > 0 && (
  <span className="rounded-full bg-yellow-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
    {unresolvedStationary.length} stationary
  </span>
)}
```

- [ ] **Step 4: Add the "Stationary Device Detected" section**

In the open panel `div` (currently lines 68–137), add a new `<section>` before the "Active Filters" section (before the `<section>` starting at line 98):

```tsx
{unresolvedStationary.length > 0 && (
  <section>
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
      Stationary Device Detected
    </h3>
    <ul className="space-y-2">
      {unresolvedStationary.map((suggestion, i) => (
        <li key={i} className="rounded border border-yellow-200 bg-yellow-50 p-3">
          <p className="text-xs font-medium text-yellow-800">
            {suggestion.stationaryDeviceId} ·{" "}
            {format(suggestion.fromTime, "MMM d, HH:mm")} –{" "}
            {format(suggestion.toTime, "HH:mm")}
          </p>
          <p className="mt-0.5 text-xs text-yellow-600">
            Stationary while {suggestion.movingDeviceId} was moving
          </p>
          <button
            onClick={() => setResolvingStationary(suggestion)}
            className="mt-2 rounded bg-yellow-500 px-2 py-1 text-xs font-medium text-white hover:bg-yellow-600"
          >
            Filter out
          </button>
        </li>
      ))}
    </ul>
  </section>
)}
```

- [ ] **Step 5: Wire up the dialog for stationary suggestions**

After the existing `{resolvingConflict && ...}` block (currently lines 140–145), add:

```tsx
{resolvingStationary && (
  <ConflictResolutionDialog
    conflict={{
      fromTime: resolvingStationary.fromTime,
      toTime: resolvingStationary.toTime,
      deviceIds: [resolvingStationary.movingDeviceId, resolvingStationary.stationaryDeviceId],
    }}
    preselectedDeviceId={resolvingStationary.movingDeviceId}
    onClose={() => setResolvingStationary(null)}
  />
)}
```

- [ ] **Step 6: Verify TypeScript compiles and linter is clean**

```bash
pnpm exec tsc --noEmit && pnpm exec eslint components/ConflictsPanel.tsx
```

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add components/ConflictsPanel.tsx
git commit -m "feat: show stationary device suggestions in ConflictsPanel"
```

---

### Task 6: Run Full Test Suite

- [ ] **Step 1: Run all unit tests**

```bash
pnpm exec vitest run
```

Expected: All tests PASS, including the new `stationary-detection` tests

- [ ] **Step 2: Run linter on all changed files**

```bash
pnpm exec eslint lib/stationary-detection.ts components/DeviceFilterProvider.tsx components/map/MapWrapper.tsx components/ConflictResolutionDialog.tsx components/ConflictsPanel.tsx
```

Expected: No errors or warnings
