# PlacesPanel UI/UX revamp

**Date:** 2026-04-18
**Scope:** `components/PlacesPanel.tsx` and supporting files. UI/UX only — no API changes.

## Goal

Turn the places sidebar from a minimal search-and-jump list into a scannable, informative panel with inline actions and proper empty/loading/no-match states. Covers five directions selected during brainstorming: visual polish, scannability, inline actions, richer per-item context, and edge states.

## Out of scope

- API changes: `/api/places` already returns everything needed (`name`, `lat`, `lon`, `radius`, `totalVisits`, `confirmedVisits`, `lastVisitAt`, etc.).
- Rename/resize/delete flows themselves: the existing `PlaceDetailModal` already handles those; this spec only adds an entry point from the panel.
- Virtualization: current list sizes don't warrant it. Revisit if user volume grows.

## Component breakdown

New file layout (each file <300 LOC per `CLAUDE.md`):

- `components/PlacesPanel.tsx` — top-level: query, search/sort state, modal state, renders children.
- `components/places/PlaceListItem.tsx` — single row card (icon, name, last-visited, stats, hover actions).
- `components/places/PlacesToolbar.tsx` — search input + sort `<Select>` + count badge.
- `components/places/PlacesEmptyState.tsx` — no-places-yet empty state.
- `lib/relativeTime.ts` — `formatRelative(lastVisitAt: string | null): string` returning "Just now", "Yesterday", "2d ago", "Mar 12", or "Never".

`PlaceDetailModal` is imported and opened from `PlacesPanel` when a row's edit action fires.

## Data contract

`Place` type in the panel updates to match the real API response:

```ts
type Place = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  isActive: boolean;
  totalVisits: number;
  confirmedVisits: number;
  visitsInRange: number;
  confirmedVisitsInRange: number;
  suggestedVisitsInRange: number;
  lastVisitAt: string | null;
  createdAt: string;
};
```

(`PlaceDetailModal` expects `PlaceData` from `lib/detectVisits`; pass the fields it needs.)

## UI spec

### Header & toolbar

- The parent `app/timeline/layout.tsx` already renders an "Places" header. `PlacesPanel` renders a toolbar row **below** that header:
  - `<Input>` (shadcn) — `placeholder="Search places…"`, flex-1.
  - `<Select>` (shadcn) — sort options: `Recent activity` (default), `Most visits`, `Name A–Z`.
  - Count text on the right: `{filteredCount}` when filtering, `{totalCount}` otherwise. Muted, `text-xs`.
- Sort choice persisted to `localStorage["places.sort"]`. On mount, hydrate from storage before first render (useState initializer) to avoid a flash.

### Row (PlaceListItem)

```
┌──────────────────────────────────────────────┐
│ [icon] Home                          ✎  ⋯    │  ← actions appear on hover
│        Last visited 2d ago                   │
│        128 visits · 50m radius               │
└──────────────────────────────────────────────┘
```

- **Icon:** `MapPin` from `lucide-react` (already in deps), in a 32×32 rounded-md box. Background `bg-primary/10`, icon `text-primary`.
- **Name:** `text-sm font-semibold`, `truncate`, full name in `title` attr.
- **Last-visited line:** `text-xs text-muted-foreground`. Value from `formatRelative(lastVisitAt)`. If `lastVisitAt` is `null`, this line is omitted (replaced by the "No visits yet" variant below).
- **Stats line:** `text-xs text-muted-foreground`. Format: `{confirmedVisits} visits · {radius}m radius`. Pluralize: `1 visit` vs `2 visits`. When `confirmedVisits === 0`: render `No visits yet · {radius}m radius` (and omit the last-visited line above).
- **Hover actions (desktop):** absolute-positioned top-right of the row.
  - `✎` icon button (`Pencil` from lucide) → calls `onEdit(place)`, which opens `PlaceDetailModal`.
  - `⋯` icon button (`MoreHorizontal`) → opens a small popover/menu with `Delete` (confirm via `window.confirm` first iteration — can upgrade to `<AlertDialog>` later) and `Copy coordinates` (writes `{lat}, {lon}` to clipboard).
  - Actions hidden by default, revealed via `opacity-0 group-hover:opacity-100 transition`. On touch devices (no hover), actions always visible at reduced contrast.
- **Click** (anywhere outside the action buttons): dispatches `window.dispatchEvent(new CustomEvent("opentimeline:fly-to", { detail: { lat, lon } }))` — preserves current behavior. Action buttons `stopPropagation` so they don't also fly.
- Row hover background: `hover:bg-muted`. Cursor: `pointer`.

### Empty state (zero places in DB)

Centered column inside the panel:

- `MapPin` icon (24px) inside a soft circular background (`bg-muted`, `rounded-full`, `p-3`).
- Heading: "No places yet" — `text-sm font-medium`.
- Body: "Click anywhere on the map to drop your first place." — `text-xs text-muted-foreground`.

Replaces the current one-line grey text.

### Loading state

Shown while `isLoading` from `useQuery` is true **and** no cached data. Renders 3 skeleton rows using `<Skeleton>` (shadcn): each row has a 32×32 square + two lines of varying width to mirror the real row shape. Avoids the empty-state flash.

### No search matches

When `places.length > 0` but `filtered.length === 0`:

- Centered block (smaller than empty state).
- Text: `No places match "<query>"` — `text-xs text-muted-foreground`.
- `<Button variant="ghost" size="sm">Clear search</Button>` that resets `query` to `""`.

### Edit modal integration

`PlacesPanel` keeps local state `const [editingPlace, setEditingPlace] = useState<Place | null>(null)`. Row's edit callback sets it. When set, renders `<PlaceDetailModal place={...} onClose={() => setEditingPlace(null)} />`. The modal handles all update/delete flows; it already invalidates the `["places"]` query on success.

## `lib/relativeTime.ts`

```ts
export function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  // Use date-fns: formatDistanceToNowStrict with special-casing.
  // "Yesterday" if calendar-yesterday; "{n}d ago" up to 7 days; else "MMM d"; if >1y, "MMM yyyy".
}
```

Exact rules (for tests):

- `null` → `"Never"`
- `< 60s` → `"Just now"`
- `< 60m` → `"{m}m ago"`
- `< 24h` → `"{h}h ago"`
- calendar-yesterday (local time) → `"Yesterday"`
- `< 7d` → `"{d}d ago"`
- same calendar year → `"MMM d"` (e.g., `Mar 12`)
- earlier years → `"MMM yyyy"` (e.g., `Mar 2025`)

## Accessibility

- Row is a `<div role="button" tabIndex={0}>` with `onKeyDown` handling Enter/Space (can't use `<button>` because it would nest the action buttons inside). Makes the row keyboard-activatable for fly-to. Matches existing pattern in `TimelineSidebar`.
- Action buttons have `aria-label` (`Edit place`, `Place actions`).
- Search input uses `<Input>` which already sets `aria-` attrs via shadcn.

## Testing plan (TDD)

Write tests **before** each unit.

**Vitest + React Testing Library:**

1. `lib/relativeTime.test.ts` — covers all rules above with fixed `Date.now` mocks.
2. `components/places/PlaceListItem.test.tsx`:
   - Renders name, relative last-visit, visit count, radius.
   - Pluralizes visits correctly (`1 visit` vs `2 visits`).
   - Renders "No visits yet" when `confirmedVisits === 0` and hides the relative-time line.
   - Row keyboard activation (Enter/Space) dispatches `opentimeline:fly-to` with correct lat/lon.
   - Edit button click does **not** dispatch fly-to; invokes `onEdit(place)`.
3. `components/PlacesPanel.test.tsx`:
   - Filters by query (case-insensitive).
   - Sorts correctly for each option: `recent` (nulls last), `visits` (desc), `name` (locale compare asc).
   - Hydrates sort from `localStorage["places.sort"]` on mount; persists on change.
   - Shows empty state when `places.length === 0`.
   - Shows "No places match" block with clear button when filter excludes all.

**Playwright (one smoke e2e):**

- Given a seeded place: open Places tab, type partial name, assert row visible, click row, assert fly-to event (stub listener on `window`), click edit, assert `PlaceDetailModal` opens.

## Risks & trade-offs

- `localStorage` access during SSR — guard with `typeof window !== "undefined"` in the useState initializer to avoid hydration mismatch.
- The `⋯` menu adds a dependency on a popover primitive; `components/ui/` doesn't list one. **Mitigation:** first pass renders the two "menu" actions as two icon buttons inline next to `✎` (no popover). Add a real menu later if the list grows.
- `PlaceDetailModal` currently loads full visits when opened — expected cost, same as clicking the map marker. No regression.
- Touch devices lose "hover reveals actions" — mitigated by always-visible-but-dimmed on `@media (hover: none)`.

## Deliverable checklist

- [ ] `lib/relativeTime.ts` + test
- [ ] `components/places/PlaceListItem.tsx` + test
- [ ] `components/places/PlacesToolbar.tsx`
- [ ] `components/places/PlacesEmptyState.tsx`
- [ ] `components/PlacesPanel.tsx` rewritten to orchestrate + tests
- [ ] One playwright smoke test
- [ ] `pnpm exec eslint .` clean
- [ ] `pnpm test` (vitest) passes
- [ ] Manual check: empty state, loading skeleton, no-match, hover actions, sort persistence, edit modal opens and mutations invalidate the list.
