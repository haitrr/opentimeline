# Import Actions Dropdown Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move "Import GPX" and "Import from Immich" from the Settings panel into a 3-dot dropdown menu next to the Detect button in the timeline header.

**Architecture:** Add a shadcn `DropdownMenu` to `AsideHeader`, refactor both import components to use toasts for status and a Dialog for the Immich confirmation step, then remove the imports from the Settings panel in `layout.tsx`.

**Tech Stack:** Next.js, React, shadcn/ui (dropdown-menu, dialog, button, tooltip), sonner (toast)

---

## File Map

- **Modify:** `components/AsideHeader.tsx` — add `rangeStart`/`rangeEnd` props, inline GPX logic, dropdown + Immich dialog trigger
- **Modify:** `components/ImportGpxButton.tsx` — refactor to use toasts; export as hook-style trigger function (no render)
- **Modify:** `components/ImportImmichButton.tsx` — refactor confirmation step to Dialog; use toasts for final result; accept close callback
- **Modify:** `app/timeline/layout.tsx` — pass `rangeStart`/`rangeEnd` to `AsideHeader`; remove import buttons from Settings panel
- **Add:** `components/ui/dropdown-menu.tsx` — shadcn primitive (installed via CLI)
- **Test:** `components/__tests__/AsideHeader.test.tsx`

---

### Task 1: Install shadcn dropdown-menu primitive

**Files:**
- Create: `components/ui/dropdown-menu.tsx`

- [ ] **Step 1: Install the primitive**

```bash
cd /Users/haitran/code/opentimeline && pnpm dlx shadcn@latest add dropdown-menu
```

Expected: `components/ui/dropdown-menu.tsx` created.

- [ ] **Step 2: Verify the file exists**

```bash
ls components/ui/dropdown-menu.tsx
```

Expected: file listed with no error.

- [ ] **Step 3: Commit**

```bash
git add components/ui/dropdown-menu.tsx
git commit -m "feat: add shadcn dropdown-menu primitive"
```

---

### Task 2: Refactor ImportGpxButton to use toasts

**Files:**
- Modify: `components/ImportGpxButton.tsx`

The current component renders inline status messages. Replace them with `toast()` calls from sonner. Keep the hidden file `<input>` and expose a `triggerFileInput` ref so the parent can open the file picker without mounting the full component UI.

- [ ] **Step 1: Rewrite ImportGpxButton**

Replace the entire file with:

```tsx
"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { parseGpx } from "@/lib/parseGpx";

export default function ImportGpxButton({ onClose }: { onClose?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    onClose?.();
    const toastId = toast.loading("Parsing GPX file…");
    let points;
    try {
      const text = await file.text();
      points = parseGpx(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse GPX file", { id: toastId });
      return;
    }

    if (points.length === 0) {
      toast.error("No trackpoints found in GPX file", { id: toastId });
      return;
    }

    toast.loading("Importing…", { id: toastId });
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const { imported } = await res.json();
      toast.success(
        imported === 0 ? "All points already imported" : `Imported ${imported} point${imported === 1 ? "" : "s"}`,
        { id: toastId }
      );
      if (imported > 0) router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", { id: toastId });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <input
      ref={inputRef}
      id="gpx-file-input"
      type="file"
      accept=".gpx,application/gpx+xml"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
      }}
    />
  );
}

export function triggerGpxInput() {
  document.getElementById("gpx-file-input")?.click();
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haitran/code/opentimeline && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `ImportGpxButton`.

- [ ] **Step 3: Commit**

```bash
git add components/ImportGpxButton.tsx
git commit -m "refactor: ImportGpxButton uses toasts, exposes file input trigger"
```

---

### Task 3: Refactor ImportImmichButton to use Dialog + toasts

**Files:**
- Modify: `components/ImportImmichButton.tsx`

Replace the inline confirming panel with a shadcn `Dialog`. Final status messages become toasts.

- [ ] **Step 1: Rewrite ImportImmichButton**

Replace the entire file with:

```tsx
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ImmichPhoto } from "@/lib/immich";

type Props = {
  rangeStart?: string;
  rangeEnd?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ImportImmichDialog({ rangeStart, rangeEnd, open, onOpenChange }: Props) {
  const [pendingPhotos, setPendingPhotos] = useState<ImmichPhoto[]>([]);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  async function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setPendingPhotos([]);
      setFetching(false);
      setImporting(false);
    }
    if (nextOpen && rangeStart && rangeEnd) {
      setFetching(true);
      try {
        const res = await fetch(
          `/api/immich?start=${encodeURIComponent(rangeStart)}&end=${encodeURIComponent(rangeEnd)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Server error ${res.status}`);
        }
        const photos: ImmichPhoto[] = await res.json();
        const withLocation = photos.filter((p) => p.lat !== null && p.lon !== null);
        if (photos.length === 0) {
          toast.error("No photos found in this time range");
          onOpenChange(false);
          return;
        }
        if (withLocation.length === 0) {
          toast.error(`Found ${photos.length} photo${photos.length === 1 ? "" : "s"} but none have GPS data`);
          onOpenChange(false);
          return;
        }
        setPendingPhotos(withLocation);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch photos");
        onOpenChange(false);
        return;
      } finally {
        setFetching(false);
      }
    }
    onOpenChange(nextOpen);
  }

  async function handleImport() {
    setImporting(true);
    const trigger = `immich-import-${Date.now()}`;
    const points = pendingPhotos.map((p) => ({
      lat: p.lat!,
      lon: p.lon!,
      tst: Math.floor(new Date(p.takenAt).getTime() / 1000),
      recordedAt: p.takenAt,
      alt: null,
      vel: null,
      cog: null,
    }));
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points, trigger }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const { imported } = await res.json();
      toast.success(
        imported === 0 ? "All points already imported" : `Imported ${imported} point${imported === 1 ? "" : "s"}`
      );
      if (imported > 0) queryClient.invalidateQueries({ queryKey: ["locations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Immich</DialogTitle>
        </DialogHeader>
        {fetching ? (
          <p className="text-sm text-muted-foreground">Fetching photos…</p>
        ) : (
          <p className="text-sm">
            Import {pendingPhotos.length} photo{pendingPhotos.length === 1 ? "" : "s"} with location data as points?
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={fetching || importing || pendingPhotos.length === 0}>
            {importing ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haitran/code/opentimeline && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `ImportImmichButton`.

- [ ] **Step 3: Commit**

```bash
git add components/ImportImmichButton.tsx
git commit -m "refactor: ImportImmichButton becomes Dialog with toasts for status"
```

---

### Task 4: Update AsideHeader with dropdown menu

**Files:**
- Modify: `components/AsideHeader.tsx`

Add `rangeStart`, `rangeEnd` props. Add a 3-dot `DropdownMenu` to the right of Detect. Render the hidden GPX file input (`ImportGpxButton`) and the Immich dialog (`ImportImmichDialog`) here.

- [ ] **Step 1: Rewrite AsideHeader**

Replace the entire file with:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ImportGpxButton, { triggerGpxInput } from "@/components/ImportGpxButton";
import ImportImmichDialog from "@/components/ImportImmichButton";

interface AsideHeaderProps {
  onDetect: () => void;
  detecting: boolean;
  rangeStart?: string;
  rangeEnd?: string;
}

export default function AsideHeader({ onDetect, detecting, rangeStart, rangeEnd }: AsideHeaderProps) {
  const [immichOpen, setImmichOpen] = useState(false);

  return (
    <header className="px-4 pt-3 pb-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <h1 className="text-base font-semibold text-foreground">OpenTimeline</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="More import options">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M3 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM8.5 10a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0ZM15.5 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={triggerGpxInput}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="mr-2 h-4 w-4 shrink-0">
                  <path fillRule="evenodd" d="M8 1a.75.75 0 0 1 .75.75V6h3.5a.75.75 0 0 1 0 1.5h-3.5v3.25a.75.75 0 0 1-1.5 0V7.5H3.75a.75.75 0 0 1 0-1.5h3.5V1.75A.75.75 0 0 1 8 1Z" clipRule="evenodd" />
                  <path d="M1.75 13.5a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H1.75Z" />
                </svg>
                Import GPX
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setImmichOpen(true)}
                disabled={!rangeStart || !rangeEnd}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mr-2 h-4 w-4 shrink-0">
                  <path fillRule="evenodd" d="M1 8a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 8.07 3h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 16.07 6H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8Zm13.5 3a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                </svg>
                Import from Immich
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Hidden file input for GPX — must be rendered in DOM */}
      <ImportGpxButton />
      <ImportImmichDialog
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        open={immichOpen}
        onOpenChange={setImmichOpen}
      />
    </header>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/haitran/code/opentimeline && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AsideHeader.tsx
git commit -m "feat: add import actions dropdown menu to timeline header"
```

---

### Task 5: Wire rangeStart/rangeEnd into AsideHeader and remove imports from Settings panel

**Files:**
- Modify: `app/timeline/layout.tsx`

Two changes: (1) pass `rangeStart`/`rangeEnd` to `AsideHeader` via `PanelContent`, (2) remove `ImportGpxButton` and `ImportImmichButton` from the settings panel.

- [ ] **Step 1: Update PanelContent to pass range props to AsideHeader**

In `app/timeline/layout.tsx`, update `PanelContent` (lines ~127–197):

```tsx
function PanelContent({
  activeTab,
  rangeStart,
  rangeEnd,
  onDetect,
  detecting,
  children,
}: {
  activeTab: SidebarTab;
  rangeStart?: string;
  rangeEnd?: string;
  onDetect: () => void;
  detecting: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-1 flex-col overflow-x-hidden overflow-y-hidden">
      {activeTab === "timeline" && (
        <>
          <AsideHeader onDetect={onDetect} detecting={detecting} rangeStart={rangeStart} rangeEnd={rangeEnd} />
          {children}
        </>
      )}
      {activeTab === "places" && (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Places</h2>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <PlacesPanel />
          </div>
        </div>
      )}
      {activeTab === "suggestions" && (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Visit Suggestions</h2>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <VisitSuggestionsPanel />
          </div>
        </div>
      )}
      {activeTab === "unknown" && (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Unknown Places</h2>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <UnknownVisitSuggestionsPanel />
          </div>
        </div>
      )}
      {activeTab === "settings" && (
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Settings</h2>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <SettingsPanel />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remove unused imports from layout.tsx**

Remove these two import lines from the top of `app/timeline/layout.tsx`:

```ts
import ImportGpxButton from "@/components/ImportGpxButton";
import ImportImmichButton from "@/components/ImportImmichButton";
```

Also remove `Separator` from the import if it is no longer used elsewhere in the file:

```ts
import { Separator } from "@/components/ui/separator";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/haitran/code/opentimeline && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Verify ESLint passes**

```bash
cd /Users/haitran/code/opentimeline && pnpm exec eslint app/timeline/layout.tsx components/AsideHeader.tsx components/ImportGpxButton.tsx components/ImportImmichButton.tsx
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/timeline/layout.tsx
git commit -m "refactor: remove import buttons from settings panel, wire range to AsideHeader"
```

---

### Task 6: Smoke-test in browser

- [ ] **Step 1: Start dev server**

```bash
cd /Users/haitran/code/opentimeline && pnpm dev
```

- [ ] **Step 2: Verify dropdown appears**

Navigate to `http://localhost:3000/timeline/2026-04-19`. Confirm:
- Detect button visible in header
- 3-dot button (⋯) appears immediately to its right
- Clicking ⋯ opens dropdown with "Import GPX" and "Import from Immich"

- [ ] **Step 3: Test GPX import**

Click "Import GPX" — file picker opens. Select a `.gpx` file. Confirm toast appears showing progress and result.

- [ ] **Step 4: Test Immich import**

Click "Import from Immich" — dialog opens showing fetched photo count (or toast error if Immich not configured). Confirm Cancel closes the dialog.

- [ ] **Step 5: Verify Settings panel**

Open Settings tab — confirm no import buttons appear there.

- [ ] **Step 6: Stop dev server**

Press `Ctrl+C` in the terminal running `pnpm dev`.
