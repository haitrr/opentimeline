# Sidebar Count Badges — Design

## Goal

Show a numeric badge on the "Suggestions" and "Unknown Places" icons in the timeline sidebar, indicating how many pending items each panel contains. This makes pending work visible without opening the panel.

## Behavior

- **Suggestions badge:** Count of visits with `status=suggested` from `/api/visits?status=suggested`.
- **Unknown badge:** Count of unknown-visits with `status=suggested` from `/api/unknown-visits?status=suggested`.
- **Hidden when count is 0.** No badge, no placeholder.
- **Capped at 99+.** Counts ≥ 100 render as `99+`.
- Applies to both the desktop activity bar and the mobile bottom tab bar.

## Styling

- Small pill badge positioned at the top-right corner of the icon button.
- Colors match the in-panel badges:
  - Suggestions: default `Badge` variant.
  - Unknown: `warning` variant (amber).
- Uses the existing shadcn `Badge` component. Size class similar to the in-panel usage (`h-5 px-1.5`, with a smaller size tweak to suit the icon overlay — target ~16px height, text-[10px]).

## Implementation

1. **New hook** `hooks/useSuggestionCounts.ts` — wraps two `useQuery` calls and returns `{ suggestions: number, unknown: number }`. Uses the same query keys already used by the panels (`["visits", "suggested"]`, `["unknown-visits", "suggested"]`) so React Query dedupes with the panel's fetches — no extra network requests. Returns `0` while loading or on error (no badge shown).

2. **New component** `components/IconBadge.tsx`. Renders `null` when `count === 0`, otherwise a positioned `Badge` with the formatted count (`count > 99 ? "99+" : String(count)`). Accepts a `variant` prop. Lives in its own file because it's used in two places (desktop activity bar and mobile tab bar).

3. **Wire into [app/timeline/layout.tsx](app/timeline/layout.tsx):**
   - Call `useSuggestionCounts()` in `TimelineShell` and pass the counts down to `ActivityBar` and the mobile tab bar.
   - In each tab render, wrap the icon in a `relative` container and overlay the badge when the tab is `"suggestions"` or `"unknown"`.

4. **Tests (TDD):**
   - Vitest unit test for the count-formatting helper (`formatCount(0) → null`, `formatCount(5) → "5"`, `formatCount(99) → "99"`, `formatCount(100) → "99+"`, `formatCount(500) → "99+"`).
   - No component-rendering test: the project's vitest setup is `environment: "node"` with `.ts`-only includes and no React testing library. Component-level behavior is covered by the pure-function test plus manual/visual verification, consistent with existing project conventions.

## Out of scope

- Polling interval tuning — existing query defaults are fine.
- Total/combined count anywhere else in the UI.
- Any changes to the in-panel badges.
