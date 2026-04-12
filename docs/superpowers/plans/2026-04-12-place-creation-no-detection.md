# Place Creation No-Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /api/places` no longer runs `detectVisitsForPlace` on the newly created place. The `supersedesVisitId` transplant flow is preserved.

**Architecture:** Single-file API change plus test updates. Remove the detection call and drop `newVisits` from the response body. No frontend consumer currently reads `newVisits` from this endpoint, so no UI change is required.

**Tech Stack:** Next.js App Router, Prisma, Vitest.

---

## File Structure

- Modify: `app/api/places/route.ts` — remove the `detectVisitsForPlace` call and drop `newVisits` from the response.
- Modify: `tests/unit/api-places-post-supersede.test.ts` — drop the ordering test (detection no longer runs) and add a test asserting detection is NOT called on plain creation.

No new files. No frontend changes (verified: `components/PlaceCreationModal.tsx:37` and `components/CreateVisitModal.tsx:166` both destructure only `{ place }`).

---

## Task 1: Add failing test — detection is not called on plain place creation

**Files:**
- Modify: `tests/unit/api-places-post-supersede.test.ts`

- [ ] **Step 1: Add a new `it` block to the existing describe**

Append this test inside the `describe("POST /api/places — supersedesVisitId", ...)` block in `tests/unit/api-places-post-supersede.test.ts`:

```typescript
  it("does not invoke detectVisitsForPlace when creating a place without supersedesVisitId", async () => {
    await POST(
      makeRequest({ name: "Home", lat: 10, lon: 20, radius: 50 }),
    );

    expect(detectVisitsForPlace).not.toHaveBeenCalled();
  });

  it("does not include newVisits in the response body on plain creation", async () => {
    const res = await POST(
      makeRequest({ name: "Home", lat: 10, lon: 20, radius: 50 }),
    );
    const body = await res.json();

    expect(body).toEqual({ place: NEW_PLACE });
  });
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `pnpm exec vitest run tests/unit/api-places-post-supersede.test.ts`

Expected: the two new tests FAIL. The first fails because `detectVisitsForPlace` is called. The second fails because the response includes `newVisits`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/unit/api-places-post-supersede.test.ts
git commit -m "test: assert place creation does not trigger detection"
```

---

## Task 2: Remove auto-detection from POST /api/places

**Files:**
- Modify: `app/api/places/route.ts:175-177`

- [ ] **Step 1: Remove the detection call and drop `newVisits` from the response**

In `app/api/places/route.ts`, replace lines 175–177:

```typescript
  const newVisits = await detectVisitsForPlace(place.id);

  return NextResponse.json({ place, newVisits }, { status: 201 });
}
```

with:

```typescript
  return NextResponse.json({ place }, { status: 201 });
}
```

- [ ] **Step 2: Remove the now-unused import**

In `app/api/places/route.ts`, delete line 3:

```typescript
import { detectVisitsForPlace } from "@/lib/detectVisits";
```

- [ ] **Step 3: Run the test file and confirm all non-ordering tests pass**

Run: `pnpm exec vitest run tests/unit/api-places-post-supersede.test.ts`

Expected: the two new tests from Task 1 now PASS. The existing "transplants before running detection" ordering test will FAIL because detection no longer runs — that is expected and fixed in Task 3.

- [ ] **Step 4: Run eslint on the file**

Run: `pnpm exec eslint app/api/places/route.ts`

Expected: no errors.

- [ ] **Step 5: Commit the implementation change**

```bash
git add app/api/places/route.ts
git commit -m "feat: stop auto-detecting visits on place creation"
```

---

## Task 3: Remove the obsolete ordering test

**Files:**
- Modify: `tests/unit/api-places-post-supersede.test.ts`

The ordering test (`"transplants before running detection, so overlapping candidates are suppressed by the same-place guard"`, currently lines 74–103) asserts that `visit.create` runs before `detectVisitsForPlace`. Since detection is no longer called, this test is obsolete and currently failing.

- [ ] **Step 1: Delete the ordering test**

In `tests/unit/api-places-post-supersede.test.ts`, delete the entire `it("transplants before running detection, ...", ...)` block (lines 74–103 in the original file).

- [ ] **Step 2: Remove the `detectVisitsForPlace` mock setup from `beforeEach`**

In the `beforeEach` block, remove this line:

```typescript
    (detectVisitsForPlace as unknown as MockFn).mockResolvedValue(0);
```

The `vi.mock("@/lib/detectVisits", ...)` call and the `import { detectVisitsForPlace }` are still needed — they back the `expect(detectVisitsForPlace).not.toHaveBeenCalled()` assertion added in Task 1.

- [ ] **Step 3: Run the full test file**

Run: `pnpm exec vitest run tests/unit/api-places-post-supersede.test.ts`

Expected: all tests PASS. Remaining tests should be:
- "transplants the superseded visit as a confirmed visit at the new place and deletes the original"
- "leaves all visits alone when supersedesVisitId is not provided"
- "does not invoke detectVisitsForPlace when creating a place without supersedesVisitId"
- "does not include newVisits in the response body on plain creation"

- [ ] **Step 4: Commit**

```bash
git add tests/unit/api-places-post-supersede.test.ts
git commit -m "test: remove obsolete detection-ordering test"
```

---

## Task 4: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `pnpm exec vitest run`

Expected: all tests pass.

- [ ] **Step 2: Run eslint on the whole project**

Run: `pnpm exec eslint .`

Expected: no new errors introduced by this change.

- [ ] **Step 3: Verify no caller of `POST /api/places` still expects `newVisits`**

Run: `pnpm exec grep -rn "newVisits" app components` (or use your editor's search)

Expected: any matches in `app/timeline/layout.tsx` are for `/api/visits/detect` (unrelated). There should be no remaining reference to `newVisits` from a `/api/places` response.

If the verification passes, the change is complete. No further commits required.
