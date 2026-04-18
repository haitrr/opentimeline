# Sidebar Count Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show numeric count badges on the "Suggestions" and "Unknown Places" sidebar icons indicating how many pending items each panel contains.

**Architecture:** Add a pure `formatCount` helper (tested with vitest), a small `IconBadge` React component that overlays a shadcn `Badge` on the icon, and a `useSuggestionCounts` hook that reuses the existing React Query keys (`["visits", "suggested"]` and `["unknown-visits", "suggested"]`) so fetches are deduped with the panels. Wire counts into both the desktop activity bar and the mobile bottom tab bar in [app/timeline/layout.tsx](app/timeline/layout.tsx).

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn UI (`Badge`), `@tanstack/react-query`, vitest for unit tests.

---

## File Structure

- **Create:** `lib/formatCount.ts` — pure helper returning a string or `null`.
- **Create:** `tests/unit/formatCount.test.ts` — vitest unit test for the helper.
- **Create:** `hooks/useSuggestionCounts.ts` — React Query hook returning `{ suggestions, unknown }`.
- **Create:** `components/IconBadge.tsx` — small component that renders a positioned `Badge` with the formatted count, or nothing when count is 0.
- **Modify:** `app/timeline/layout.tsx` — consume the hook in `TimelineShell`, pass counts to `ActivityBar` and mobile tab bar, overlay `IconBadge` on the "suggestions" and "unknown" icons.

---

## Task 1: Add and test the `formatCount` helper

**Files:**
- Create: `tests/unit/formatCount.test.ts`
- Create: `lib/formatCount.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/formatCount.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatCount } from "@/lib/formatCount";

describe("formatCount", () => {
  it("returns null for 0", () => {
    expect(formatCount(0)).toBeNull();
  });

  it("returns the number as a string for small positive values", () => {
    expect(formatCount(1)).toBe("1");
    expect(formatCount(5)).toBe("5");
    expect(formatCount(42)).toBe("42");
  });

  it("returns '99' for exactly 99", () => {
    expect(formatCount(99)).toBe("99");
  });

  it("returns '99+' for 100", () => {
    expect(formatCount(100)).toBe("99+");
  });

  it("returns '99+' for values far above 99", () => {
    expect(formatCount(500)).toBe("99+");
    expect(formatCount(10_000)).toBe("99+");
  });

  it("returns null for negative values (defensive)", () => {
    expect(formatCount(-1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/formatCount.test.ts`
Expected: FAIL — module `@/lib/formatCount` not found.

- [ ] **Step 3: Write minimal implementation**

Create `lib/formatCount.ts`:

```ts
export function formatCount(count: number): string | null {
  if (count <= 0) return null;
  if (count > 99) return "99+";
  return String(count);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/formatCount.test.ts`
Expected: PASS — 6 tests passing.

- [ ] **Step 5: Lint**

Run: `pnpm exec eslint lib/formatCount.ts tests/unit/formatCount.test.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/formatCount.ts tests/unit/formatCount.test.ts
git commit -m "feat: add formatCount helper with 99+ cap"
```

---

## Task 2: Add the `useSuggestionCounts` hook

**Files:**
- Create: `hooks/useSuggestionCounts.ts`

This hook uses the exact same React Query keys and fetch URLs as the panels ([components/VisitSuggestionsPanel.tsx:28-35](components/VisitSuggestionsPanel.tsx#L28-L35) and [components/UnknownVisitSuggestionsPanel.tsx:37-44](components/UnknownVisitSuggestionsPanel.tsx#L37-L44)), so when the panel is also mounted React Query will dedupe the requests.

- [ ] **Step 1: Create the hook**

Create `hooks/useSuggestionCounts.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";

type Visit = { id: number };
type UnknownVisit = { id: number };

export function useSuggestionCounts(): { suggestions: number; unknown: number } {
  const { data: visits = [] } = useQuery<Visit[]>({
    queryKey: ["visits", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/visits?status=suggested");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: unknownVisits = [] } = useQuery<UnknownVisit[]>({
    queryKey: ["unknown-visits", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/unknown-visits?status=suggested");
      if (!res.ok) return [];
      return res.json();
    },
  });

  return { suggestions: visits.length, unknown: unknownVisits.length };
}
```

- [ ] **Step 2: Lint**

Run: `pnpm exec eslint hooks/useSuggestionCounts.ts`
Expected: no errors.

- [ ] **Step 3: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/useSuggestionCounts.ts
git commit -m "feat: add useSuggestionCounts hook"
```

---

## Task 3: Add the `IconBadge` component

**Files:**
- Create: `components/IconBadge.tsx`

The component overlays a small shadcn `Badge` at the top-right of its parent. It renders `null` when `formatCount` returns `null`. Sizing is tuned to fit on top of a 20px icon without overflowing the 40px icon button: ~16px tall, `text-[10px]`, `px-1` to stay compact for `99+`.

- [ ] **Step 1: Create the component**

Create `components/IconBadge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { formatCount } from "@/lib/formatCount";

type IconBadgeProps = {
  count: number;
  variant?: "default" | "warning";
};

export default function IconBadge({ count, variant = "default" }: IconBadgeProps) {
  const label = formatCount(count);
  if (label === null) return null;
  return (
    <Badge
      variant={variant}
      className="pointer-events-none absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px] leading-none"
    >
      {label}
    </Badge>
  );
}
```

- [ ] **Step 2: Lint**

Run: `pnpm exec eslint components/IconBadge.tsx`
Expected: no errors.

- [ ] **Step 3: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/IconBadge.tsx
git commit -m "feat: add IconBadge component for sidebar icon counts"
```

---

## Task 4: Wire counts into the desktop activity bar

**Files:**
- Modify: `app/timeline/layout.tsx`

Two changes: (a) call `useSuggestionCounts()` in `TimelineShell` and pass counts down; (b) accept counts in `ActivityBar` and overlay `IconBadge` for the "suggestions" and "unknown" tabs. The `TooltipTrigger` in `ActivityBar` already uses `relative` ([app/timeline/layout.tsx:87](app/timeline/layout.tsx#L87)), so absolutely-positioned children (like `IconBadge`) will anchor to it correctly.

- [ ] **Step 1: Import the hook and component, update `ActivityBar` props**

In `app/timeline/layout.tsx`, add imports near the top of the file (after existing component imports, before `RangeType`):

```tsx
import IconBadge from "@/components/IconBadge";
import { useSuggestionCounts } from "@/hooks/useSuggestionCounts";
```

Change the `ActivityBar` signature and body to accept and use counts. Replace the existing `ActivityBar` function (currently at [app/timeline/layout.tsx:72-117](app/timeline/layout.tsx#L72-L117)) with:

```tsx
function ActivityBar({
  activeTab,
  onTabChange,
  onSettingsClick,
  suggestionsCount,
  unknownCount,
}: {
  activeTab: SidebarTab | null;
  onTabChange: (tab: SidebarTab) => void;
  onSettingsClick: () => void;
  suggestionsCount: number;
  unknownCount: number;
}) {
  return (
    <div className="flex h-full w-12 shrink-0 flex-col items-center border-r bg-muted/50 py-2">
      {TABS.map(({ id, label, Icon }) => (
        <Tooltip key={id}>
          <TooltipTrigger
            onClick={() => onTabChange(id)}
            className={`relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
              activeTab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            }`}
            aria-label={label}
          >
            {activeTab === id && (
              <div className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
            )}
            <Icon className="h-5.5 w-5.5" />
            {id === "suggestions" && <IconBadge count={suggestionsCount} />}
            {id === "unknown" && <IconBadge count={unknownCount} variant="warning" />}
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ))}

      <div className="mt-auto">
        <Tooltip>
          <TooltipTrigger
            onClick={onSettingsClick}
            className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
            aria-label="Settings"
          >
            <SettingsIcon className="h-5.5 w-5.5" />
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Call the hook in `TimelineShell` and pass counts to `ActivityBar`**

In `TimelineShell`, after the existing `useState`/`useEffect` block and before `handleTabChange` (around [app/timeline/layout.tsx:222](app/timeline/layout.tsx#L222)), add:

```tsx
const { suggestions: suggestionsCount, unknown: unknownCount } = useSuggestionCounts();
```

Then update the `<ActivityBar>` usage in the desktop block (currently at [app/timeline/layout.tsx:332-336](app/timeline/layout.tsx#L332-L336)):

```tsx
<ActivityBar
  activeTab={activeTab}
  onTabChange={handleTabChange}
  onSettingsClick={() => handleTabChange("settings")}
  suggestionsCount={suggestionsCount}
  unknownCount={unknownCount}
/>
```

- [ ] **Step 3: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `pnpm exec eslint app/timeline/layout.tsx`
Expected: no errors.

- [ ] **Step 5: Manual visual check (dev server)**

Run: `pnpm dev`
Open `/timeline/<some-date>`. Confirm:
- If suggestions API returns items, a small primary-colored badge with the count appears at the top-right of the Suggestions icon in the left activity bar.
- If unknown-visits API returns items, a small amber badge appears at the top-right of the Unknown Places icon.
- When either count is 0, no badge is shown for that tab.
- Counts ≥ 100 render as `99+`.

Kill the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add app/timeline/layout.tsx
git commit -m "feat: show pending count badges on desktop sidebar icons"
```

---

## Task 5: Wire counts into the mobile tab bar

**Files:**
- Modify: `app/timeline/layout.tsx`

The mobile bottom tab bar renders the same `TABS` array plus a Settings tab ([app/timeline/layout.tsx:310-326](app/timeline/layout.tsx#L310-L326)). Each tab button is already a flex column with the icon on top, so we wrap the icon in a `relative` container and overlay the same `IconBadge`.

- [ ] **Step 1: Update the mobile tab bar to render the badges**

Replace the mobile tab bar block (currently at [app/timeline/layout.tsx:310-326](app/timeline/layout.tsx#L310-L326)) with:

```tsx
<div className="flex shrink-0 border-t bg-muted/50 px-1 pb-[env(safe-area-inset-bottom)]">
  {[...TABS, { id: "settings" as SidebarTab, label: "Settings", Icon: SettingsIcon }].map(({ id, label, Icon }) => (
    <button
      key={id}
      type="button"
      onClick={() => handleMobileTabChange(id)}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
        mobileTab === id && id !== "settings"
          ? "text-foreground"
          : "text-muted-foreground"
      }`}
    >
      <span className="relative inline-flex">
        <Icon className="h-5 w-5" />
        {id === "suggestions" && <IconBadge count={suggestionsCount} />}
        {id === "unknown" && <IconBadge count={unknownCount} variant="warning" />}
      </span>
      <span className="truncate">{label}</span>
    </button>
  ))}
</div>
```

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `pnpm exec eslint app/timeline/layout.tsx`
Expected: no errors.

- [ ] **Step 4: Manual visual check (dev server, mobile viewport)**

Run: `pnpm dev`
Open `/timeline/<some-date>` in devtools with a mobile viewport (e.g. iPhone 14). Tap the floating panel button to open the mobile overlay. Confirm:
- Same badge behavior on the bottom tab bar as on desktop.
- Badges are visually positioned at the top-right of the icons, not overlapping the label text below.
- When a count is 0, no badge is shown.

Kill the dev server after confirming.

- [ ] **Step 5: Full test suite**

Run: `pnpm test`
Expected: all existing tests pass plus the new `formatCount` tests.

- [ ] **Step 6: Commit**

```bash
git add app/timeline/layout.tsx
git commit -m "feat: show pending count badges on mobile tab bar"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full lint**

Run: `pnpm exec eslint .`
Expected: no errors.

- [ ] **Step 2: Full type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full test suite**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: build succeeds.
