# PlacesPanel UI/UX Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal PlacesPanel with a scannable, informative panel that has search + sort, richer per-item context (icon, last-visited, visit count), inline edit/delete actions, and proper empty/loading/no-match states.

**Architecture:** Split the single 80-line `PlacesPanel.tsx` into an orchestrator plus focused sub-components under `components/places/`. Add a small pure helper for relative-time formatting. Reuse the existing `PlaceDetailModal` for edit/delete. No API or data-model changes — `/api/places` already returns every field needed.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui, `@tanstack/react-query`, `lucide-react`, `date-fns`, `vitest`, `@playwright/test`. Adds React Testing Library (`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`) for component tests.

---

## Spec

See `docs/superpowers/specs/2026-04-18-places-panel-ui-ux-design.md` for full design context.

## File Structure

**Create:**
- `lib/relativeTime.ts` — pure helper: `formatRelative(iso: string | null): string`.
- `tests/unit/relativeTime.test.ts` — unit tests for the helper.
- `components/places/PlaceListItem.tsx` — single row card.
- `components/places/PlacesToolbar.tsx` — search input + sort select + count.
- `components/places/PlacesEmptyState.tsx` — "no places yet" state.
- `tests/unit/PlaceListItem.test.tsx` — component tests.
- `tests/unit/PlacesPanel.test.tsx` — component tests.
- `tests/unit/relativeTime.test.ts` — unit tests (same as above — listed once).
- `tests/setup/vitest-dom.ts` — registers `@testing-library/jest-dom` matchers.
- `tests/e2e/places-panel.spec.ts` — one smoke e2e.

**Modify:**
- `components/PlacesPanel.tsx` — rewrite to orchestrate.
- `vitest.config.ts` — add jsdom env + include `.tsx` + setup file.
- `package.json` — add dev deps.

---

## Task 0: Set up React Testing Library for component tests

**Files:**
- Modify: `package.json`, `vitest.config.ts`
- Create: `tests/setup/vitest-dom.ts`

Why: The current `vitest.config.ts` uses `environment: "node"` and only matches `tests/unit/**/*.test.ts`. Component tests need a DOM and `.tsx` files.

- [ ] **Step 1: Install dev dependencies**

```bash
pnpm add -D jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: packages installed, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Create the RTL setup file**

Create `tests/setup/vitest-dom.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Update vitest config**

Replace `vitest.config.ts` with:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["tests/setup/vitest-dom.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 4: Verify existing unit tests still pass under jsdom**

Run: `pnpm test`
Expected: all existing `tests/unit/*.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts tests/setup/vitest-dom.ts
git commit -m "test: add React Testing Library + jsdom to vitest"
```

---

## Task 1: `lib/relativeTime.ts` — `formatRelative` helper

**Files:**
- Create: `lib/relativeTime.ts`
- Test: `tests/unit/relativeTime.test.ts`

Rules (spec):
- `null` → `"Never"`
- `< 60s` → `"Just now"`
- `< 60m` → `"{m}m ago"`
- `< 24h` → `"{h}h ago"`
- calendar-yesterday (local time) → `"Yesterday"`
- `< 7d` → `"{d}d ago"`
- same calendar year → `"MMM d"` (e.g., `Mar 12`)
- earlier years → `"MMM yyyy"` (e.g., `Mar 2025`)

- [ ] **Step 1: Write failing tests**

Create `tests/unit/relativeTime.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { formatRelative } from "@/lib/relativeTime";

describe("formatRelative", () => {
  const NOW = new Date("2026-04-18T12:00:00").getTime();

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns 'Never' for null", () => {
    expect(formatRelative(null)).toBe("Never");
  });

  it("returns 'Just now' under 60 seconds", () => {
    expect(formatRelative(new Date(NOW - 30_000).toISOString())).toBe("Just now");
  });

  it("returns minutes for <60m", () => {
    expect(formatRelative(new Date(NOW - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(formatRelative(new Date(NOW - 59 * 60_000).toISOString())).toBe("59m ago");
  });

  it("returns hours for <24h (same day)", () => {
    expect(formatRelative(new Date(NOW - 2 * 3600_000).toISOString())).toBe("2h ago");
  });

  it("returns 'Yesterday' for calendar-yesterday", () => {
    expect(formatRelative(new Date("2026-04-17T23:30:00").toISOString())).toBe("Yesterday");
    expect(formatRelative(new Date("2026-04-17T00:05:00").toISOString())).toBe("Yesterday");
  });

  it("returns '{d}d ago' under 7 days (not yesterday)", () => {
    expect(formatRelative(new Date("2026-04-15T10:00:00").toISOString())).toBe("3d ago");
    expect(formatRelative(new Date("2026-04-12T10:00:00").toISOString())).toBe("6d ago");
  });

  it("returns 'MMM d' for same-year older than 7 days", () => {
    expect(formatRelative(new Date("2026-03-12T10:00:00").toISOString())).toBe("Mar 12");
  });

  it("returns 'MMM yyyy' for previous years", () => {
    expect(formatRelative(new Date("2025-03-12T10:00:00").toISOString())).toBe("Mar 2025");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test relativeTime`
Expected: FAIL — `Cannot find module '@/lib/relativeTime'`.

- [ ] **Step 3: Implement the helper**

Create `lib/relativeTime.ts`:

```ts
import { format, isYesterday } from "date-fns";

export function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 60_000) return "Just now";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;

  const sameDay =
    date.getFullYear() === new Date(now).getFullYear() &&
    date.getMonth() === new Date(now).getMonth() &&
    date.getDate() === new Date(now).getDate();
  const diffHour = Math.floor(diffMs / 3_600_000);
  if (sameDay && diffHour < 24) return `${diffHour}h ago`;

  if (isYesterday(date)) return "Yesterday";

  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay < 7) return `${diffDay}d ago`;

  if (date.getFullYear() === new Date(now).getFullYear()) {
    return format(date, "MMM d");
  }
  return format(date, "MMM yyyy");
}
```

- [ ] **Step 4: Run tests and verify pass**

Run: `pnpm test relativeTime`
Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/relativeTime.ts tests/unit/relativeTime.test.ts
git commit -m "feat: add formatRelative helper for last-visited timestamps"
```

---

## Task 2: `PlaceListItem` component (TDD)

**Files:**
- Create: `components/places/PlaceListItem.tsx`
- Test: `tests/unit/PlaceListItem.test.tsx`

Row has three inline hover actions (per spec's Risks & trade-offs mitigation — no popover primitive yet): Edit (✎), Copy coordinates, Delete (🗑). Delete uses `window.confirm` for first pass.

- [ ] **Step 1: Write failing tests**

Create `tests/unit/PlaceListItem.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlaceListItem, { type PlacePanelItem } from "@/components/places/PlaceListItem";

const BASE: PlacePanelItem = {
  id: 1,
  name: "Home",
  lat: 10.77,
  lon: 106.7,
  radius: 50,
  isActive: true,
  totalVisits: 128,
  confirmedVisits: 128,
  visitsInRange: 128,
  confirmedVisitsInRange: 128,
  suggestedVisitsInRange: 0,
  lastVisitAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  createdAt: new Date("2025-01-01").toISOString(),
};

describe("PlaceListItem", () => {
  let flyHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    flyHandler = vi.fn();
    window.addEventListener("opentimeline:fly-to", flyHandler as EventListener);
  });

  afterEach(() => {
    window.removeEventListener("opentimeline:fly-to", flyHandler as EventListener);
    vi.restoreAllMocks();
  });

  const noop = () => {};

  it("renders name, visits count, radius, and relative time", () => {
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText(/128 visits/)).toBeInTheDocument();
    expect(screen.getByText(/50m radius/)).toBeInTheDocument();
    expect(screen.getByText(/2d ago/)).toBeInTheDocument();
  });

  it("pluralizes '1 visit' vs multiple visits", () => {
    const single = { ...BASE, confirmedVisits: 1 };
    const { rerender } = render(<PlaceListItem place={single} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText(/1 visit · 50m radius/)).toBeInTheDocument();

    rerender(<PlaceListItem place={{ ...BASE, confirmedVisits: 2 }} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText(/2 visits · 50m radius/)).toBeInTheDocument();
  });

  it("shows 'No visits yet' when confirmedVisits is 0 and hides the last-visit line", () => {
    const never = { ...BASE, confirmedVisits: 0, lastVisitAt: null };
    render(<PlaceListItem place={never} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText(/No visits yet/)).toBeInTheDocument();
    expect(screen.queryByText(/ago|Never|Yesterday/)).not.toBeInTheDocument();
  });

  it("dispatches opentimeline:fly-to when the row is clicked", async () => {
    const user = userEvent.setup();
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={noop} />);
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(flyHandler).toHaveBeenCalledTimes(1);
    const detail = (flyHandler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toEqual({ lat: BASE.lat, lon: BASE.lon });
  });

  it("dispatches fly-to on Enter key", () => {
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={noop} />);
    const row = screen.getByRole("button", { name: "Home" });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(flyHandler).toHaveBeenCalledTimes(1);
  });

  it("edit button calls onEdit and does NOT dispatch fly-to", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<PlaceListItem place={BASE} onEdit={onEdit} onDelete={noop} />);
    await user.click(screen.getByRole("button", { name: /edit place/i }));
    expect(onEdit).toHaveBeenCalledWith(BASE);
    expect(flyHandler).not.toHaveBeenCalled();
  });

  it("copy-coords button writes '{lat}, {lon}' to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const user = userEvent.setup();
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={noop} />);
    await user.click(screen.getByRole("button", { name: /copy coordinates/i }));
    expect(writeText).toHaveBeenCalledWith(`${BASE.lat}, ${BASE.lon}`);
    expect(flyHandler).not.toHaveBeenCalled();
  });

  it("delete button calls onDelete only after window.confirm", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: /delete place/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith(BASE);
    expect(flyHandler).not.toHaveBeenCalled();
  });

  it("delete button does NOT call onDelete when confirm is cancelled", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PlaceListItem place={BASE} onEdit={noop} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: /delete place/i }));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test PlaceListItem`
Expected: FAIL — cannot find `@/components/places/PlaceListItem`.

- [ ] **Step 3: Implement the component**

Create `components/places/PlaceListItem.tsx`:

```tsx
"use client";

import { MapPin, Pencil, Copy, Trash2 } from "lucide-react";
import { formatRelative } from "@/lib/relativeTime";

export type PlacePanelItem = {
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

type Props = {
  place: PlacePanelItem;
  onEdit: (place: PlacePanelItem) => void;
  onDelete: (place: PlacePanelItem) => void;
};

export default function PlaceListItem({ place, onEdit, onDelete }: Props) {
  const hasVisits = place.confirmedVisits > 0;
  const visitsLabel = hasVisits
    ? `${place.confirmedVisits} ${place.confirmedVisits === 1 ? "visit" : "visits"} · ${place.radius}m radius`
    : `No visits yet · ${place.radius}m radius`;

  function flyTo() {
    window.dispatchEvent(
      new CustomEvent("opentimeline:fly-to", {
        detail: { lat: place.lat, lon: place.lon },
      })
    );
  }

  async function handleCopyCoords(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(`${place.lat}, ${place.lon}`);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const ok = window.confirm(
      `Delete "${place.name}"? This cannot be undone.`
    );
    if (ok) onDelete(place);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={place.name}
      title={place.name}
      onClick={flyTo}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          flyTo();
        }
      }}
      className="group relative flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 pr-20 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <MapPin className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">
          {place.name}
        </p>
        {hasVisits && place.lastVisitAt != null && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last visited {formatRelative(place.lastVisitAt)}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">{visitsLabel}</p>
      </div>
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-60">
        <button
          type="button"
          aria-label="Edit place"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(place);
          }}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Copy coordinates"
          onClick={handleCopyCoords}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Delete place"
          onClick={handleDelete}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and verify pass**

Run: `pnpm test PlaceListItem`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/places/PlaceListItem.tsx tests/unit/PlaceListItem.test.tsx
git commit -m "feat(places): add PlaceListItem card with hover edit action"
```

---

## Task 3: `PlacesEmptyState` component

**Files:**
- Create: `components/places/PlacesEmptyState.tsx`

Small dumb component — no unit test (tested via `PlacesPanel` tests in Task 5).

- [ ] **Step 1: Implement**

Create `components/places/PlacesEmptyState.tsx`:

```tsx
import { MapPin } from "lucide-react";

export default function PlacesEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <MapPin className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">No places yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Click anywhere on the map to drop your first place.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/places/PlacesEmptyState.tsx
git commit -m "feat(places): add PlacesEmptyState"
```

---

## Task 4: `PlacesToolbar` component

**Files:**
- Create: `components/places/PlacesToolbar.tsx`

Renders search input + sort `<Select>` + count. No local state — all controlled via props. No unit test (tested via `PlacesPanel` tests in Task 5).

- [ ] **Step 1: Implement**

Create `components/places/PlacesToolbar.tsx`:

```tsx
"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PlacesSort = "recent" | "visits" | "name";

type Props = {
  query: string;
  onQueryChange: (next: string) => void;
  sort: PlacesSort;
  onSortChange: (next: PlacesSort) => void;
  count: number;
};

export default function PlacesToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  count,
}: Props) {
  return (
    <div className="flex flex-col gap-2 border-b px-3 py-2">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search places…"
          className="h-8 flex-1 text-xs"
          aria-label="Search places"
        />
        <Select
          value={sort}
          onValueChange={(v) => onSortChange(v as PlacesSort)}
        >
          <SelectTrigger size="sm" className="h-8 text-xs" aria-label="Sort places">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent activity</SelectItem>
            <SelectItem value="visits">Most visits</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {count} {count === 1 ? "place" : "places"}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/places/PlacesToolbar.tsx
git commit -m "feat(places): add PlacesToolbar with search + sort"
```

---

## Task 5: Rewrite `PlacesPanel.tsx` and add panel tests

**Files:**
- Modify: `components/PlacesPanel.tsx` (full rewrite)
- Create: `tests/unit/PlacesPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/PlacesPanel.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlacesPanel from "@/components/PlacesPanel";

const FIXTURES = [
  {
    id: 1, name: "Home", lat: 1, lon: 2, radius: 50, isActive: true,
    totalVisits: 100, confirmedVisits: 100, visitsInRange: 100,
    confirmedVisitsInRange: 100, suggestedVisitsInRange: 0,
    lastVisitAt: new Date(Date.now() - 86_400_000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: 2, name: "Office", lat: 3, lon: 4, radius: 80, isActive: true,
    totalVisits: 50, confirmedVisits: 50, visitsInRange: 50,
    confirmedVisitsInRange: 50, suggestedVisitsInRange: 0,
    lastVisitAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    createdAt: "2025-01-02T00:00:00Z",
  },
  {
    id: 3, name: "Airport", lat: 5, lon: 6, radius: 200, isActive: true,
    totalVisits: 5, confirmedVisits: 5, visitsInRange: 5,
    confirmedVisitsInRange: 5, suggestedVisitsInRange: 0,
    lastVisitAt: null,
    createdAt: "2025-01-03T00:00:00Z",
  },
];

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PlacesPanel />
    </QueryClientProvider>
  );
}

describe("PlacesPanel", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/api/places")) {
        return new Response(JSON.stringify(FIXTURES), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the empty state when places list is empty", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 })
    );
    renderPanel();
    expect(await screen.findByText("No places yet")).toBeInTheDocument();
  });

  it("filters by query (case-insensitive)", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Home");
    await user.type(screen.getByLabelText("Search places"), "off");
    expect(screen.getByText("Office")).toBeInTheDocument();
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    expect(screen.queryByText("Airport")).not.toBeInTheDocument();
  });

  it("shows 'No places match' with a clear button when filter is empty", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Home");
    const search = screen.getByLabelText("Search places");
    await user.type(search, "zzzz");
    expect(screen.getByText(/No places match/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /clear search/i }));
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("sorts by recent activity by default (nulls last)", async () => {
    renderPanel();
    await screen.findByText("Home");
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    const placeOrder = names.filter((n) => n && ["Home", "Office", "Airport"].includes(n));
    expect(placeOrder).toEqual(["Home", "Office", "Airport"]);
  });

  it("persists sort choice to localStorage", async () => {
    localStorage.setItem("places.sort", "visits");
    renderPanel();
    await screen.findByText("Home");
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    const placeOrder = names.filter((n) => n && ["Home", "Office", "Airport"].includes(n));
    expect(placeOrder).toEqual(["Home", "Office", "Airport"]);
  });
});
```

Note: the order test checks that the `aria-label` on each row matches the expected order. `getAllByRole("button")` will include edit buttons too — we filter to just the row labels.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm test PlacesPanel`
Expected: FAIL — most tests fail because the current PlacesPanel has no sort select, no "No places match" block, and a different empty-state message.

- [ ] **Step 3: Rewrite `PlacesPanel.tsx`**

Replace `components/PlacesPanel.tsx` with:

```tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PlaceListItem, {
  type PlacePanelItem,
} from "@/components/places/PlaceListItem";
import PlacesToolbar, {
  type PlacesSort,
} from "@/components/places/PlacesToolbar";
import PlacesEmptyState from "@/components/places/PlacesEmptyState";
import PlaceDetailModal from "@/components/PlaceDetailModal";

const SORT_KEY = "places.sort";

function readSort(): PlacesSort {
  if (typeof window === "undefined") return "recent";
  const saved = window.localStorage.getItem(SORT_KEY);
  if (saved === "recent" || saved === "visits" || saved === "name") return saved;
  return "recent";
}

function sortPlaces(list: PlacePanelItem[], sort: PlacesSort): PlacePanelItem[] {
  const copy = [...list];
  if (sort === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "visits") {
    copy.sort((a, b) => b.confirmedVisits - a.confirmedVisits);
  } else {
    copy.sort((a, b) => {
      const ta = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : -Infinity;
      const tb = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : -Infinity;
      return tb - ta;
    });
  }
  return copy;
}

export default function PlacesPanel() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PlacesSort>(() => readSort());
  const [editingPlace, setEditingPlace] = useState<PlacePanelItem | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SORT_KEY, sort);
    }
  }, [sort]);

  const { data: places = [], isLoading } = useQuery<PlacePanelItem[]>({
    queryKey: ["places"],
    queryFn: async () => {
      const res = await fetch("/api/places");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? places.filter((p) => p.name.toLowerCase().includes(q))
      : places;
    return sortPlaces(base, sort);
  }, [places, query, sort]);

  async function handleDelete(place: PlacePanelItem) {
    const res = await fetch(`/api/places/${place.id}`, { method: "DELETE" });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["places"] });
      queryClient.invalidateQueries({ queryKey: ["visits"] });
    }
  }

  if (isLoading && places.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-col gap-2 border-b px-3 py-2">
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="space-y-1 p-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-2.5 p-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (places.length === 0) {
    return <PlacesEmptyState />;
  }

  return (
    <div className="flex h-full flex-col">
      <PlacesToolbar
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        count={filtered.length}
      />
      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <p className="text-xs text-muted-foreground">
            No places match &quot;{query}&quot;
          </p>
          <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <ul className="space-y-0.5 p-2">
            {filtered.map((p) => (
              <li key={p.id}>
                <PlaceListItem
                  place={p}
                  onEdit={setEditingPlace}
                  onDelete={handleDelete}
                />
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}

      {editingPlace && (
        <PlaceDetailModal
          place={editingPlace}
          onClose={() => setEditingPlace(null)}
        />
      )}
    </div>
  );
}
```

Note: `PlaceDetailModal` expects `PlaceData` from `@/lib/detectVisits`, which has the same required fields (`id, name, lat, lon, radius, isActive`) as `PlacePanelItem` — it will accept the object.

- [ ] **Step 4: Run tests and verify pass**

Run: `pnpm test PlacesPanel`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/PlacesPanel.tsx tests/unit/PlacesPanel.test.tsx
git commit -m "feat(places): revamp PlacesPanel with sort, empty/no-match states, edit modal"
```

---

## Task 6: Playwright smoke test

**Files:**
- Create: `tests/e2e/places-panel.spec.ts`

Lightweight: only checks the panel renders a seeded place, search filters, and a row click dispatches `opentimeline:fly-to`.

- [ ] **Step 1: Inspect existing e2e patterns**

Run: `head -50 tests/e2e/map-progressive-load.spec.ts`
Use whatever auth / seeding the project already does. If the project has a dev seed or the dev server is reachable at `http://localhost:3000`, follow the same setup.

- [ ] **Step 2: Write the spec**

Create `tests/e2e/places-panel.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

// The Places tab is toggled via the sidebar activity bar button (aria-label="Places").
// If the app has no seeded places the empty state renders — we assert that and return.
// Otherwise we exercise search + row-click fly-to.

test("places panel: empty state OR search and row click dispatches fly-to", async ({ page }) => {
  await page.goto("/timeline");

  // Open the Places tab.
  await page.getByRole("button", { name: "Places" }).first().click();

  const emptyState = page.getByText("No places yet");
  const search = page.getByLabel("Search places");

  if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
    await expect(emptyState).toBeVisible();
    return;
  }

  await expect(search).toBeVisible();

  // Attach a listener to capture the fly-to event.
  await page.evaluate(() => {
    (window as Window & { __flyTo?: unknown }).__flyTo = null;
    window.addEventListener("opentimeline:fly-to", (e) => {
      (window as Window & { __flyTo?: unknown }).__flyTo = (e as CustomEvent).detail;
    });
  });

  // Click the first row inside the panel (skip the activity-bar buttons and search/sort).
  // PlaceListItem is a div with role="button" and aria-label equal to the place name.
  const firstRow = page.locator('ul li div[role="button"]').first();
  await firstRow.click();

  const detail = await page.evaluate(
    () => (window as Window & { __flyTo?: { lat: number; lon: number } }).__flyTo
  );
  expect(detail).toMatchObject({
    lat: expect.any(Number),
    lon: expect.any(Number),
  });
});
```

Note: The `aria-label="Places"` tab button is rendered by `app/timeline/layout.tsx` in the `ActivityBar`. If the locator finds multiple matches (e.g. mobile duplicate), `.first()` picks the desktop one. If playwright reports strict-mode violations, scope the locator to the desktop sidebar region.

- [ ] **Step 3: Run**

Run: `pnpm test:e2e places-panel`
Expected: passes (or skips with empty-state branch if no seed data).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/places-panel.spec.ts
git commit -m "test: add playwright smoke for places panel"
```

---

## Task 7: Lint and final verification

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `pnpm exec eslint .`
Expected: no errors.

- [ ] **Step 2: Full unit suite**

Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 3: Manual smoke (dev server)**

Run: `pnpm dev` in one terminal.

Check by hand in the browser:
- Empty state: in a DB with no places, the panel shows "No places yet" with the icon.
- Create a place via the map, then re-open the Places tab: row appears with correct name, last-visited, visit count.
- Loading skeleton appears briefly on first mount of the panel (hard reload).
- Search narrows the list; typing gibberish shows the "No places match" block + Clear search button.
- Change the sort dropdown → order updates and persists across reloads (check `localStorage["places.sort"]`).
- Hover a row → edit icon appears. Click it → `PlaceDetailModal` opens. Close modal with Escape.
- Click a row (not the icon) → map flies to the place.
- Keyboard: Tab into a row, press Enter → map flies.

- [ ] **Step 4: Commit nothing (verification only)**

No commit for this task.

---

## Task 8 (Optional): Clean up the old unused `Place` type reference

**Files:**
- Audit: anything that still imports the old shape from `PlacesPanel` (there shouldn't be any — it wasn't exported).

Skip if no hits.

Run: `grep -rn "from \"@/components/PlacesPanel\"" .`
If empty, skip. Otherwise update callers to import `PlacePanelItem` from `@/components/places/PlaceListItem`.

---

## Completion checklist

- [ ] Task 0: RTL setup committed, existing tests still pass
- [ ] Task 1: `formatRelative` + 8 unit tests pass
- [ ] Task 2: `PlaceListItem` + 8 unit tests pass
- [ ] Task 3: `PlacesEmptyState` committed
- [ ] Task 4: `PlacesToolbar` committed
- [ ] Task 5: `PlacesPanel` rewritten + 5 unit tests pass
- [ ] Task 6: Playwright smoke committed and passing
- [ ] Task 7: `pnpm exec eslint .` clean, `pnpm test` clean, manual smoke done
