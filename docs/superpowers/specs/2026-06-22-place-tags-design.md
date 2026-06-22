# Place Tags Design

**Date:** 2026-06-22  
**Status:** Approved

## Overview

Add free-form tag support to places. Users can label places with arbitrary tags (e.g. "coffee", "work", "weekend"), search/filter places by tag via the existing search bar with autocomplete, and manage tags both inline in the places list and inside the place detail modal.

---

## Data Model

Two new Prisma models added to `prisma/schema.prisma`:

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

`Place` gets a `tags PlaceTag[]` relation added.

**Key decisions:**
- `onDelete: Cascade` on `PlaceTag` — deleting a place removes its associations automatically
- Tags are never auto-deleted; orphaned tags remain available in autocomplete for future use
- Tag names are unique (case-sensitive at DB level; normalized to lowercase on write)

---

## API

### `GET /api/places` — extended

- Each place in the response now includes `tags: string[]` (array of tag names)
- The `q` query param matches against both place name and tag names:

```sql
WHERE LOWER(p.name) LIKE '%q%'
   OR EXISTS (
     SELECT 1 FROM "PlaceTag" pt
     JOIN "Tag" t ON t.id = pt."tagId"
     WHERE pt."placeId" = p.id AND LOWER(t.name) LIKE '%q%'
   )
```

### `GET /api/tags?q=` — new

- Returns up to 10 tag names matching the query string
- Ordered by usage count descending (most-used tags first)
- Used by the search bar autocomplete and the `TagEditor` component
- Response: `{ tags: string[] }`

### `PUT /api/places/:id/tags` — new

- Body: `{ tags: string[] }` (full desired tag list, normalized to lowercase)
- Upserts tag rows by name, then replaces all `PlaceTag` rows for this place atomically in a transaction
- Handles add, remove, and reorder in a single call
- Response: `{ tags: string[] }` (the saved tag names)

---

## UI

### Shared: `TagEditor` component

A single reusable component (`components/places/TagEditor.tsx`) used in two contexts:

**Props:**
- `placeId: number`
- `initialTags: string[]`
- `onTagsChange?: (tags: string[]) => void`
- `inline?: boolean` — when `true`, renders expanded; when `false` (default), triggered via a popover

**Behavior:**
- Shows existing tags as removable pills (× button on each)
- Text input with 200ms debounced autocomplete against `GET /api/tags?q=`
- Autocomplete dropdown shows up to 10 matching tags not already applied
- Enter or clicking a suggestion adds the tag; calls `PUT /api/places/:id/tags`
- Tags normalized to lowercase on add

### `PlaceListItem.tsx` — updated

- Tag pills rendered below the place name
- A small "+ tag" button at the end of the pills row opens `<TagEditor inline={false} />` in a popover
- Clicking an existing pill also opens the popover (for editing)
- Pills are display-only when the popover is closed

### `PlaceDetailHeader.tsx` — updated

- New "Tags" row in the header section
- Renders `<TagEditor inline={true} />` directly (no popover needed, more space available)

### `PlacesToolbar.tsx` — updated

- As the user types, a dropdown appears below the search input with two sections:
  - **Places** — matching place names (existing behavior, from React Query cache)
  - **Tags** — matching tag names from `GET /api/tags?q=`
- Selecting a tag sets the search query to that tag name, which filters via the updated `GET /api/places?q=` endpoint
- Existing 300ms debounce and React Query invalidation flow unchanged
- If the input is empty, no dropdown is shown

---

## Testing

- **Unit tests (vitest):** `TagEditor` component — add tag, remove tag, autocomplete suggestions, duplicate prevention, lowercase normalization
- **Unit tests (vitest):** `GET /api/tags` route — returns matches ordered by usage count
- **Unit tests (vitest):** `PUT /api/places/:id/tags` route — upsert, replace, cascade behavior
- **Unit tests (vitest):** `GET /api/places` route — `q` param matches tags as well as names
- **E2E tests (Playwright):** Add a tag to a place from the list, verify it appears; search by that tag name, verify the place appears in results

---

## Out of Scope

- Tag rename / merge UI (orphaned tags can be cleaned up manually or via future feature)
- Tag colors
- Tagging visits (only places for now)
- Bulk tag operations
