# shadcn/ui Migration — Full Visual Refresh

**Date:** 2026-04-17
**Scope:** Migrate OpenTimeline's hand-rolled Tailwind components to shadcn/ui for a modern, accessible, polished UI.

---

## 1. Foundation

### 1.1 New Dependencies

- `clsx` + `tailwind-merge` → `cn()` utility in `lib/utils.ts`
- shadcn CLI for component scaffolding
- Radix UI primitives (installed automatically by shadcn)

### 1.2 shadcn Components to Install

`button`, `input`, `label`, `dialog`, `sheet`, `card`, `badge`, `tabs`, `tooltip`, `skeleton`, `slider`, `select`, `separator`, `popover`, `scroll-area`, `radio-group`, `sonner`

### 1.3 Theme / CSS Variables

Map existing palette onto shadcn's variable scheme in `globals.css`:

| Current | shadcn variable | Light value | Dark value |
|---------|----------------|-------------|------------|
| `blue-600` | `--primary` | `221.2 83.2% 53.3%` | `217.2 91.2% 59.8%` |
| `white` | `--background` | `0 0% 100%` | `222.2 84% 4.9%` |
| `gray-100` | `--muted` | `210 40% 96.1%` | `217.2 32.6% 17.5%` |
| `amber-500` | `--warning` (custom) | `38 92% 50%` | `38 92% 50%` |
| `red-600` | `--destructive` | `0 84.2% 60.2%` | `0 62.8% 30.6%` |
| `white/gray-900` | `--card` | `0 0% 100%` | `222.2 84% 4.9%` |

Standardized border radius: `--radius: 0.5rem`

### 1.4 Files Created

- `components.json` — shadcn configuration
- `lib/utils.ts` — `cn()` helper
- `components/ui/` — shadcn component directory

---

## 2. Component Migration

### 2.1 Layout (`app/timeline/layout.tsx`)

| Element | Current | After |
|---------|---------|-------|
| Mobile sidebar | `absolute` div with `transition-transform` | `Sheet` (side="left") with backdrop + focus trap |
| Sidebar backdrop | Manual `div.bg-black/40` + click handler | Built into `Sheet` overlay |
| Settings button | Inline `<button>` with SVG | `Tooltip`-wrapped `Button` variant="ghost" size="icon" |
| FAB (mobile panel toggle) | Inline `<button>` with inline SVG | `Button` variant="default" size="icon" className="rounded-full" |
| Toast notification | Inline conditional `<div>` | `Sonner` toaster component with `toast()` calls |

### 2.2 Modals

All 6 modal components follow the same pattern — replace `fixed inset-0 z-[N] flex items-center bg-black/40` overlay with shadcn `Dialog`:

**PlaceCreationModal.tsx** (103 lines)
- `Dialog` + `DialogContent` (max-w-sm)
- `DialogHeader` / `DialogTitle` / `DialogDescription`
- Form fields: `Label` + `Input` (name), `Label` + `Input` type="number" (radius)
- `DialogFooter`: `Button` variant="outline" (Cancel) + `Button` (Create)

**PlaceDetailModal.tsx** (246 lines)
- `Dialog` + `DialogContent` (max-w-4xl, h-[90vh])
- `Tabs` for filter (All / Confirmed / Suggested)
- `ScrollArea` for visit list
- `Badge` for status indicators

**CreateVisitModal.tsx** (300 lines)
- `Dialog` + `DialogContent` (max-w-md)
- `RadioGroup` for place selection (replaces manual radio buttons)
- `Slider` for scan radius (replaces `<input type="range">`)
- `Separator` between form sections

**EditVisitModal.tsx** (214 lines)
- `Dialog` + `DialogContent`
- `Label` + `Input` for time fields
- `Select` for place dropdown

**PhotoModal.tsx** (90 lines)
- `Dialog` with custom full-screen variant (`bg-black/80`, no rounded corners)
- Keep keyboard navigation (arrows, escape) — Radix Dialog handles escape natively

**SettingsModal.tsx** (269 lines)
- `Dialog` + `DialogContent` (max-w-lg)
- `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` for settings sections
- `Label` + `Input` for numeric fields
- `DialogFooter`: `Button` variant="outline" (Cancel/Reset) + `Button` (Save)

**Inline place-move confirm** (in MapWrapper.tsx)
- Extract to small `Dialog` component or use `AlertDialog`

### 2.3 Panels

**AsideHeader.tsx** (48 lines)
- Buttons → `Button` variant="ghost" size="icon" (close) + `Button` variant="outline" size="sm" (detect)
- Logo stays custom

**DateNav.tsx** (236 lines)
- Period selector buttons → `Button` group: active = `variant="default"`, inactive = `variant="outline"`
- Nav arrows → `Button` variant="ghost" size="icon"
- Date inputs → `Input` type="date"
- Wrap period label in styled container

**DailyStats.tsx** (47 lines)
- Each stat → small `Card` with `CardContent` (compact padding)
- 3-column grid stays

**PlacesPanel.tsx** (89 lines)
- Wrapper → `Card` or section with `Separator`
- Search → `Input` with search icon
- List → items with `hover:bg-muted` transition
- `ScrollArea` for overflow

**VisitSuggestionsPanel.tsx** (135 lines)
- Count → `Badge`
- Collapsible header stays custom (or use Radix `Collapsible`)
- Action buttons → `Button` size="sm" variants

**UnknownVisitSuggestionsPanel.tsx** (208 lines)
- Warning indicator → `Badge` variant="warning"
- Edit mode inputs → `Input`
- Action buttons → `Button` size="sm" variants

### 2.4 Cards

**VisitCard.tsx** (165 lines)
- Wrapper → `Card` with `hover:shadow-md transition-shadow`
- Status pill → `Badge` variant="warning" (suggested) or `Badge` variant="success" (confirmed)
- Action buttons → `Button` size="sm": Confirm (default), Reject (outline), Edit (ghost icon)
- Timeline dot/line stays custom

### 2.5 Map Components

**No changes to core map files:**
- `MapLibreMap.tsx`, `MapLayers.tsx`, `MapPopups.tsx`, `FlyToHandler.tsx`
- `mapConstants.ts`, `mapUtils.ts`
- `useMapGeoJSON.ts`, `useJourneyPlayback.ts`, `useLayerSettings.ts`

**MapControls.tsx** — minimal changes:
- Layer toggle buttons → `Tooltip`-wrapped `Button` variant="ghost" size="icon"
- Context menu stays custom (position depends on map coordinates)
- Playback bar stays custom

**MapWrapper.tsx:**
- Extract inline place-move confirmation → `AlertDialog` component
- Map loading skeleton → `Skeleton` instead of spinner

### 2.6 Other Components

**DraggableScrollbar.tsx** (252 lines) — no change (tightly coupled to timeline)
**QueryProvider.tsx** (18 lines) — no change
**ThemeToggle.tsx** (21 lines) — use `Button` variant="ghost" size="icon"

---

## 3. Large Component Splits

Per the 300-line guideline:

### TimelineSidebar.tsx (880 lines) → split into:
- `TimelineSidebar.tsx` — main container, scroll logic, layout (~200 lines)
- `VisitCardList.tsx` — renders list of VisitCard with gap indicators (~150 lines)
- `UnknownVisitCard.tsx` — unknown visit rendering + actions (~100 lines)
- `TimelineGapIndicator.tsx` — gap visualization between visits (~30 lines)
- `hooks/useTimelineSidebarActions.ts` — confirm/reject/edit/delete handlers (~150 lines)

### CreateVisitModal.tsx (300 lines) → split into:
- `CreateVisitModal.tsx` — dialog shell, submit handler (~120 lines)
- `PlaceSelector.tsx` — radio group for place selection (~80 lines)
- `PeriodSelector.tsx` — detected time periods list (~80 lines)

### SettingsModal.tsx (269 lines) → extract:
- `SettingsField.tsx` — reusable labeled field with hint (already a sub-component, ~30 lines)

---

## 4. Visual Refinements

### 4.1 Transitions & Animation
- All `Dialog` / `Sheet` get Radix built-in enter/exit animations (fade + scale/slide)
- Cards: `transition-shadow duration-150` for hover elevation
- Buttons: built-in shadcn hover/active states
- List items: `transition-colors duration-100`

### 4.2 Loading States
- Map loading → `Skeleton` (full area pulsing rectangle)
- Panel data loading → `Skeleton` lines (3-4 bars of varying width)
- Button loading → disabled state + inline spinner SVG

### 4.3 Empty States
- No visits for date → centered muted text: "No visits recorded" with subtle icon
- No places → "No places yet" with prompt to create
- No photos → "No photos for this period"
- Pattern: `flex flex-col items-center gap-2 py-8 text-muted-foreground text-sm`

### 4.4 Focus & Accessibility
- Consistent focus rings: `ring-2 ring-ring ring-offset-2` (from shadcn)
- All modals get focus trapping (built into Radix Dialog)
- Keyboard navigation in all menus and selects
- `aria-label` on all icon-only buttons

### 4.5 Typography
- Base body: `text-sm` (14px)
- Metadata/timestamps: `text-xs text-muted-foreground`
- Headings: `text-base font-semibold` (dialog titles), `text-sm font-medium` (section headers)
- Keep Geist Sans / Geist Mono fonts

### 4.6 Spacing & Radius
- Standardize border radius to `--radius: 0.5rem` everywhere
- Card padding: `p-4` (currently inconsistent `p-3`/`p-4`/`p-5`)
- Modal padding: handled by shadcn `DialogContent` defaults
- Gap between panel items: `gap-2`

---

## 5. Files Not Changing

- All files under `components/map/` except `MapControls.tsx` (minor button changes) and `MapWrapper.tsx` (extract confirm dialog)
- `DraggableScrollbar.tsx`
- `QueryProvider.tsx`
- All API routes (`app/api/`)
- All lib files (`lib/`)
- `app/layout.tsx` (root layout — only add `<Toaster />`)
- `app/page.tsx`, `app/timeline/page.tsx` (redirect pages)

---

## 6. Migration Order

1. **Foundation** — shadcn setup, CSS variables, `cn()` utility
2. **Primitives** — Button, Input, Label, Badge, Separator, Tooltip, Skeleton
3. **Modals** — Dialog for all 6 modal components + AlertDialog for place-move
4. **Layout** — Sheet for mobile sidebar, Sonner for toasts
5. **Panels** — Card, ScrollArea, Tabs for sidebar panels
6. **Cards** — VisitCard upgrade, DailyStats cards
7. **Forms** — RadioGroup, Slider, Select in CreateVisitModal and SettingsModal
8. **Splits** — Break down TimelineSidebar, CreateVisitModal
9. **Polish** — Empty states, loading skeletons, transitions, dark mode QA
