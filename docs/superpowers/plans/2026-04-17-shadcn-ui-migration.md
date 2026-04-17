# shadcn/ui Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate OpenTimeline from hand-rolled Tailwind components to shadcn/ui for a modern, accessible, polished UI.

**Architecture:** Progressive migration — install shadcn/ui foundation first, then replace components bottom-up (primitives → modals → layout → panels → polish). Each task produces a working app that can be tested in the browser. No breaking changes between tasks.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui (Radix + Tailwind), pnpm, vitest

---

## Task 1: shadcn/ui Foundation Setup

**Files:**
- Create: `components.json`
- Create: `lib/utils.ts`
- Modify: `app/globals.css`
- Create: `components/ui/` (directory, populated by shadcn CLI)

- [ ] **Step 1: Initialize shadcn/ui**

Run:
```bash
pnpm dlx shadcn@latest init
```

When prompted:
- Style: **New York**
- Base color: **Neutral**
- CSS variables for theming: **Yes**
- CSS file location: `app/globals.css`
- Tailwind config path: (accept default — Tailwind v4 uses CSS-based config)
- Components alias: `@/components`
- Utils alias: `@/lib/utils`
- React Server Components: **Yes**

This creates `components.json`, `lib/utils.ts`, and adds CSS variables to `globals.css`.

- [ ] **Step 2: Verify lib/utils.ts was created**

Run:
```bash
cat lib/utils.ts
```

Expected: File exists with `cn()` function using `clsx` and `tailwind-merge`.

- [ ] **Step 3: Preserve existing CSS variables**

The init may overwrite `globals.css`. Ensure the existing custom variables (`--surface`, `--surface-muted`, `--surface-hover`, `--line`, `--line-strong`, `--line-soft`, `--text-primary`, `--text-secondary`, `--text-muted`, `--text-faint`) and the dark mode overrides (`html.dark .bg-white`, etc.) and the leaflet/scrollbar styles are all still present. Merge the shadcn-generated CSS variables alongside the existing ones.

The final `globals.css` should have:
1. `@import "tailwindcss";` at the top
2. shadcn CSS variables in `:root` and `.dark` blocks
3. The existing custom variables (`--surface`, `--line`, `--text-*`) in `:root` and `html.dark`
4. The existing dark mode class overrides (`html.dark .bg-white`, etc.)
5. The existing leaflet and scrollbar styles
6. The `@theme inline` block with existing font/color mappings

- [ ] **Step 4: Install the shadcn components we need**

Run each command (shadcn installs one component at a time):
```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add label
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add alert-dialog
pnpm dlx shadcn@latest add sheet
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add badge
pnpm dlx shadcn@latest add tabs
pnpm dlx shadcn@latest add tooltip
pnpm dlx shadcn@latest add skeleton
pnpm dlx shadcn@latest add slider
pnpm dlx shadcn@latest add select
pnpm dlx shadcn@latest add separator
pnpm dlx shadcn@latest add scroll-area
pnpm dlx shadcn@latest add radio-group
pnpm dlx shadcn@latest add sonner
pnpm dlx shadcn@latest add collapsible
```

- [ ] **Step 5: Verify the app still builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds with no errors. The existing components are untouched.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: initialize shadcn/ui foundation with all needed components"
```

---

## Task 2: Add Custom Badge Variants

**Files:**
- Modify: `components/ui/badge.tsx`

shadcn's default `Badge` only has `default`, `secondary`, `destructive`, and `outline` variants. We need `warning` (amber) and `success` (green) for visit status indicators.

- [ ] **Step 1: Add warning and success variants to Badge**

Open `components/ui/badge.tsx` and add two new variants to the `badgeVariants` cva call:

```typescript
warning:
  "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
success:
  "border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
```

- [ ] **Step 2: Verify the app still builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ui/badge.tsx
git commit -m "feat(ui): add warning and success badge variants"
```

---

## Task 3: Migrate Toasts to Sonner

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/timeline/layout.tsx`

Replace the inline toast state management with Sonner's `toast()` function.

- [ ] **Step 1: Add Toaster to root layout**

In `app/layout.tsx`, add the Sonner `Toaster` component inside the `<body>` tag, after `<QueryProvider>`:

```tsx
import { Toaster } from "@/components/ui/sonner";

// Inside RootLayout return, after <QueryProvider>{children}</QueryProvider>:
<Toaster position="top-center" />
```

- [ ] **Step 2: Replace inline toast in timeline layout**

In `app/timeline/layout.tsx`:

1. Remove the `toast` state, `toastTimer` ref, and `showToast` function (lines 52-59)
2. Remove the inline toast `<div>` from JSX (lines 169-173)
3. Import `toast` from `sonner`:
   ```tsx
   import { toast } from "sonner";
   ```
4. Replace the `showToast(...)` call in `detectVisits` (line 98-101) with:
   ```tsx
   toast(
     total === 0
       ? "No new visit suggestions found"
       : `${total} new visit suggestion${total === 1 ? "" : "s"} detected`
   );
   ```

- [ ] **Step 3: Verify the app builds and toast works**

Run:
```bash
pnpm build
```

Start dev server, trigger a detect action, verify the Sonner toast appears at the top center with smooth animation.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/timeline/layout.tsx
git commit -m "feat: replace inline toast with sonner"
```

---

## Task 4: Migrate PlaceCreationModal to Dialog

**Files:**
- Modify: `components/PlaceCreationModal.tsx`

- [ ] **Step 1: Rewrite PlaceCreationModal using Dialog**

Replace the entire component with:

```tsx
"use client";

import { useState } from "react";
import type { PlaceData } from "@/lib/detectVisits";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  lat: number;
  lon: number;
  supersedesVisitId?: number;
  onClose: () => void;
  onCreated: (place: PlaceData) => void;
};

export default function PlaceCreationModal({ lat, lon, supersedesVisitId, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [radius, setRadius] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), lat, lon, radius, supersedesVisitId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create place");
        return;
      }
      const { place } = await res.json();
      onCreated(place);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Place</DialogTitle>
          <DialogDescription>
            {lat.toFixed(5)}, {lon.toFixed(5)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="place-name">Name</Label>
            <Input
              id="place-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Home, Work, Gym"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="place-radius">Radius (meters)</Label>
            <Input
              id="place-radius"
              type="number"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              min={10}
              max={5000}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Test in browser**

Start dev server, click on the map, verify the Create Place modal opens with smooth animation, has proper focus trapping, closes on escape, and the form works correctly.

- [ ] **Step 4: Commit**

```bash
git add components/PlaceCreationModal.tsx
git commit -m "feat: migrate PlaceCreationModal to shadcn Dialog"
```

---

## Task 5: Migrate EditVisitModal to Dialog

**Files:**
- Modify: `components/EditVisitModal.tsx`

- [ ] **Step 1: Rewrite EditVisitModal using Dialog**

Replace the entire component with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PlaceData } from "@/lib/detectVisits";
import type { Visit } from "@/components/VisitCard";
import { toDateTimeLocalValue } from "@/lib/placeDetailUtils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NearbyPlaceOption = {
  id: number;
  name: string;
  distanceM: number;
};

type Props = {
  visit: Visit;
  placeInfo: PlaceData;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditVisitModal({ visit, placeInfo, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [editArrivalAt, setEditArrivalAt] = useState(toDateTimeLocalValue(visit.arrivalAt));
  const [editDepartureAt, setEditDepartureAt] = useState(toDateTimeLocalValue(visit.departureAt));
  const [editPlaceId, setEditPlaceId] = useState<number | null>(placeInfo.id);
  const [editStatus, setEditStatus] = useState(visit.status);
  const [editVisitError, setEditVisitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlaceOption[]>([]);
  const [loadingNearbyPlaces, setLoadingNearbyPlaces] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoadingNearbyPlaces(true);
      try {
        const res = await fetch(`/api/visits/${visit.id}/nearby-places`);
        if (res.ok) {
          const data = await res.json();
          setNearbyPlaces(Array.isArray(data.places) ? data.places : []);
        }
      } catch {
        // ignore
      } finally {
        setLoadingNearbyPlaces(false);
      }
    })();
  }, [visit.id]);

  const placeOptions = useMemo(() => {
    const others = nearbyPlaces.filter((p) => p.id !== placeInfo.id);
    return [{ id: placeInfo.id, name: placeInfo.name, distanceM: 0 }, ...others];
  }, [nearbyPlaces, placeInfo.id, placeInfo.name]);

  async function handleSave() {
    const arrivalDate = new Date(editArrivalAt);
    const departureDate = new Date(editDepartureAt);
    if (Number.isNaN(arrivalDate.getTime()) || Number.isNaN(departureDate.getTime())) {
      setEditVisitError("Arrival and departure time are required");
      return;
    }
    if (departureDate.getTime() <= arrivalDate.getTime()) {
      setEditVisitError("Departure time must be after arrival time");
      return;
    }
    if (editPlaceId == null) {
      setEditVisitError("Please select a place");
      return;
    }
    setSaving(true);
    setEditVisitError(null);
    try {
      const res = await fetch(`/api/visits/${visit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: editPlaceId,
          arrivalAt: arrivalDate.toISOString(),
          departureAt: departureDate.toISOString(),
          status: editStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditVisitError(data.error ?? "Failed to update visit");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
      onSaved();
    } catch {
      setEditVisitError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this visit? This action cannot be undone.")) return;
    setSaving(true);
    setEditVisitError(null);
    try {
      const res = await fetch(`/api/visits/${visit.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setEditVisitError(data.error ?? "Failed to delete visit");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
      onSaved();
    } catch {
      setEditVisitError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Visit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-arrival">Arrival</Label>
            <Input
              id="edit-arrival"
              type="datetime-local"
              value={editArrivalAt}
              onChange={(e) => setEditArrivalAt(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-departure">Departure</Label>
            <Input
              id="edit-departure"
              type="datetime-local"
              value={editDepartureAt}
              onChange={(e) => setEditDepartureAt(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-place">Place</Label>
            <select
              id="edit-place"
              value={editPlaceId != null ? String(editPlaceId) : ""}
              onChange={(e) => setEditPlaceId(e.target.value ? Number(e.target.value) : null)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving || loadingNearbyPlaces}
            >
              {placeOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === placeInfo.id ? `${p.name} (current)` : `${p.name} (${p.distanceM}m)`}
                </option>
              ))}
            </select>
            {loadingNearbyPlaces && <p className="text-xs text-muted-foreground">Loading nearby places…</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <select
              id="edit-status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving}
            >
              <option value="suggested">Suggested</option>
              <option value="confirmed">Confirmed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {editVisitError && <p className="text-xs text-destructive">{editVisitError}</p>}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={saving}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !editArrivalAt || !editDepartureAt || editPlaceId == null}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/EditVisitModal.tsx
git commit -m "feat: migrate EditVisitModal to shadcn Dialog"
```

---

## Task 6: Migrate SettingsModal to Dialog + Tabs

**Files:**
- Modify: `components/SettingsModal.tsx`

- [ ] **Step 1: Rewrite SettingsModal using Dialog and Tabs**

Replace the entire component with:

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type AppSettings = {
  sessionGapMinutes: number;
  minDwellMinutes: number;
  postDepartureMinutes: number;
  unknownClusterRadiusM: number;
  unknownSessionGapMinutes: number;
  unknownMinDwellMinutes: number;
};

const DEFAULTS: AppSettings = {
  sessionGapMinutes: 15,
  minDwellMinutes: 15,
  postDepartureMinutes: 15,
  unknownClusterRadiusM: 50,
  unknownSessionGapMinutes: 15,
  unknownMinDwellMinutes: 15,
};

type Props = {
  onClose: () => void;
};

function SettingsField({
  label,
  hint,
  value,
  unit,
  min = 1,
  max = 120,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
          min={min}
          max={max}
          className="w-24"
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export default function SettingsModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  const [sessionGap, setSessionGap] = useState<number | null>(null);
  const [minDwell, setMinDwell] = useState<number | null>(null);
  const [postDeparture, setPostDeparture] = useState<number | null>(null);
  const [unknownClusterRadius, setUnknownClusterRadius] = useState<number | null>(null);
  const [unknownSessionGap, setUnknownSessionGap] = useState<number | null>(null);
  const [unknownMinDwell, setUnknownMinDwell] = useState<number | null>(null);

  const cur = (local: number | null, key: keyof AppSettings) =>
    local ?? settings?.[key] ?? DEFAULTS[key];

  const currentSessionGap = cur(sessionGap, "sessionGapMinutes");
  const currentMinDwell = cur(minDwell, "minDwellMinutes");
  const currentPostDeparture = cur(postDeparture, "postDepartureMinutes");
  const currentUnknownClusterRadius = cur(unknownClusterRadius, "unknownClusterRadiusM");
  const currentUnknownSessionGap = cur(unknownSessionGap, "unknownSessionGapMinutes");
  const currentUnknownMinDwell = cur(unknownMinDwell, "unknownMinDwellMinutes");

  const mutation = useMutation({
    mutationFn: (data: AppSettings) =>
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });

  function handleSave() {
    mutation.mutate({
      sessionGapMinutes: currentSessionGap,
      minDwellMinutes: currentMinDwell,
      postDepartureMinutes: currentPostDeparture,
      unknownClusterRadiusM: currentUnknownClusterRadius,
      unknownSessionGapMinutes: currentUnknownSessionGap,
      unknownMinDwellMinutes: currentUnknownMinDwell,
    });
  }

  function handleReset() {
    setSessionGap(DEFAULTS.sessionGapMinutes);
    setMinDwell(DEFAULTS.minDwellMinutes);
    setPostDeparture(DEFAULTS.postDepartureMinutes);
    setUnknownClusterRadius(DEFAULTS.unknownClusterRadiusM);
    setUnknownSessionGap(DEFAULTS.unknownSessionGapMinutes);
    setUnknownMinDwell(DEFAULTS.unknownMinDwellMinutes);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="visit-detection">
          <TabsList>
            <TabsTrigger value="visit-detection">Visit detection</TabsTrigger>
          </TabsList>
          <TabsContent value="visit-detection" className="space-y-6 pt-2">
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Known places
                  </h3>
                  <SettingsField
                    label="Time gap to split sessions"
                    hint="A gap longer than this between location points splits a visit into two separate sessions."
                    value={currentSessionGap}
                    unit="minutes"
                    onChange={(v) => setSessionGap(v)}
                  />
                  <SettingsField
                    label="Minimum dwell time"
                    hint="Sessions shorter than this are discarded and not counted as visits."
                    value={currentMinDwell}
                    unit="minutes"
                    onChange={(v) => setMinDwell(v)}
                  />
                  <SettingsField
                    label="Post-departure evidence window"
                    hint="A point outside the place radius must appear within this window after the last recorded point to confirm departure."
                    value={currentPostDeparture}
                    unit="minutes"
                    onChange={(v) => setPostDeparture(v)}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Unknown places
                  </h3>
                  <SettingsField
                    label="Cluster radius"
                    hint="Location points within this radius of a cluster's center are grouped into the same cluster."
                    value={currentUnknownClusterRadius}
                    unit="meters"
                    min={1}
                    max={500}
                    onChange={(v) => setUnknownClusterRadius(v)}
                  />
                  <SettingsField
                    label="Time gap to split clusters"
                    hint="A gap longer than this between consecutive points splits a cluster into two separate visits."
                    value={currentUnknownSessionGap}
                    unit="minutes"
                    onChange={(v) => setUnknownSessionGap(v)}
                  />
                  <SettingsField
                    label="Minimum dwell time"
                    hint="Clusters shorter than this are discarded and not counted as unknown visits."
                    value={currentUnknownMinDwell}
                    unit="minutes"
                    onChange={(v) => setUnknownMinDwell(v)}
                  />
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={mutation.isPending || isLoading}>
              {saved ? "Saved!" : mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/SettingsModal.tsx
git commit -m "feat: migrate SettingsModal to shadcn Dialog + Tabs"
```

---

## Task 7: Migrate PhotoModal to Dialog

**Files:**
- Modify: `components/PhotoModal.tsx`

- [ ] **Step 1: Rewrite PhotoModal using Dialog**

Replace the entire component with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { ImmichPhoto } from "@/lib/immich";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  photos: ImmichPhoto[];
  initialIndex: number;
  onClose: () => void;
};

export default function PhotoModal({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [loadedPhotoId, setLoadedPhotoId] = useState<string | null>(null);
  const photo = photos[index];
  const isLoading = loadedPhotoId !== photo?.id;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(photos.length - 1, i + 1));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [photos.length]);

  if (!photo) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl border-none bg-transparent p-0 shadow-none [&>button]:text-white [&>button]:hover:text-white/80">
        <div className="flex max-h-[94vh] flex-col">
          <div className="relative h-[calc(94vh-56px)] w-full rounded-t-lg bg-black/60">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-white/70">
                Loading photo...
              </div>
            )}
            <img
              key={photo.id}
              src={`/api/immich/thumbnail?id=${photo.id}&size=preview`}
              alt=""
              onLoad={() => setLoadedPhotoId(photo.id)}
              onError={() => setLoadedPhotoId(photo.id)}
              className={`h-full w-full object-contain shadow-2xl ${isLoading ? "invisible" : "visible"}`}
            />
          </div>
          <div className="flex items-center justify-between rounded-b-lg bg-black/70 px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-25"
            >
              ‹
            </Button>
            <div className="text-center">
              <p className="text-sm text-white">
                {format(new Date(photo.takenAt), "MMM d, yyyy HH:mm")}
              </p>
              {photos.length > 1 && (
                <p className="text-xs text-white/50">{index + 1} / {photos.length}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIndex((i) => Math.min(photos.length - 1, i + 1))}
              disabled={index === photos.length - 1}
              className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-25"
            >
              ›
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/PhotoModal.tsx
git commit -m "feat: migrate PhotoModal to shadcn Dialog"
```

---

## Task 8: Migrate CreateVisitModal to Dialog

**Files:**
- Modify: `components/CreateVisitModal.tsx`

- [ ] **Step 1: Rewrite CreateVisitModal using Dialog**

Replace the entire component with:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { format, differenceInMinutes } from "date-fns";
import type { PlaceData } from "@/lib/detectVisits";
import { haversineKm } from "@/lib/geo";
import NewPlaceOption from "./NewPlaceOption";
import CustomPeriodOption from "./CustomPeriodOption";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

const DEFAULT_SCAN_RADIUS_M = 50;

type DetectedPeriod = {
  arrivalAt: Date;
  departureAt: Date;
  pointCount: number;
};

function formatDuration(minutes: number): string {
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type Props = {
  lat: number;
  lon: number;
  places: PlaceData[];
  rangeStart?: string;
  rangeEnd?: string;
  onClose: () => void;
  onCreated: () => void;
};

export default function CreateVisitModal({ lat, lon, places, rangeStart, rangeEnd, onClose, onCreated }: Props) {
  const [scanRadius, setScanRadius] = useState(() => {
    const firstPlace = [...places]
      .map((p) => ({ ...p, distM: haversineKm(lat, lon, p.lat, p.lon) * 1000 }))
      .filter((p) => p.distM <= 1000)
      .sort((a, b) => a.distM - b.distM)[0];
    return firstPlace?.radius ?? DEFAULT_SCAN_RADIUS_M;
  });
  const [detectedPeriods, setDetectedPeriods] = useState<DetectedPeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);

  const [debouncedRadius, setDebouncedRadius] = useState(scanRadius);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedRadius(scanRadius), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [scanRadius]);

  const sortedPlaces = [...places]
    .map((p) => ({ ...p, distM: haversineKm(lat, lon, p.lat, p.lon) * 1000 }))
    .filter((p) => p.distM <= 1000)
    .sort((a, b) => a.distM - b.distM);

  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(
    () => sortedPlaces[0]?.id ?? null
  );
  const [isNewPlace, setIsNewPlace] = useState(() => sortedPlaces.length === 0);

  useEffect(() => {
    const selectedPlace = sortedPlaces.find((p) => p.id === selectedPlaceId);
    const detectionLat = selectedPlace?.lat ?? lat;
    const detectionLon = selectedPlace?.lon ?? lon;

    setPeriodsLoading(true);
    const params = new URLSearchParams({
      lat: String(detectionLat),
      lon: String(detectionLon),
      radiusM: String(debouncedRadius),
      ...(rangeStart ? { rangeStart } : {}),
      ...(rangeEnd ? { rangeEnd } : {}),
    });
    fetch(`/api/visits/detect-periods?${params}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { arrivalAt: string; departureAt: string; pointCount: number }[]) => {
        setDetectedPeriods(
          data.map((d) => ({
            arrivalAt: new Date(d.arrivalAt),
            departureAt: new Date(d.departureAt),
            pointCount: d.pointCount,
          }))
        );
      })
      .catch(() => setDetectedPeriods([]))
      .finally(() => setPeriodsLoading(false));
  }, [lat, lon, selectedPlaceId, debouncedRadius, rangeStart, rangeEnd]);

  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceRadius, setNewPlaceRadius] = useState(50);
  const [periodIndex, setPeriodIndex] = useState<number>(-1);
  const [customStart, setCustomStart] = useState<string>(() =>
    format(new Date(Date.now() - 3_600_000), "yyyy-MM-dd'T'HH:mm")
  );
  const [customEnd, setCustomEnd] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPeriodIndex((prev) => {
      if (prev === -1) return detectedPeriods.length > 0 ? 0 : -1;
      if (prev < detectedPeriods.length) return prev;
      return detectedPeriods.length > 0 ? 0 : -1;
    });
  }, [detectedPeriods]);

  const canSubmit =
    (isNewPlace ? newPlaceName.trim().length > 0 : selectedPlaceId !== null) &&
    (periodIndex >= 0 || (customStart.length > 0 && customEnd.length > 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const period = periodIndex >= 0 ? detectedPeriods[periodIndex] : null;
    const arrivalAt = period ? period.arrivalAt.toISOString() : new Date(customStart).toISOString();
    const departureAt = period ? period.departureAt.toISOString() : new Date(customEnd).toISOString();

    if (new Date(arrivalAt) >= new Date(departureAt)) {
      setError("Arrival must be before departure");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      let placeId = selectedPlaceId;

      if (isNewPlace) {
        const placeRes = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newPlaceName.trim(), lat, lon, radius: newPlaceRadius }),
        });
        if (!placeRes.ok) {
          const data = await placeRes.json().catch(() => null);
          setError(data?.error ?? "Failed to create place");
          return;
        }
        const { place } = await placeRes.json();
        placeId = place.id;
      }

      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, arrivalAt, departureAt, status: "confirmed" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to create visit");
        return;
      }
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Visit</DialogTitle>
          <DialogDescription>
            {lat.toFixed(5)}, {lon.toFixed(5)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Place */}
          <div className="space-y-2">
            <Label>Place</Label>
            <div className="max-h-62.5 overflow-y-auto rounded-md border">
              {sortedPlaces.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-muted"
                >
                  <input
                    type="radio"
                    name="place"
                    checked={!isNewPlace && selectedPlaceId === p.id}
                    onChange={() => { setSelectedPlaceId(p.id); setIsNewPlace(false); setScanRadius(p.radius); }}
                    className="shrink-0"
                  />
                  <span className="flex-1 text-sm">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.distM < 1000
                      ? `${Math.round(p.distM)}m`
                      : `${(p.distM / 1000).toFixed(1)}km`}
                  </span>
                </label>
              ))}
              <NewPlaceOption
                isNewPlace={isNewPlace}
                setIsNewPlace={setIsNewPlace}
                newPlaceName={newPlaceName}
                setNewPlaceName={setNewPlaceName}
                newPlaceRadius={newPlaceRadius}
                setNewPlaceRadius={setNewPlaceRadius}
              />
            </div>
          </div>

          <Separator />

          {/* Time period */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Time period</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Scan radius</span>
                <Slider
                  min={20}
                  max={500}
                  step={10}
                  value={[scanRadius]}
                  onValueChange={([v]) => setScanRadius(v)}
                  className="w-24"
                />
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{scanRadius}m</span>
              </div>
            </div>
            <div className="rounded-md border">
              {periodsLoading ? (
                <p className="px-3 py-3 text-xs text-muted-foreground">Detecting periods…</p>
              ) : (
                detectedPeriods.map((period, i) => {
                  const mins = differenceInMinutes(period.departureAt, period.arrivalAt);
                  return (
                    <label
                      key={i}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-muted"
                    >
                      <input
                        type="radio"
                        name="period"
                        checked={periodIndex === i}
                        onChange={() => setPeriodIndex(i)}
                        className="shrink-0"
                      />
                      <span className="flex-1 text-sm">
                        {format(period.arrivalAt, "MMM d, HH:mm")} –{" "}
                        {format(period.departureAt, "HH:mm")}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDuration(mins)} · {period.pointCount} pts
                      </span>
                    </label>
                  );
                })
              )}
              <CustomPeriodOption
                periodIndex={periodIndex}
                setPeriodIndex={setPeriodIndex}
                customStart={customStart}
                setCustomStart={setCustomStart}
                customEnd={customEnd}
                setCustomEnd={setCustomEnd}
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? "Creating…" : isNewPlace ? "Create Place & Visit" : "Create Visit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/CreateVisitModal.tsx
git commit -m "feat: migrate CreateVisitModal to shadcn Dialog + Slider"
```

---

## Task 9: Extract Place-Move Confirmation to AlertDialog

**Files:**
- Create: `components/PlaceMoveConfirmDialog.tsx`
- Modify: `components/map/MapWrapper.tsx`

- [ ] **Step 1: Create PlaceMoveConfirmDialog component**

Create `components/PlaceMoveConfirmDialog.tsx`:

```tsx
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
  placeName: string;
  lat: number;
  lon: number;
  error: string | null;
  updating: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function PlaceMoveConfirmDialog({
  placeName,
  lat,
  lon,
  error,
  updating,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update place location?</AlertDialogTitle>
          <AlertDialogDescription>
            Move <span className="font-medium text-foreground">{placeName}</span> to this location?
            <br />
            <span className="text-xs">{lat.toFixed(5)}, {lon.toFixed(5)}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={updating}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={updating}>
            {updating ? "Updating…" : "Update location"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 2: Update MapWrapper to use PlaceMoveConfirmDialog**

In `components/map/MapWrapper.tsx`, replace the inline `pendingPlaceMove` JSX block (lines 299-335) with:

```tsx
import PlaceMoveConfirmDialog from "@/components/PlaceMoveConfirmDialog";
```

And replace the JSX:

```tsx
{pendingPlaceMove && (
  <PlaceMoveConfirmDialog
    placeName={pendingPlaceMove.place.name}
    lat={pendingPlaceMove.lat}
    lon={pendingPlaceMove.lon}
    error={placeMoveError}
    updating={updatingPlaceMove}
    onConfirm={handleConfirmPlaceMove}
    onCancel={() => {
      if (updatingPlaceMove) return;
      setPendingPlaceMove(null);
      setPlaceMoveError(null);
    }}
  />
)}
```

- [ ] **Step 3: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/PlaceMoveConfirmDialog.tsx components/map/MapWrapper.tsx
git commit -m "feat: extract place-move confirm to shadcn AlertDialog"
```

---

## Task 10: Migrate Timeline Layout — Mobile Sidebar to Sheet

**Files:**
- Modify: `app/timeline/layout.tsx`

- [ ] **Step 1: Replace mobile sidebar with Sheet**

Rewrite `app/timeline/layout.tsx`:

```tsx
"use client";

import { useState, useMemo, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import MapWrapper from "@/components/map/MapWrapper";
import PlacesPanel from "@/components/PlacesPanel";
import VisitSuggestionsPanel from "@/components/VisitSuggestionsPanel";
import UnknownVisitSuggestionsPanel from "@/components/UnknownVisitSuggestionsPanel";
import ImportGpxButton from "@/components/ImportGpxButton";
import ImportImmichButton from "@/components/ImportImmichButton";
import SettingsModal from "@/components/SettingsModal";
import AsideHeader from "@/components/AsideHeader";
import { getRangeBounds } from "@/lib/getRangeBounds";
import type { RangeType } from "@/app/timeline/[date]/page";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const VALID_RANGES: RangeType[] = ["day", "week", "month", "year", "custom", "all"];

function SidebarContent({
  children,
  rangeStart,
  rangeEnd,
  settingsOpen,
  setSettingsOpen,
  settingsModalOpen,
  setSettingsModalOpen,
}: {
  children: React.ReactNode;
  rangeStart?: string;
  rangeEnd?: string;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {children}
      <PlacesPanel />
      <VisitSuggestionsPanel />
      <UnknownVisitSuggestionsPanel />
      <div className="absolute bottom-4 left-4 z-10">
        {settingsOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-56 rounded-md border bg-popover p-2 shadow-lg">
            <ImportGpxButton />
            <ImportImmichButton rangeStart={rangeStart} rangeEnd={rangeEnd} />
            <div className="my-1 border-t" />
            <button
              type="button"
              onClick={() => { setSettingsOpen(false); setSettingsModalOpen(true); }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.223 1.164a6.98 6.98 0 0 1 1.48.85l1.08-.54a1 1 0 0 1 1.232.236l1.668 1.668a1 1 0 0 1 .236 1.232l-.54 1.08c.332.46.616.958.85 1.48l1.164.223a1 1 0 0 1 .804.98v2.36a1 1 0 0 1-.804.98l-1.164.223a6.98 6.98 0 0 1-.85 1.48l.54 1.08a1 1 0 0 1-.236 1.232l-1.668 1.668a1 1 0 0 1-1.232.236l-1.08-.54a6.98 6.98 0 0 1-1.48.85l-.223 1.164a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.223-1.164a6.98 6.98 0 0 1-1.48-.85l-1.08.54a1 1 0 0 1-1.232-.236L2.157 16.61a1 1 0 0 1-.236-1.232l.54-1.08a6.98 6.98 0 0 1-.85-1.48l-1.164-.223A1 1 0 0 1 .643 11.615v-2.36a1 1 0 0 1 .804-.98l1.164-.223a6.98 6.98 0 0 1 .85-1.48l-.54-1.08a1 1 0 0 1 .236-1.232L4.825 2.592a1 1 0 0 1 1.232-.236l1.08.54c.46-.332.958-.616 1.48-.85l.223-1.164ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
              </svg>
              Settings
            </button>
          </div>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full shadow-md"
                onClick={() => setSettingsOpen((o: boolean) => !o)}
                aria-expanded={settingsOpen}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.223 1.164a6.98 6.98 0 0 1 1.48.85l1.08-.54a1 1 0 0 1 1.232.236l1.668 1.668a1 1 0 0 1 .236 1.232l-.54 1.08c.332.46.616.958.85 1.48l1.164.223a1 1 0 0 1 .804.98v2.36a1 1 0 0 1-.804.98l-1.164.223a6.98 6.98 0 0 1-.85 1.48l.54 1.08a1 1 0 0 1-.236 1.232l-1.668 1.668a1 1 0 0 1-1.232.236l-1.08-.54a6.98 6.98 0 0 1-1.48.85l-.223 1.164a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.223-1.164a6.98 6.98 0 0 1-1.48-.85l-1.08.54a1 1 0 0 1-1.232-.236L2.157 16.61a1 1 0 0 1-.236-1.232l.54-1.08a6.98 6.98 0 0 1-.85-1.48l-1.164-.223A1 1 0 0 1 .643 11.615v-2.36a1 1 0 0 1 .804-.98l1.164-.223a6.98 6.98 0 0 1 .85-1.48l-.54-1.08a1 1 0 0 1 .236-1.232L4.825 2.592a1 1 0 0 1 1.232-.236l1.08.54c.46-.332.958-.616 1.48-.85l.223-1.164ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

function TimelineShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const date = (params.date as string) ?? "";
  const range = (
    VALID_RANGES.includes(searchParams.get("range") as RangeType)
      ? searchParams.get("range")
      : "day"
  ) as RangeType;
  const endDate = searchParams.get("end") ?? undefined;
  const shouldAutoFit = searchParams.get("fit") === "1";

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (!date) return { rangeStart: undefined, rangeEnd: undefined };
    if (range === "all") {
      return {
        rangeStart: new Date(0).toISOString(),
        rangeEnd: new Date().toISOString(),
      };
    }
    const parsedDate = new Date(`${date}T00:00:00`);
    if (isNaN(parsedDate.getTime())) return { rangeStart: undefined, rangeEnd: undefined };
    const { start, end } = getRangeBounds(parsedDate, range, endDate);
    return { rangeStart: start.toISOString(), rangeEnd: end.toISOString() };
  }, [date, range, endDate]);

  const [mobilePanelsOpen, setMobilePanelsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);

  async function detectVisits() {
    setDetecting(true);
    const body = JSON.stringify({
      ...(rangeStart ? { start: rangeStart } : {}),
      ...(rangeEnd ? { end: rangeEnd } : {}),
    });
    let total = 0;
    try {
      const r1 = await fetch("/api/visits/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (r1.ok) {
        const { newVisits } = await r1.json();
        total += newVisits ?? 0;
        if (newVisits > 0) {
          queryClient.invalidateQueries({ queryKey: ["visits"] });
          queryClient.invalidateQueries({ queryKey: ["places"] });
        }
      }
      const r2 = await fetch("/api/unknown-visits/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (r2.ok) {
        const { created } = await r2.json();
        total += created ?? 0;
        if (created > 0) {
          queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
          queryClient.invalidateQueries({ queryKey: ["places"] });
        }
      }
    } finally {
      setDetecting(false);
      setSettingsOpen(false);
      toast(
        total === 0
          ? "No new visit suggestions found"
          : `${total} new visit suggestion${total === 1 ? "" : "s"} detected`
      );
    }
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-muted md:h-screen md:w-screen md:flex-row">
      {/* Desktop sidebar */}
      <aside className="relative hidden h-full w-120 max-w-[40vw] shrink-0 flex-col overflow-hidden border-r bg-background md:flex">
        <AsideHeader onClose={() => {}} onDetect={detectVisits} detecting={detecting} />
        <SidebarContent
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          settingsModalOpen={settingsModalOpen}
          setSettingsModalOpen={setSettingsModalOpen}
        >
          {children}
        </SidebarContent>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobilePanelsOpen} onOpenChange={setMobilePanelsOpen}>
        <SheetContent side="left" className="w-[95vw] max-w-sm p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AsideHeader onClose={() => setMobilePanelsOpen(false)} onDetect={detectVisits} detecting={detecting} />
          <SidebarContent
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            settingsOpen={settingsOpen}
            setSettingsOpen={setSettingsOpen}
            settingsModalOpen={settingsModalOpen}
            setSettingsModalOpen={setSettingsModalOpen}
          >
            {children}
          </SidebarContent>
        </SheetContent>
      </Sheet>

      {settingsModalOpen && (
        <SettingsModal onClose={() => setSettingsModalOpen(false)} />
      )}

      <main className="relative min-h-0 flex-1">
        <MapWrapper rangeStart={rangeStart} rangeEnd={rangeEnd} shouldAutoFit={shouldAutoFit} />
        <Button
          size="icon"
          onClick={() => setMobilePanelsOpen((open) => !open)}
          className="absolute bottom-6 right-4 z-50 h-14 w-14 rounded-full shadow-lg md:hidden"
          aria-label="Toggle panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
            <path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75H12a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
          </svg>
        </Button>
      </main>
    </div>
  );
}

export default function TimelineLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <TimelineShell>{children}</TimelineShell>
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Test in browser**

Start dev server and test:
- Desktop: sidebar is always visible
- Mobile (resize to <768px): FAB opens Sheet from the left with smooth slide animation, backdrop, and focus trap
- Settings button has tooltip on hover

- [ ] **Step 4: Commit**

```bash
git add app/timeline/layout.tsx
git commit -m "feat: migrate mobile sidebar to shadcn Sheet"
```

---

## Task 11: Migrate AsideHeader Buttons

**Files:**
- Modify: `components/AsideHeader.tsx`

- [ ] **Step 1: Update AsideHeader to use shadcn Button**

Replace the entire component with:

```tsx
import { Button } from "@/components/ui/button";

interface AsideHeaderProps {
  onClose: () => void;
  onDetect: () => void;
  detecting: boolean;
}

export default function AsideHeader({ onClose, onDetect, detecting }: AsideHeaderProps) {
  return (
    <header className="px-4 pt-3 pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <h1 className="text-base font-semibold">OpenTimeline</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDetect}
            disabled={detecting}
            aria-label="Detect visits"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
            </svg>
            <span className="w-16 text-center">{detecting ? "Detecting…" : "Detect"}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden"
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/AsideHeader.tsx
git commit -m "feat: migrate AsideHeader to shadcn Button"
```

---

## Task 12: Migrate VisitCard to use Badge and Button

**Files:**
- Modify: `components/VisitCard.tsx`

- [ ] **Step 1: Update VisitCard to use shadcn Badge and Button**

Replace the entire component with:

```tsx
"use client";

import { Fragment } from "react";
import { format, differenceInMinutes, formatDistanceToNow } from "date-fns";
import { FetchVisitPhotos } from "@/components/VisitPhotos";
import { formatDuration, formatGapMs } from "@/lib/placeDetailUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type Visit = {
  id: number;
  arrivalAt: string;
  departureAt: string;
  status: string;
};

export type VisitCardProps = {
  visit: Visit;
  gapPx: number;
  gapMs: number;
  hasDateSeparator: boolean;
  nextYear: number | null;
  nextMonthLabel: string | null;
  scrubberSegmentKey?: string;
  isLast: boolean;
  onConfirm: (id: number) => void;
  onReject: (id: number) => void;
  onEdit: (visit: Visit) => void;
  onCreatePlace: (visit: Visit) => void;
  onViewDay: (arrivalAt: string) => void;
};

function VisitMeta({ arrival, departure, durationMin }: { arrival: Date; departure: Date; durationMin: number }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-foreground">
        {format(arrival, "MMM d, yyyy")}
        <span className="ml-1.5 font-normal text-muted-foreground">
          {formatDistanceToNow(arrival, { addSuffix: true })}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {format(arrival, "HH:mm")} &rarr; {format(departure, "HH:mm")}
        <span className="ml-1.5">{formatDuration(durationMin)}</span>
      </p>
    </div>
  );
}

type VisitActionsProps = {
  visit: Visit;
  isSuggested: boolean;
  onConfirm: (id: number) => void;
  onReject: (id: number) => void;
  onEdit: (visit: Visit) => void;
  onCreatePlace: (visit: Visit) => void;
  onViewDay: (arrivalAt: string) => void;
};

function VisitActions({ visit: v, isSuggested, onConfirm, onReject, onEdit, onCreatePlace, onViewDay }: VisitActionsProps) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex items-center gap-1">
        <Badge variant={isSuggested ? "warning" : "success"}>
          {isSuggested ? "Suggested" : "Confirmed"}
        </Badge>
        <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => onViewDay(v.arrivalAt)}>
          View Day
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(v)} title="Edit visit" aria-label="Edit visit">
          ✎
        </Button>
      </div>
      {isSuggested && (
        <div className="flex items-end gap-1">
          <div className="flex items-center gap-1">
            <Button size="sm" className="h-6 px-2 text-xs" onClick={() => onConfirm(v.id)}>
              Confirm
            </Button>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => onReject(v.id)}>
              Reject
            </Button>
          </div>
          <Button size="sm" className="h-6 bg-amber-500 px-2 text-xs hover:bg-amber-600" onClick={() => onCreatePlace(v)}>
            Create Place
          </Button>
        </div>
      )}
    </div>
  );
}

export default function VisitCard({
  visit: v,
  gapPx: spacerPx,
  gapMs,
  hasDateSeparator,
  nextYear,
  nextMonthLabel,
  scrubberSegmentKey,
  isLast,
  onConfirm,
  onReject,
  onEdit,
  onCreatePlace,
  onViewDay,
}: VisitCardProps) {
  const arrival = new Date(v.arrivalAt);
  const departure = new Date(v.departureAt);
  const durationMin = differenceInMinutes(departure, arrival);
  const isSuggested = v.status === "suggested";

  return (
    <Fragment key={v.id}>
      <div className="relative flex items-start gap-3">
        <div
          className={`relative z-10 mt-2.75 h-2.75 w-2.75 shrink-0 rounded-full border-2 border-background shadow ${
            isSuggested ? "bg-amber-400" : "bg-[#1a7bb5]"
          }`}
          style={{ marginLeft: 10 }}
        />
        <div className="flex-1 rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between gap-2">
            <VisitMeta arrival={arrival} departure={departure} durationMin={durationMin} />
            <VisitActions
              visit={v}
              isSuggested={isSuggested}
              onConfirm={onConfirm}
              onReject={onReject}
              onEdit={onEdit}
              onCreatePlace={onCreatePlace}
              onViewDay={onViewDay}
            />
          </div>
          <FetchVisitPhotos arrivalAt={v.arrivalAt} departureAt={v.departureAt} />
        </div>
      </div>

      {!isLast && (
        <div className="relative" style={{ height: spacerPx }} data-scrubber-segment={scrubberSegmentKey}>
          {hasDateSeparator && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1">
              {nextYear !== null && (
                <span className="rounded-full bg-[#1a7bb5] px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
                  {nextYear}
                </span>
              )}
              {nextMonthLabel !== null && (
                <span className="rounded-full bg-background px-3 py-0.5 text-xs font-semibold text-muted-foreground shadow-sm ring-1 ring-border">
                  {nextMonthLabel}
                </span>
              )}
            </div>
          )}
          {formatGapMs(gapMs) && (
            <span
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border"
              style={{ left: 15, top: "50%" }}
            >
              {formatGapMs(gapMs)}
            </span>
          )}
        </div>
      )}
    </Fragment>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/VisitCard.tsx
git commit -m "feat: migrate VisitCard to shadcn Badge + Button"
```

---

## Task 13: Migrate DailyStats

**Files:**
- Modify: `components/DailyStats.tsx`

- [ ] **Step 1: Update DailyStats to use semantic colors**

Replace the component with:

```tsx
import type { DailyStats } from "@/lib/groupByHour";
import type { RangeType } from "@/app/timeline/[date]/page";

export default function DailyStats({
  stats,
  range,
}: {
  stats: DailyStats;
  range: RangeType;
}) {
  const hours = Math.floor(stats.durationMinutes / 60);
  const mins = stats.durationMinutes % 60;
  const durationStr =
    stats.durationMinutes === 0
      ? "—"
      : hours > 0
      ? `${hours}h ${mins}m`
      : `${mins}m`;

  const thirdStat =
    range === "day"
      ? { label: "Duration", value: durationStr }
      : { label: "Days", value: stats.daysWithData > 0 ? stats.daysWithData : "—" };

  return (
    <div className="grid grid-cols-3 gap-2 border-b px-4 py-3 text-center">
      <div className="rounded-md bg-muted/50 px-2 py-2">
        <p className="text-xs text-muted-foreground">Distance</p>
        <p className="text-sm font-semibold">
          {stats.totalDistanceKm > 0
            ? `${stats.totalDistanceKm.toFixed(1)} km`
            : "—"}
        </p>
      </div>
      <div className="rounded-md bg-muted/50 px-2 py-2">
        <p className="text-xs text-muted-foreground">Points</p>
        <p className="text-sm font-semibold">
          {stats.totalPoints > 0 ? stats.totalPoints : "—"}
        </p>
      </div>
      <div className="rounded-md bg-muted/50 px-2 py-2">
        <p className="text-xs text-muted-foreground">{thirdStat.label}</p>
        <p className="text-sm font-semibold">{thirdStat.value}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/DailyStats.tsx
git commit -m "feat: update DailyStats with muted card styling"
```

---

## Task 14: Migrate PlacesPanel with Collapsible + Input

**Files:**
- Modify: `components/PlacesPanel.tsx`

- [ ] **Step 1: Update PlacesPanel**

Replace the entire component with:

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type Place = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  confirmedVisits: number;
};

export default function PlacesPanel() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: places = [] } = useQuery<Place[]>({
    queryKey: ["places"],
    queryFn: async () => {
      const res = await fetch("/api/places");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filtered = places.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted">
        <span>Places</span>
        <span>{open ? "▲" : "▼"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3">
          {places.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Click anywhere on the map to add a place.
            </p>
          ) : (
            <>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search places…"
                className="mb-2 h-8 text-xs"
              />
              <ScrollArea className="max-h-[40vh]">
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No places match.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {filtered.map((p) => (
                      <li
                        key={p.id}
                        className="cursor-pointer rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("opentimeline:fly-to", {
                              detail: { lat: p.lat, lon: p.lon },
                            })
                          )
                        }
                      >
                        <p className="truncate text-sm font-medium">
                          {p.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.radius}m · {p.confirmedVisits} visit
                          {p.confirmedVisits !== 1 ? "s" : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/PlacesPanel.tsx
git commit -m "feat: migrate PlacesPanel to shadcn Collapsible + Input"
```

---

## Task 15: Migrate VisitSuggestionsPanel

**Files:**
- Modify: `components/VisitSuggestionsPanel.tsx`

- [ ] **Step 1: Update VisitSuggestionsPanel**

Replace the entire component with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import { fetchVisitCentroid } from "@/lib/visitCentroid";
import { FetchVisitPhotos } from "@/components/VisitPhotos";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type Visit = {
  id: number;
  arrivalAt: string;
  departureAt: string;
  status: string;
  place: { id: number; name: string; lat: number; lon: number };
};

export default function VisitSuggestionsPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creatingPlaceForVisit, setCreatingPlaceForVisit] = useState<Visit | null>(null);
  const [creatingPlaceForVisitCentroid, setCreatingPlaceForVisitCentroid] = useState<{ lat: number; lon: number } | null>(null);

  const { data: visits = [] } = useQuery<Visit[]>({
    queryKey: ["visits", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/visits?status=suggested");
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function handleAction(id: number, status: "confirmed" | "rejected") {
    const res = await fetch(`/api/visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    }
  }

  async function openCreatePlaceForVisit(visit: Visit) {
    const centroid = await fetchVisitCentroid(visit.arrivalAt, visit.departureAt, visit.place);
    setCreatingPlaceForVisitCentroid(centroid);
    setCreatingPlaceForVisit(visit);
  }

  function handlePlaceCreatedForVisit() {
    setCreatingPlaceForVisit(null);
    setCreatingPlaceForVisitCentroid(null);
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted">
        <span className="flex items-center gap-2">
          Visit Suggestions
          {visits.length > 0 && (
            <Badge className="h-5 px-1.5">{visits.length}</Badge>
          )}
        </span>
        <span>{open ? "▲" : "▼"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="max-h-80 px-4 pb-3">
          {visits.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">No pending suggestions.</p>
          ) : (
            <ul className="space-y-2">
              {visits.map((v) => (
                <li
                  key={v.id}
                  className="cursor-pointer rounded-lg border bg-muted/50 p-2 transition-colors hover:bg-muted"
                  onClick={() => {
                    router.push(`/timeline/${format(new Date(v.arrivalAt), "yyyy-MM-dd")}`);
                    window.dispatchEvent(new CustomEvent("opentimeline:fly-to", { detail: { lat: v.place.lat, lon: v.place.lon } }));
                  }}
                >
                  <p className="text-sm font-medium">{v.place.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(v.arrivalAt), "MMM d, HH:mm")} –{" "}
                    {format(new Date(v.departureAt), "HH:mm")}
                  </p>
                  <FetchVisitPhotos arrivalAt={v.arrivalAt} departureAt={v.departureAt} />
                  <div className="mt-1.5 flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 flex-1 bg-amber-500 text-xs hover:bg-amber-600"
                      onClick={(e) => { e.stopPropagation(); openCreatePlaceForVisit(v); }}
                    >
                      Create Place
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={(e) => { e.stopPropagation(); handleAction(v.id, "confirmed"); }}
                    >
                      Confirm
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={(e) => { e.stopPropagation(); handleAction(v.id, "rejected"); }}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CollapsibleContent>

      {creatingPlaceForVisit && creatingPlaceForVisitCentroid && (
        <PlaceCreationModal
          lat={creatingPlaceForVisitCentroid.lat}
          lon={creatingPlaceForVisitCentroid.lon}
          supersedesVisitId={creatingPlaceForVisit.id}
          onClose={() => { setCreatingPlaceForVisit(null); setCreatingPlaceForVisitCentroid(null); }}
          onCreated={handlePlaceCreatedForVisit}
        />
      )}
    </Collapsible>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/VisitSuggestionsPanel.tsx
git commit -m "feat: migrate VisitSuggestionsPanel to shadcn Collapsible + Badge + Button"
```

---

## Task 16: Migrate UnknownVisitSuggestionsPanel

**Files:**
- Modify: `components/UnknownVisitSuggestionsPanel.tsx`

- [ ] **Step 1: Update UnknownVisitSuggestionsPanel**

Replace the entire component with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import { FetchVisitPhotos } from "@/components/VisitPhotos";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

type UnknownVisit = {
  id: number;
  lat: number;
  lon: number;
  arrivalAt: string;
  departureAt: string;
  pointCount: number;
  status: string;
};

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function UnknownVisitSuggestionsPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<UnknownVisit | null>(null);
  const [editing, setEditing] = useState<{ id: number; arrivalAt: string; departureAt: string } | null>(null);

  const { data: suggestions = [] } = useQuery<UnknownVisit[]>({
    queryKey: ["unknown-visits", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/unknown-visits?status=suggested");
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function handleReject(id: number) {
    const res = await fetch(`/api/unknown-visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    if (res.ok) queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/unknown-visits/${id}`, { method: "DELETE" });
    if (res.ok) queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
  }

  async function handleEditSave(id: number) {
    if (!editing) return;
    const res = await fetch(`/api/unknown-visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arrivalAt: new Date(editing.arrivalAt).toISOString(),
        departureAt: new Date(editing.departureAt).toISOString(),
      }),
    });
    if (res.ok) {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    }
  }

  async function handlePlaceCreated(visit: UnknownVisit) {
    await fetch(`/api/unknown-visits/${visit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    setConfirming(null);
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen} className="border-t">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-muted">
          <span className="flex items-center gap-2">
            Unknown Places
            {suggestions.length > 0 && (
              <Badge variant="warning" className="h-5 px-1.5">{suggestions.length}</Badge>
            )}
          </span>
          <span>{open ? "▲" : "▼"}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="max-h-80 px-4 pb-3">
            {suggestions.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">No unknown place visits detected.</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li
                    key={s.id}
                    className="cursor-pointer rounded-lg border border-amber-200 bg-amber-50 p-2 transition-colors hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
                    onClick={() => {
                      router.push(`/timeline/${format(new Date(s.arrivalAt), "yyyy-MM-dd")}`);
                      window.dispatchEvent(new CustomEvent("opentimeline:fly-to", { detail: { lat: s.lat, lon: s.lon } }));
                    }}
                  >
                    <p className="text-xs font-medium">
                      {s.lat.toFixed(5)}, {s.lon.toFixed(5)}
                    </p>
                    {editing?.id === s.id ? (
                      <div className="mt-1 space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Arrival</Label>
                          <Input
                            type="datetime-local"
                            value={editing.arrivalAt}
                            onChange={(e) => setEditing({ ...editing, arrivalAt: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Departure</Label>
                          <Input
                            type="datetime-local"
                            value={editing.departureAt}
                            onChange={(e) => setEditing({ ...editing, departureAt: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="flex gap-1.5 pt-0.5">
                          <Button
                            size="sm"
                            className="h-7 flex-1 bg-amber-500 text-xs hover:bg-amber-600"
                            onClick={(e) => { e.stopPropagation(); handleEditSave(s.id); }}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 flex-1 text-xs"
                            onClick={(e) => { e.stopPropagation(); setEditing(null); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(s.arrivalAt), "MMM d, HH:mm")} –{" "}
                          {format(new Date(s.departureAt), "HH:mm")}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.pointCount} points</p>
                        <FetchVisitPhotos arrivalAt={s.arrivalAt} departureAt={s.departureAt} lat={s.lat} lon={s.lon} />
                        <div className="mt-1.5 flex gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 flex-1 bg-amber-500 text-xs hover:bg-amber-600"
                            onClick={(e) => { e.stopPropagation(); setConfirming(s); }}
                          >
                            Create Place
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 flex-1 text-xs"
                            onClick={(e) => { e.stopPropagation(); setEditing({ id: s.id, arrivalAt: toDatetimeLocal(s.arrivalAt), departureAt: toDatetimeLocal(s.departureAt) }); }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 flex-1 text-xs"
                            onClick={(e) => { e.stopPropagation(); handleReject(s.id); }}
                          >
                            Dismiss
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 border-destructive text-xs text-destructive hover:bg-destructive/10"
                            onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                          >
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      {confirming && (
        <PlaceCreationModal
          lat={confirming.lat}
          lon={confirming.lon}
          onClose={() => setConfirming(null)}
          onCreated={() => handlePlaceCreated(confirming)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/UnknownVisitSuggestionsPanel.tsx
git commit -m "feat: migrate UnknownVisitSuggestionsPanel to shadcn components"
```

---

## Task 17: Migrate ThemeToggle

**Files:**
- Modify: `components/ThemeToggle.tsx`

- [ ] **Step 1: Update ThemeToggle to use Button**

Replace the component with:

```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      Theme
    </Button>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ThemeToggle.tsx
git commit -m "feat: migrate ThemeToggle to shadcn Button"
```

---

## Task 18: Update Map Loading State to Skeleton

**Files:**
- Modify: `components/map/MapWrapper.tsx`

- [ ] **Step 1: Replace spinner with Skeleton**

In `components/map/MapWrapper.tsx`, update the dynamic import loading state (lines 19-26):

Replace:
```tsx
loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-400 border-t-transparent" />
        <p className="text-sm text-gray-500">Loading map…</p>
      </div>
    </div>
  ),
```

With:
```tsx
loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <div className="text-center space-y-3">
        <Skeleton className="mx-auto h-8 w-8 rounded-full" />
        <Skeleton className="mx-auto h-4 w-24" />
      </div>
    </div>
  ),
```

And add the import at the top:
```tsx
import { Skeleton } from "@/components/ui/skeleton";
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/map/MapWrapper.tsx
git commit -m "feat: replace map loading spinner with skeleton"
```

---

## Task 19: Migrate DateNav Buttons

**Files:**
- Modify: `components/DateNav.tsx`

- [ ] **Step 1: Update DateNav to use shadcn Button**

In `components/DateNav.tsx`:

1. Add import:
   ```tsx
   import { Button } from "@/components/ui/button";
   ```

2. Replace the range selector grid (lines 154-169) — the 6 period buttons — with shadcn Buttons:
   ```tsx
   <div className="mb-2 flex flex-wrap gap-1">
     {(["day", "week", "month", "year", "custom", "all"] as RangeType[]).map(
       (r) => (
         <Button
           key={r}
           variant={range === r ? "default" : "outline"}
           size="sm"
           className="h-7 flex-1 text-xs capitalize"
           onClick={() => switchRange(r)}
         >
           {RANGE_LABELS[r]}
         </Button>
       )
     )}
   </div>
   ```

3. Replace prev/next navigation buttons (lines 174-179 and 225-232) with:
   ```tsx
   <Button
     variant="ghost"
     size="icon"
     className={`h-8 w-8 ${range === "all" ? "invisible" : ""}`}
     onClick={goPrev}
     aria-label="Previous period"
   >
     &#8592;
   </Button>
   ```
   and:
   ```tsx
   <Button
     variant="ghost"
     size="icon"
     className={`h-8 w-8 ${range === "all" ? "invisible" : ""}`}
     onClick={goNext}
     disabled={isNextDisabled()}
     aria-label="Next period"
   >
     &#8594;
   </Button>
   ```

4. Replace date `<input>` elements with shadcn `Input`:
   ```tsx
   import { Input } from "@/components/ui/input";
   ```
   Replace `className` on date inputs with:
   ```tsx
   className="min-w-0 flex-1 cursor-pointer border-none bg-transparent text-center text-sm font-medium focus-visible:ring-1 focus-visible:ring-ring"
   ```

5. Replace remaining hardcoded color classes:
   - `text-gray-500` → `text-muted-foreground`
   - `text-gray-700` → `text-foreground`
   - `text-gray-400` → `text-muted-foreground`

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/DateNav.tsx
git commit -m "feat: migrate DateNav to shadcn Button + Input"
```

---

## Task 20: Migrate PlaceDetailModal to Dialog

**Files:**
- Modify: `components/PlaceDetailModal.tsx`

- [ ] **Step 1: Update PlaceDetailModal to use Dialog**

In `components/PlaceDetailModal.tsx`:

1. Add imports:
   ```tsx
   import { Dialog, DialogContent } from "@/components/ui/dialog";
   import { Button } from "@/components/ui/button";
   import { Skeleton } from "@/components/ui/skeleton";
   ```

2. Replace the outer wrapper `<div className="fixed inset-0 z-[1000] ...">` with:
   ```tsx
   <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
     <DialogContent className="flex h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
   ```

3. Close with `</DialogContent></Dialog>` instead of `</div></div>`

4. Replace the filter buttons (lines 158-168) with shadcn Buttons:
   ```tsx
   {(["all", "confirmed", "suggested"] as const).map((f) => (
     <Button
       key={f}
       variant={filter === f ? "default" : "ghost"}
       size="sm"
       className="h-7 text-xs"
       onClick={() => setFilter(f)}
     >
       {f === "all" ? "All" : f === "confirmed" ? "Confirmed" : "Suggested"}
     </Button>
   ))}
   ```

5. Replace loading text with Skeleton:
   ```tsx
   {isLoading ? (
     <div className="space-y-3 py-8 px-4">
       <Skeleton className="h-16 w-full" />
       <Skeleton className="h-16 w-full" />
       <Skeleton className="h-16 w-full" />
     </div>
   ) : ...
   ```

6. Replace hardcoded color classes:
   - `text-gray-400` → `text-muted-foreground`
   - `text-gray-500` → `text-muted-foreground`
   - `text-gray-600` → `text-muted-foreground`
   - `border-gray-100` → `border`
   - `border-gray-200` → `border`
   - `bg-gray-200` → `bg-border`
   - `bg-white` → `bg-background`

- [ ] **Step 2: Verify the app builds**

Run:
```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/PlaceDetailModal.tsx
git commit -m "feat: migrate PlaceDetailModal to shadcn Dialog"
```

---

## Task 21: Full Visual QA and Dark Mode Check

**Files:**
- No file changes — testing only

- [ ] **Step 1: Start dev server**

Run:
```bash
pnpm dev
```

- [ ] **Step 2: Light mode QA**

Open the app in a browser and check:
- All modals open/close with smooth animation
- All buttons have consistent styling (no leftover raw `<button>` elements)
- Badge colors render correctly (amber for suggested, green for confirmed)
- PlacesPanel collapsible works
- VisitSuggestionsPanel collapsible works with badge count
- UnknownVisitSuggestionsPanel collapsible works
- DailyStats shows muted card backgrounds
- Mobile Sheet works (resize to <768px)
- Sonner toasts appear on detect
- Map loads with skeleton

- [ ] **Step 3: Dark mode QA**

Toggle to dark mode and verify:
- All shadcn components adapt to dark theme
- No white flashes or unstyled elements
- Map still renders correctly
- Amber cards in unknown visits have proper dark styling
- Text is readable throughout

- [ ] **Step 4: Run lint**

Run:
```bash
pnpm exec eslint .
```

Fix any lint errors found.

- [ ] **Step 5: Run tests**

Run:
```bash
pnpm test
```

Expected: All existing tests pass.

- [ ] **Step 6: Run build**

Run:
```bash
pnpm build
```

Expected: Production build succeeds with no errors.

- [ ] **Step 7: Commit any fixes**

If any fixes were needed during QA:
```bash
git add -A
git commit -m "fix: visual QA fixes for shadcn migration"
```
