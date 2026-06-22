# Place Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add free-form tag support to places — users can label places with tags, search/filter by them via the existing search bar with autocomplete, and manage tags inline in both the list and the detail modal.

**Architecture:** A `Tag` + `PlaceTag` join table stores tags; `PUT /api/places/:id/tags` replaces tag associations atomically; `GET /api/tags?q=` serves autocomplete; a shared `TagEditor` component handles pills + input in both list (popover) and detail modal (inline); `GET /api/places` is extended to include tags in the response and match them in the `q` search.

**Tech Stack:** Next.js App Router API routes, Prisma + PostgreSQL, React Query v5, shadcn/ui, Tailwind CSS 4, Vitest + Testing Library, Playwright.

## Global Constraints

- Run all unit tests with: `pnpm exec vitest run tests/unit/<file>`
- Run all tests: `pnpm test`
- Lint: `pnpm exec eslint .`
- Tags are always normalized to lowercase before saving
- Font size ≥ 16px on all inputs (iOS zoom prevention)
- Follow TDD: write the failing test first, then implement

---

### Task 1: Database schema — add Tag and PlaceTag models

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Tag` model (`id`, `name`), `PlaceTag` model (`placeId`, `tagId`), `Place.tags` relation

- [ ] **Step 1: Add models to schema**

In `prisma/schema.prisma`, add the following after the `Place` model:

```prisma
model Tag {
  id     Int        @id @default(autoincrement())
  name   String     @unique
  places PlaceTag[]
}

model PlaceTag {
  placeId Int
  tagId   Int
  place   Place @relation(fields: [placeId], references: [id], onDelete: Cascade)
  tag     Tag   @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([placeId, tagId])
}
```

Also add `tags PlaceTag[]` to the `Place` model block (after the `visits` field):

```prisma
  visits    Visit[]
  tags      PlaceTag[]
```

- [ ] **Step 2: Run migration**

```bash
pnpm prisma migrate dev --name add-place-tags
```

Expected: migration file created, `Tag` and `PlaceTag` tables created in the database, Prisma client regenerated.

- [ ] **Step 3: Verify Prisma client has the new types**

```bash
pnpm prisma generate
```

Expected: no errors. `prisma.tag` and `prisma.placeTag` are now available.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Tag and PlaceTag schema models"
```

---

### Task 2: `GET /api/tags` endpoint

**Files:**
- Create: `app/api/tags/route.ts`
- Create: `tests/unit/api-tags.test.ts`

**Interfaces:**
- Produces: `GET /api/tags?q=<string>` → `{ tags: string[] }` (up to 10 names, ordered by usage count desc)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-tags.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tag: { findMany: vi.fn() },
  },
}));

import { GET } from "@/app/api/tags/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function makeRequest(q?: string) {
  const url = q ? `http://localhost/api/tags?q=${encodeURIComponent(q)}` : "http://localhost/api/tags";
  return new Request(url) as unknown as import("next/server").NextRequest;
}

describe("GET /api/tags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns matching tag names ordered by usage count", async () => {
    (prisma.tag.findMany as unknown as MockFn).mockResolvedValue([
      { name: "coffee", _count: { places: 5 } },
      { name: "cafe", _count: { places: 2 } },
    ]);

    const res = await GET(makeRequest("c"));
    const body = await res.json();

    expect(body).toEqual({ tags: ["coffee", "cafe"] });
    expect(prisma.tag.findMany).toHaveBeenCalledWith({
      where: { name: { contains: "c", mode: "insensitive" } },
      orderBy: { places: { _count: "desc" } },
      take: 10,
      select: { name: true },
    });
  });

  it("returns all tags when q is empty", async () => {
    (prisma.tag.findMany as unknown as MockFn).mockResolvedValue([
      { name: "work" },
      { name: "home" },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body).toEqual({ tags: ["work", "home"] });
    expect(prisma.tag.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { places: { _count: "desc" } },
      take: 10,
      select: { name: true },
    });
  });

  it("returns empty array when no tags match", async () => {
    (prisma.tag.findMany as unknown as MockFn).mockResolvedValue([]);
    const res = await GET(makeRequest("zzz"));
    const body = await res.json();
    expect(body).toEqual({ tags: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run tests/unit/api-tags.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/tags/route'`

- [ ] **Step 3: Implement the endpoint**

Create `app/api/tags/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() || null;

  const tags = await prisma.tag.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { places: { _count: "desc" } },
    take: 10,
    select: { name: true },
  });

  return NextResponse.json({ tags: tags.map((t) => t.name) });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm exec vitest run tests/unit/api-tags.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/tags/route.ts tests/unit/api-tags.test.ts
git commit -m "feat: add GET /api/tags autocomplete endpoint"
```

---

### Task 3: `PUT /api/places/:id/tags` endpoint

**Files:**
- Create: `app/api/places/[id]/tags/route.ts`
- Create: `tests/unit/api-place-tags.test.ts`

**Interfaces:**
- Consumes: `PUT /api/places/:id/tags` body `{ tags: string[] }` (lowercase names)
- Produces: `{ tags: string[] }` of saved tag names

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-place-tags.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
    tag: { upsert: vi.fn() },
    placeTag: { deleteMany: vi.fn(), createMany: vi.fn() },
    place: { findUnique: vi.fn() },
  },
}));

import { PUT } from "@/app/api/places/[id]/tags/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function makeRequest(id: string, tags: string[]) {
  return {
    json: async () => ({ tags }),
    nextUrl: { pathname: `/api/places/${id}/tags` },
  } as unknown as import("next/server").NextRequest;
}

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("PUT /api/places/:id/tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.place.findUnique as unknown as MockFn).mockResolvedValue({ id: 1 });
  });

  it("returns 404 when place does not exist", async () => {
    (prisma.place.findUnique as unknown as MockFn).mockResolvedValue(null);
    const res = await PUT(makeRequest("99", []), makeParams("99"));
    expect(res.status).toBe(404);
  });

  it("upserts tags and replaces PlaceTag rows atomically", async () => {
    const tagA = { id: 1, name: "coffee" };
    const tagB = { id: 2, name: "work" };

    mockTransaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
      const tx = {
        tag: {
          upsert: vi.fn()
            .mockResolvedValueOnce(tagA)
            .mockResolvedValueOnce(tagB),
        },
        placeTag: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          createMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      };
      return fn(tx as unknown as typeof prisma);
    });

    const res = await PUT(makeRequest("1", ["Coffee", "work"]), makeParams("1"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ tags: ["coffee", "work"] });

    const txFn = mockTransaction.mock.calls[0][0];
    expect(typeof txFn).toBe("function");
  });

  it("normalizes tag names to lowercase", async () => {
    mockTransaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
      const tx = {
        tag: { upsert: vi.fn().mockResolvedValue({ id: 3, name: "café" }) },
        placeTag: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          createMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return fn(tx as unknown as typeof prisma);
    });

    const res = await PUT(makeRequest("1", ["CAFÉ"]), makeParams("1"));
    const body = await res.json();
    expect(body).toEqual({ tags: ["café"] });
  });

  it("handles empty tag list — removes all tags", async () => {
    mockTransaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
      const tx = {
        tag: { upsert: vi.fn() },
        placeTag: {
          deleteMany: vi.fn().mockResolvedValue({ count: 3 }),
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      return fn(tx as unknown as typeof prisma);
    });

    const res = await PUT(makeRequest("1", []), makeParams("1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ tags: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run tests/unit/api-place-tags.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/places/[id]/tags/route'`

- [ ] **Step 3: Implement the endpoint**

Create `app/api/places/[id]/tags/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const placeId = Number.parseInt(id, 10);
  if (!Number.isInteger(placeId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await prisma.place.findUnique({ where: { id: placeId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }

  const body = await request.json();
  const rawTags: string[] = Array.isArray(body.tags) ? body.tags : [];
  const normalized = rawTags.map((t) => String(t).toLowerCase().trim()).filter(Boolean);

  const savedTags = await prisma.$transaction(async (tx) => {
    const tagRows = await Promise.all(
      normalized.map((name) =>
        tx.tag.upsert({
          where: { name },
          create: { name },
          update: {},
          select: { id: true, name: true },
        })
      )
    );

    await tx.placeTag.deleteMany({ where: { placeId } });

    if (tagRows.length > 0) {
      await tx.placeTag.createMany({
        data: tagRows.map((t) => ({ placeId, tagId: t.id })),
        skipDuplicates: true,
      });
    }

    return tagRows.map((t) => t.name);
  });

  return NextResponse.json({ tags: savedTags });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm exec vitest run tests/unit/api-place-tags.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/places/[id]/tags/route.ts tests/unit/api-place-tags.test.ts
git commit -m "feat: add PUT /api/places/:id/tags endpoint"
```

---

### Task 4: Extend `GET /api/places` — include tags + tag search

**Files:**
- Modify: `app/api/places/route.ts`
- Modify: `lib/detectVisits.ts` (add `tags` to `PlaceData`)
- Modify: `components/places/PlaceListItem.tsx` (add `tags` to `PlacePanelItem`)
- Create: `tests/unit/api-places-tags.test.ts`

**Interfaces:**
- Produces: each place in the response now includes `tags: string[]`
- The `q` param now also matches tag names

- [ ] **Step 1: Write the failing test**

Create `tests/unit/api-places-tags.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    visit: { groupBy: vi.fn() },
    placeTag: { findMany: vi.fn() },
  },
}));

import { GET } from "@/app/api/places/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

function makeRequest(params: Record<string, string> = {}) {
  const sp = new URLSearchParams(params);
  return new Request(`http://localhost/api/places?${sp}`) as unknown as import("next/server").NextRequest;
}

const PLACE_ROW = {
  id: 1,
  name: "Home",
  lat: 10,
  lon: 20,
  radius: 50,
  isActive: true,
  createdAt: new Date("2025-01-01"),
  parentId: null,
  parentName: null,
  childCount: BigInt(0),
  lastVisitAt: null,
  confirmedVisits: BigInt(5),
  totalVisits: BigInt(5),
};

describe("GET /api/places — tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.visit.groupBy as unknown as MockFn).mockResolvedValue([]);
    (prisma.placeTag.findMany as unknown as MockFn).mockResolvedValue([
      { placeId: 1, tag: { name: "coffee" } },
      { placeId: 1, tag: { name: "work" } },
    ]);
  });

  it("includes tags array in each place in the response", async () => {
    (prisma.$queryRaw as unknown as MockFn)
      .mockResolvedValueOnce([PLACE_ROW])
      .mockResolvedValueOnce([{ count: BigInt(1) }]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.places[0].tags).toEqual(["coffee", "work"]);
  });

  it("returns empty tags array when place has no tags", async () => {
    (prisma.$queryRaw as unknown as MockFn)
      .mockResolvedValueOnce([PLACE_ROW])
      .mockResolvedValueOnce([{ count: BigInt(1) }]);
    (prisma.placeTag.findMany as unknown as MockFn).mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.places[0].tags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run tests/unit/api-places-tags.test.ts
```

Expected: FAIL — `body.places[0].tags` is `undefined`.

- [ ] **Step 3: Update `GET /api/places` to include tags and extend search**

In `app/api/places/route.ts`:

**3a.** Replace the `q` condition (line ~72) from:
```typescript
  if (q) {
    conditions.push(Prisma.sql`LOWER(p.name) LIKE ${"%" + q.toLowerCase() + "%"}`);
  }
```
to:
```typescript
  if (q) {
    conditions.push(
      Prisma.sql`(
        LOWER(p.name) LIKE ${"%" + q.toLowerCase() + "%"}
        OR EXISTS (
          SELECT 1 FROM "PlaceTag" pt
          JOIN "Tag" t ON t.id = pt."tagId"
          WHERE pt."placeId" = p.id AND LOWER(t.name) LIKE ${"%" + q.toLowerCase() + "%"}
        )
      )`
    );
  }
```

**3b.** After the `inRangeMap` population (after line ~171), fetch tags for the current page's place IDs. Add this block before the `const places = pageRows.map(...)` line:

```typescript
  const tagsByPlaceId = new Map<number, string[]>();
  if (placeIds.length > 0) {
    const placeTags = await prisma.placeTag.findMany({
      where: { placeId: { in: placeIds } },
      select: { placeId: true, tag: { select: { name: true } } },
    });
    for (const pt of placeTags) {
      const existing = tagsByPlaceId.get(pt.placeId) ?? [];
      existing.push(pt.tag.name);
      tagsByPlaceId.set(pt.placeId, existing);
    }
  }
```

**3c.** In the `places` mapping (the `return { id: r.id, ... }` block), add `tags` at the end:

```typescript
      tags: tagsByPlaceId.get(r.id) ?? [],
```

- [ ] **Step 4: Update `PlacePanelItem` type in `components/places/PlaceListItem.tsx`**

Add `tags: string[]` to the `PlacePanelItem` type:

```typescript
export type PlacePanelItem = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  isActive: boolean;
  parentId: number | null;
  parentName: string | null;
  childCount: number;
  totalVisits: number;
  confirmedVisits: number;
  visitsInRange: number;
  confirmedVisitsInRange: number;
  suggestedVisitsInRange: number;
  lastVisitAt: string | null;
  createdAt: string;
  tags: string[];
};
```

- [ ] **Step 5: Update `PlaceData` type in `lib/detectVisits.ts`**

Add `tags?: string[]` to the `PlaceData` type:

```typescript
export type PlaceData = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  isActive: boolean;
  childCount?: number;
  visitsInRange?: number;
  confirmedVisitsInRange?: number;
  suggestedVisitsInRange?: number;
  lastVisitAt?: string;
  tags?: string[];
};
```

- [ ] **Step 6: Fix the existing PlaceListItem test — add `tags` to BASE fixture**

In `tests/unit/PlaceListItem.test.tsx`, update the `BASE` constant to add `tags: []`:

```typescript
const BASE: PlacePanelItem = {
  id: 1,
  name: "Home",
  // ... all existing fields ...
  createdAt: new Date("2025-01-01").toISOString(),
  tags: [],
};
```

- [ ] **Step 7: Run all tests to verify**

```bash
pnpm exec vitest run tests/unit/api-places-tags.test.ts tests/unit/PlaceListItem.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add app/api/places/route.ts lib/detectVisits.ts components/places/PlaceListItem.tsx tests/unit/api-places-tags.test.ts tests/unit/PlaceListItem.test.tsx
git commit -m "feat: extend GET /api/places to include tags and match tag names in search"
```

---

### Task 5: `TagEditor` component

**Files:**
- Create: `components/places/TagEditor.tsx`
- Create: `tests/unit/TagEditor.test.tsx`

Note: This task installs the shadcn Popover component and builds the shared `TagEditor`.

**Interfaces:**
- Produces: `TagEditor` component with props `{ placeId: number; initialTags: string[]; onTagsChange?: (tags: string[]) => void; inline?: boolean }`
- `inline={true}` renders the full editor expanded; `inline={false}` (default) wraps it in a Popover triggered by a "+ tag" button

- [ ] **Step 1: Install shadcn Popover component**

```bash
pnpm dlx shadcn add popover
```

Expected: `components/ui/popover.tsx` created.

- [ ] **Step 2: Write the failing test**

Create `tests/unit/TagEditor.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TagEditor from "@/components/places/TagEditor";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("TagEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders existing tags as removable pills", () => {
    render(
      <TagEditor placeId={1} initialTags={["coffee", "work"]} inline />,
      { wrapper }
    );
    expect(screen.getByText("coffee")).toBeInTheDocument();
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(2);
  });

  it("normalizes input to lowercase and calls PUT /api/places/:id/tags on Enter", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tags: ["coffee"] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tags: [] }) } as Response);

    render(<TagEditor placeId={1} initialTags={[]} inline />, { wrapper });

    const input = screen.getByRole("textbox");
    await user.type(input, "Coffee{Enter}");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/places/1/tags",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ tags: ["coffee"] }),
        })
      );
    });
  });

  it("removes a tag when × is clicked and calls PUT /api/places/:id/tags", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["work"] }),
    } as Response);

    render(<TagEditor placeId={1} initialTags={["coffee", "work"]} inline />, { wrapper });

    const removeButtons = screen.getAllByRole("button", { name: /remove coffee/i });
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/places/1/tags",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ tags: ["work"] }),
        })
      );
    });
  });

  it("does not add duplicate tags", async () => {
    const user = userEvent.setup();

    render(<TagEditor placeId={1} initialTags={["coffee"]} inline />, { wrapper });

    const input = screen.getByRole("textbox");
    await user.type(input, "coffee{Enter}");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("calls onTagsChange after successful save", async () => {
    const user = userEvent.setup();
    const onTagsChange = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["new"] }),
    } as Response);

    render(
      <TagEditor placeId={1} initialTags={[]} onTagsChange={onTagsChange} inline />,
      { wrapper }
    );

    await user.type(screen.getByRole("textbox"), "new{Enter}");

    await waitFor(() => {
      expect(onTagsChange).toHaveBeenCalledWith(["new"]);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm exec vitest run tests/unit/TagEditor.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/places/TagEditor'`

- [ ] **Step 4: Implement `TagEditor`**

Create `components/places/TagEditor.tsx`:

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Tag } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  placeId: number;
  initialTags: string[];
  onTagsChange?: (tags: string[]) => void;
  inline?: boolean;
};

function TagEditorInner({
  placeId,
  tags,
  setTags,
  onTagsChange,
}: {
  placeId: number;
  tags: string[];
  setTags: (tags: string[]) => void;
  onTagsChange?: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const debouncedInput = useDebounce(input, 200);

  const { data: suggestions = [] } = useQuery<string[]>({
    queryKey: ["tags", "autocomplete", debouncedInput],
    queryFn: async () => {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(debouncedInput)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.tags as string[]).filter((t) => !tags.includes(t));
    },
    enabled: showSuggestions,
  });

  async function saveTags(next: string[]) {
    const res = await fetch(`/api/places/${placeId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setTags(data.tags);
      queryClient.invalidateQueries({ queryKey: ["places"] });
      onTagsChange?.(data.tags);
    }
  }

  async function addTag(name: string) {
    const normalized = name.toLowerCase().trim();
    if (!normalized || tags.includes(normalized)) return;
    const next = [...tags, normalized];
    setInput("");
    setShowSuggestions(false);
    await saveTags(next);
  }

  async function removeTag(name: string) {
    const next = tags.filter((t) => t !== name);
    await saveTags(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void addTag(input);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => void removeTag(tag)}
            className="ml-0.5 rounded-full hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag…"
          className="h-6 w-24 rounded border border-dashed border-muted-foreground/40 bg-transparent px-2 text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          style={{ fontSize: 16 }}
          aria-label="Add tag"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute left-0 top-7 z-50 min-w-32 rounded-md border bg-popover p-1 shadow-md">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void addTag(s);
                  }}
                  className="w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function TagEditor({ placeId, initialTags, onTagsChange, inline = false }: Props) {
  const [tags, setTags] = useState(initialTags);
  const [open, setOpen] = useState(false);

  if (inline) {
    return (
      <TagEditorInner
        placeId={placeId}
        tags={tags}
        setTags={setTags}
        onTagsChange={onTagsChange}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
        >
          {tag}
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Edit tags"
            className="flex items-center gap-0.5 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Tag className="h-2.5 w-2.5" />
            {tags.length === 0 ? "tag" : "+"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start" side="bottom">
          <TagEditorInner
            placeId={placeId}
            tags={tags}
            setTags={(next) => {
              setTags(next);
              onTagsChange?.(next);
            }}
            onTagsChange={onTagsChange}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
pnpm exec vitest run tests/unit/TagEditor.test.tsx
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/places/TagEditor.tsx components/ui/popover.tsx tests/unit/TagEditor.test.tsx
git commit -m "feat: add TagEditor component with inline and popover modes"
```

---

### Task 6: Update `PlaceListItem` to show tags

**Files:**
- Modify: `components/places/PlaceListItem.tsx`
- Modify: `tests/unit/PlaceListItem.test.tsx`

**Interfaces:**
- Consumes: `PlacePanelItem.tags: string[]` (from Task 4), `TagEditor` (from Task 5)

- [ ] **Step 1: Write failing tests for tag display**

Add to `tests/unit/PlaceListItem.test.tsx` (inside the existing `describe` block, after the last test):

```typescript
  it("renders tag pills when place has tags", () => {
    render(
      <PlaceListItem
        place={{ ...BASE, tags: ["coffee", "work"] }}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText("coffee")).toBeInTheDocument();
    expect(screen.getByText("work")).toBeInTheDocument();
  });

  it("renders no tag pills when place has empty tags", () => {
    render(<PlaceListItem place={{ ...BASE, tags: [] }} onEdit={noop} onDelete={noop} />);
    expect(screen.queryByLabelText(/edit tags/i)).toBeInTheDocument();
    expect(screen.queryByText("coffee")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
pnpm exec vitest run tests/unit/PlaceListItem.test.tsx
```

Expected: last 2 tests FAIL — tags not rendered yet.

- [ ] **Step 3: Update `PlaceListItem` to render `TagEditor`**

In `components/places/PlaceListItem.tsx`:

**3a.** Add import at the top (after the existing imports):

```typescript
import TagEditor from "@/components/places/TagEditor";
```

**3b.** In the JSX, after the `<p className="mt-0.5 text-xs text-muted-foreground">{visitsLabel}</p>` line, add:

```tsx
        <div
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="mt-1"
          role="presentation"
        >
          <TagEditor placeId={place.id} initialTags={place.tags} />
        </div>
```

The `stopPropagation` prevents clicking the tag editor from opening the place detail modal.

- [ ] **Step 4: Run all PlaceListItem tests**

```bash
pnpm exec vitest run tests/unit/PlaceListItem.test.tsx
```

Expected: all tests PASS (including the 2 new ones).

- [ ] **Step 5: Commit**

```bash
git add components/places/PlaceListItem.tsx tests/unit/PlaceListItem.test.tsx
git commit -m "feat: show tag pills and tag editor on place list items"
```

---

### Task 7: Update `PlaceDetailHeader` and `PlaceDetailModal` to show inline `TagEditor`

**Files:**
- Modify: `components/PlaceDetailHeader.tsx`
- Modify: `components/PlaceDetailModal.tsx`

**Interfaces:**
- Consumes: `PlaceData.tags?: string[]` (from Task 4), `TagEditor` (from Task 5)

- [ ] **Step 1: Update `PlaceDetailModal` to pass tags through to `placeInfo`**

In `components/PlaceDetailModal.tsx`, the `placeInfo` is initialized from `place` prop (which is `PlaceData`). Since `PlaceData` now has `tags?: string[]` and `PlacesPanel` spreads `PlacePanelItem` (which has `tags: string[]`) into the modal, tags will flow through automatically.

No changes needed to `PlaceDetailModal.tsx` — verify `placeInfo.tags` is available wherever `PlaceDetailHeader` receives `placeInfo`.

Confirm that `PlaceDetailModal` passes `placeInfo` to `PlaceDetailHeader`:
```
<PlaceDetailHeader placeInfo={placeInfo} ... />
```
This is the existing pattern — `placeInfo` is already passed. Since `PlaceData.tags` is now defined, it will be present.

- [ ] **Step 2: Add `TagEditor` to `PlaceDetailHeader`**

In `components/PlaceDetailHeader.tsx`:

**2a.** Add import at the top:

```typescript
import TagEditor from "@/components/places/TagEditor";
```

**2b.** In the non-editing view (inside the `<>` fragment after `</div>` for the name/inactive badge block), add a tags row after the radius/coordinates line:

```tsx
            <p className="mt-0.5 text-xs text-gray-400">
              Radius: {placeInfo.radius}m &middot; {placeInfo.lat.toFixed(5)}, {placeInfo.lon.toFixed(5)}
            </p>
            <div className="mt-2">
              <TagEditor
                placeId={placeInfo.id}
                initialTags={placeInfo.tags ?? []}
                inline
              />
            </div>
```

- [ ] **Step 3: Run lint and all unit tests**

```bash
pnpm exec eslint components/PlaceDetailHeader.tsx && pnpm test
```

Expected: no lint errors, all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add components/PlaceDetailHeader.tsx components/PlaceDetailModal.tsx
git commit -m "feat: add inline TagEditor to place detail header"
```

---

### Task 8: Update `PlacesToolbar` with tag autocomplete dropdown

**Files:**
- Modify: `components/places/PlacesToolbar.tsx`
- Create: `tests/unit/PlacesToolbar.test.tsx`

**Interfaces:**
- Consumes: `GET /api/tags?q=` (from Task 2)
- The toolbar becomes a client component with a `useQuery` for tag suggestions

- [ ] **Step 1: Write the failing test**

Create `tests/unit/PlacesToolbar.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlacesToolbar from "@/components/places/PlacesToolbar";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("PlacesToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  const noop = () => {};

  it("shows tag suggestions when user types and tags are available", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["coffee", "cafe"] }),
    } as Response);

    render(
      <PlacesToolbar query="" onQueryChange={noop} sort="recent" onSortChange={noop} count={3} />,
      { wrapper }
    );

    const input = screen.getByRole("combobox", { name: /search places/i });
    await user.type(input, "c");

    await waitFor(() => {
      expect(screen.getByText("coffee")).toBeInTheDocument();
      expect(screen.getByText("cafe")).toBeInTheDocument();
    });
  });

  it("calls onQueryChange with the tag name when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["coffee"] }),
    } as Response);

    render(
      <PlacesToolbar
        query="c"
        onQueryChange={onQueryChange}
        sort="recent"
        onSortChange={noop}
        count={3}
      />,
      { wrapper }
    );

    await waitFor(() => expect(screen.getByText("coffee")).toBeInTheDocument());
    await user.click(screen.getByText("coffee"));

    expect(onQueryChange).toHaveBeenCalledWith("coffee");
  });

  it("does not show the dropdown when query is empty", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: ["coffee"] }),
    } as Response);

    render(
      <PlacesToolbar query="" onQueryChange={noop} sort="recent" onSortChange={noop} count={0} />,
      { wrapper }
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("coffee")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run tests/unit/PlacesToolbar.test.tsx
```

Expected: FAIL — `getByRole('combobox')` not found (current input is type="text").

- [ ] **Step 3: Update `PlacesToolbar` with autocomplete**

Replace the contents of `components/places/PlacesToolbar.tsx` with:

```typescript
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useDebounce from "@/lib/useDebounce";

export type PlacesSort = "recent" | "visits" | "name" | "time_spent";

const SORT_LABELS: Record<PlacesSort, string> = {
  recent: "Recent activity",
  visits: "Most visits",
  name: "Name A–Z",
  time_spent: "Most time spent",
};

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
  const [focused, setFocused] = useState(false);
  const debouncedQuery = useDebounce(query, 200);

  const { data: tagSuggestions = [] } = useQuery<string[]>({
    queryKey: ["tags", "autocomplete", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.tags as string[];
    },
    enabled: focused && debouncedQuery.length > 0,
  });

  const showDropdown = focused && debouncedQuery.length > 0 && tagSuggestions.length > 0;

  return (
    <div className="flex flex-col gap-2 border-b px-3 py-2">
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={showDropdown}
          aria-label="Search places"
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search places…"
          className="h-9 w-full text-base md:h-8 md:text-xs"
        />
        {showDropdown && (
          <ul
            role="listbox"
            className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md"
          >
            <li className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Tags
            </li>
            {tagSuggestions.map((tag) => (
              <li key={tag} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onQueryChange(tag);
                    setFocused(false);
                  }}
                  className="w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="order-last text-[11px] text-muted-foreground md:order-0">
          {count} {count === 1 ? "place" : "places"}
        </p>
        <Select
          value={sort}
          onValueChange={(v) => onSortChange(v as PlacesSort)}
        >
          <SelectTrigger
            size="sm"
            className="h-8 w-full justify-between text-xs md:w-fit"
            aria-label="Sort places"
          >
            <SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} sideOffset={4}>
            <SelectItem value="recent">Recent activity</SelectItem>
            <SelectItem value="visits">Most visits</SelectItem>
            <SelectItem value="time_spent">Most time spent</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `lib/useDebounce.ts`** (shared hook, extracted from TagEditor)

```typescript
import { useState, useEffect } from "react";

export default function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
```

Then update `components/places/TagEditor.tsx` to import from `@/lib/useDebounce` instead of defining `useDebounce` inline. Replace the inline `useDebounce` function and its usage:

```typescript
import useDebounce from "@/lib/useDebounce";
```

And remove the local `useDebounce` function definition.

- [ ] **Step 5: Run tests**

```bash
pnpm exec vitest run tests/unit/PlacesToolbar.test.tsx tests/unit/TagEditor.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/places/PlacesToolbar.tsx lib/useDebounce.ts components/places/TagEditor.tsx tests/unit/PlacesToolbar.test.tsx
git commit -m "feat: add tag autocomplete dropdown to places search toolbar"
```

---

### Task 9: E2E test — add tag, search by tag

**Files:**
- Create: `tests/e2e/place-tags.spec.ts`

**Interfaces:**
- Requires a running app with at least one place in the database

- [ ] **Step 1: Write the E2E test**

Create `tests/e2e/place-tags.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("place tags: add a tag from the list and search by it", async ({ page }) => {
  await page.goto("/timeline");

  await page.getByRole("button", { name: "Places" }).first().click();

  const emptyState = page.getByText("No places yet");
  if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
    test.skip();
    return;
  }

  const search = page.getByRole("combobox", { name: "Search places" });
  await expect(search).toBeVisible();

  // Hover first row to reveal action area, then click the tag button
  const firstRow = page.locator('ul li div[role="button"]').first();
  await firstRow.hover();

  // Click the "Edit tags" / tag button to open the popover
  const tagButton = page.getByRole("button", { name: /edit tags|tag/i }).first();
  await tagButton.click();

  // Type a unique tag name
  const tagInput = page.getByRole("textbox", { name: "Add tag" });
  await expect(tagInput).toBeVisible();
  await tagInput.fill("e2etest-tag");
  await tagInput.press("Enter");

  // The tag pill should appear
  await expect(page.getByText("e2etest-tag").first()).toBeVisible({ timeout: 3000 });

  // Close the popover by pressing Escape
  await page.keyboard.press("Escape");

  // Search by the tag name
  await search.fill("e2etest-tag");

  // The place with that tag should appear in results
  await expect(page.locator('ul li').first()).toBeVisible({ timeout: 3000 });

  // Clean up: reopen tag editor and remove the tag
  const firstRowAfterSearch = page.locator('ul li div[role="button"]').first();
  await firstRowAfterSearch.hover();
  const tagButtonAfter = page.getByRole("button", { name: /edit tags|tag/i }).first();
  await tagButtonAfter.click();
  const removeButton = page.getByRole("button", { name: /remove e2etest-tag/i });
  await removeButton.click();
  await expect(page.getByText("e2etest-tag")).not.toBeVisible({ timeout: 3000 });
});
```

- [ ] **Step 2: Run the E2E test**

Start the dev server first (in a separate terminal):
```bash
pnpm dev
```

Then run:
```bash
pnpm exec playwright test tests/e2e/place-tags.spec.ts
```

Expected: test PASS (or skip if no places seeded). If it fails due to timing, increase timeouts.

- [ ] **Step 3: Run all tests to confirm no regressions**

```bash
pnpm test
```

Expected: all unit tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/place-tags.spec.ts
git commit -m "test: add e2e test for place tag add and search"
```
