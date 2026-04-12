# skipBoundsIfSmall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `skipBoundsIfSmall` query param to `GET /api/locations` that, when true, omits the viewport bbox filter when the total point count for the time range fits under `DECIMATION_THRESHOLD`. Wire the frontend to always send it.

**Architecture:** Inside the existing route handler, branch on the new flag. On the unbounded branch, count with the time range alone and — if under the threshold — query points with no bbox predicate (pagination unchanged). Otherwise fall through to the current bounded code path. Add one new response field, `boundsIgnored`, so tests and future debugging can tell the branches apart.

**Tech Stack:** Next.js App Router (`app/api/locations/route.ts`), Prisma raw SQL (`Prisma.sql`), React Query on the frontend (`components/map/MapWrapper.tsx`), vitest for unit tests.

**Spec:** [docs/superpowers/specs/2026-04-12-skip-bounds-if-small-design.md](../specs/2026-04-12-skip-bounds-if-small-design.md)

---

## File structure

- Modify: `app/api/locations/route.ts` — parse new flag, branch between unbounded and bounded paths, add `boundsIgnored` to response.
- Modify: `tests/unit/api-locations-route.test.ts` — add coverage for the new behaviour and assert the existing behaviour still holds (response now includes `boundsIgnored: false` on every legacy case).
- Modify: `components/map/MapWrapper.tsx` — include `skipBoundsIfSmall=true` in the `/api/locations` request.

No new files. The route is 148 lines today; adding the branch keeps it under the project's 300-line limit. If it grows past ~250 lines, the engineer may extract `runBoundedQuery` and `runUnboundedQuery` helpers into `lib/locations.ts`, but that is not required.

---

### Task 1: Lock in legacy `boundsIgnored: false` on existing tests (failing tests)

**Files:**
- Modify: `tests/unit/api-locations-route.test.ts`

- [ ] **Step 1: Add `boundsIgnored: false` expectations to the three existing happy-path tests**

In `tests/unit/api-locations-route.test.ts`, update the three tests below to assert the new field. The other tests (400 cases, cursor pass-through, limit clamp) do not need changes.

Change the "paginates when count is under the threshold" test to add one line after `expect(body.decimated).toBe(false);`:

```ts
    expect(body.decimated).toBe(false);
    expect(body.boundsIgnored).toBe(false);
```

Change the "sets nextCursor=null when page is under the limit" test to add `boundsIgnored` after the existing `nextCursor` assertion:

```ts
    expect(body.nextCursor).toBeNull();
    expect(body.boundsIgnored).toBe(false);
```

Change the "decimates when count exceeds threshold" test to add `boundsIgnored` alongside `decimated`:

```ts
    expect(body.decimated).toBe(true);
    expect(body.boundsIgnored).toBe(false);
```

- [ ] **Step 2: Run the test file and verify exactly those three tests fail**

Run: `pnpm exec vitest run tests/unit/api-locations-route.test.ts`

Expected: 3 failures, all of the form `expected undefined to be false` on the `boundsIgnored` assertions. Other tests still pass.

- [ ] **Step 3: Do NOT commit yet**

These tests will stay red until Task 3 adds the field. Leave them red for now so the red→green transition is visible.

---

### Task 2: Add tests for the new `skipBoundsIfSmall` branch (failing tests)

**Files:**
- Modify: `tests/unit/api-locations-route.test.ts`

- [ ] **Step 1: Append four new tests to the `describe` block**

Add these tests at the end of the `describe("GET /api/locations", ...)` block, immediately before the final closing `});`:

```ts
  it("ignores bbox when skipBoundsIfSmall=true and time-range count fits", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(5000) }])
      .mockResolvedValueOnce([
        { id: 1, lat: 99, lon: 99, tst: 1, recordedAt: new Date("2026-04-12T01:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null },
      ]);

    const res = await GET(req({ ...BOUNDS, skipBoundsIfSmall: "true" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.boundsIgnored).toBe(true);
    expect(body.decimated).toBe(false);
    expect(body.total).toBe(5000);

    const countSql = JSON.stringify(queryRaw.mock.calls[0]);
    expect(countSql).not.toContain("lat BETWEEN");
    expect(countSql).not.toContain("lon BETWEEN");

    const pageSql = JSON.stringify(queryRaw.mock.calls[1]);
    expect(pageSql).not.toContain("lat BETWEEN");
    expect(pageSql).not.toContain("lon BETWEEN");
  });

  it("falls back to bounded flow when skipBoundsIfSmall=true but time-range count exceeds threshold", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(100000) }])
      .mockResolvedValueOnce([{ total: BigInt(50000) }])
      .mockResolvedValueOnce(
        Array.from({ length: 20000 }, (_, i) => ({
          id: i + 1,
          lat: 11,
          lon: 31,
          tst: i,
          recordedAt: new Date("2026-04-12T01:00:00Z"),
          acc: null,
          batt: null,
          tid: null,
          alt: null,
          vel: null,
        })),
      );

    const res = await GET(req({ ...BOUNDS, skipBoundsIfSmall: "true" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.boundsIgnored).toBe(false);
    expect(body.decimated).toBe(true);
    expect(body.total).toBe(50000);

    const boundedCountSql = JSON.stringify(queryRaw.mock.calls[1]);
    expect(boundedCountSql).toContain("lat BETWEEN");
    expect(boundedCountSql).toContain("lon BETWEEN");
  });

  it("keeps bbox when skipBoundsIfSmall is absent (default)", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(100) }])
      .mockResolvedValueOnce([]);

    const res = await GET(req(BOUNDS));
    const body = await res.json();

    expect(body.boundsIgnored).toBe(false);

    const countSql = JSON.stringify(queryRaw.mock.calls[0]);
    expect(countSql).toContain("lat BETWEEN");
    expect(countSql).toContain("lon BETWEEN");
  });

  it("passes cursor into the unbounded pagination query", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(100) }])
      .mockResolvedValueOnce([]);

    await GET(req({ ...BOUNDS, skipBoundsIfSmall: "true", cursor: "42:500" }));

    const pageCallArgs = queryRaw.mock.calls[1];
    const text = JSON.stringify(pageCallArgs);
    expect(text).toContain("500");
    expect(text).toContain("42");
    expect(text).not.toContain("lat BETWEEN");
  });
```

- [ ] **Step 2: Run the test file and verify the new tests fail**

Run: `pnpm exec vitest run tests/unit/api-locations-route.test.ts`

Expected: the 3 tests from Task 1 still fail on `boundsIgnored`, plus the 4 new tests fail. Total ~7 failures. The failures are about missing `boundsIgnored` / `lat BETWEEN` still present in the SQL.

- [ ] **Step 3: Do NOT commit yet**

Red tests stay red until Task 3. Commit happens in Task 4 alongside the implementation.

---

### Task 3: Implement the `skipBoundsIfSmall` branch in the route

**Files:**
- Modify: `app/api/locations/route.ts`

- [ ] **Step 1: Add a boolean parser**

In `app/api/locations/route.ts`, below the existing `parseCursor` helper (around line 47), add:

```ts
function parseBool(raw: string | null): boolean {
  return raw === "true" || raw === "1";
}
```

- [ ] **Step 2: Replace the route body with the branched implementation**

Replace the body of `export async function GET(request: Request)` (everything from line 54 through the end of the function — i.e. up to and including the final closing `}` of `GET`, right before `function serializeRow`) with:

```ts
  const { searchParams } = new URL(request.url);

  const start = parseDate(parseRequired(searchParams, "start"));
  const end = parseDate(parseRequired(searchParams, "end"));
  const minLat = parseNumber(parseRequired(searchParams, "minLat"));
  const maxLat = parseNumber(parseRequired(searchParams, "maxLat"));
  const minLon = parseNumber(parseRequired(searchParams, "minLon"));
  const maxLon = parseNumber(parseRequired(searchParams, "maxLon"));

  if (!start || !end || minLat === null || maxLat === null || minLon === null || maxLon === null) {
    return NextResponse.json(
      { error: "Missing or invalid required params: start, end, minLat, maxLat, minLon, maxLon" },
      { status: 400 },
    );
  }

  const limitRaw = parseNumber(searchParams.get("limit"));
  const limit = Math.max(
    1,
    Math.min(MAX_PAGE_LIMIT, limitRaw ?? DEFAULT_PAGE_LIMIT),
  );
  const cursor = parseCursor(searchParams.get("cursor"));
  const skipBoundsIfSmall = parseBool(searchParams.get("skipBoundsIfSmall"));

  const selectCols = Prisma.sql`id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel`;
  const cursorClause = cursor
    ? Prisma.sql`AND (tst, id) > (${cursor.tst}, ${cursor.id})`
    : Prisma.empty;

  if (skipBoundsIfSmall) {
    const timeWhere = Prisma.sql`"recordedAt" BETWEEN ${start} AND ${end}`;

    const timeCountRows = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total
      FROM "LocationPoint"
      WHERE ${timeWhere};
    `;
    const timeTotal = Number(timeCountRows[0]?.total ?? BigInt(0));

    if (timeTotal <= DECIMATION_THRESHOLD) {
      const rows = await prisma.$queryRaw<PointRow[]>`
        SELECT ${selectCols}
        FROM "LocationPoint"
        WHERE ${timeWhere}
        ${cursorClause}
        ORDER BY tst, id
        LIMIT ${limit};
      `;

      const nextCursor = rows.length === limit ? encodeCursor(rows[rows.length - 1]) : null;

      return NextResponse.json({
        points: rows.map(serializeRow),
        nextCursor,
        decimated: false,
        boundsIgnored: true,
        total: timeTotal,
      });
    }
  }

  const where = Prisma.sql`
    "recordedAt" BETWEEN ${start} AND ${end}
    AND lat BETWEEN ${minLat} AND ${maxLat}
    AND lon BETWEEN ${minLon} AND ${maxLon}
  `;

  const countRows = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*)::bigint AS total
    FROM "LocationPoint"
    WHERE ${where};
  `;
  const total = Number(countRows[0]?.total ?? BigInt(0));

  if (total > DECIMATION_THRESHOLD) {
    const stride = Math.ceil(total / DECIMATION_THRESHOLD);
    const rows = await prisma.$queryRaw<PointRow[]>`
      SELECT ${selectCols}
      FROM (
        SELECT ${selectCols}, ROW_NUMBER() OVER (ORDER BY tst) AS rn
        FROM "LocationPoint"
        WHERE ${where}
      ) AS sub
      WHERE (rn - 1) % ${stride} = 0
      ORDER BY tst;
    `;

    return NextResponse.json({
      points: rows.map(serializeRow),
      nextCursor: null,
      decimated: true,
      boundsIgnored: false,
      total,
    });
  }

  const rows = await prisma.$queryRaw<PointRow[]>`
    SELECT ${selectCols}
    FROM "LocationPoint"
    WHERE ${where}
    ${cursorClause}
    ORDER BY tst, id
    LIMIT ${limit};
  `;

  const nextCursor = rows.length === limit ? encodeCursor(rows[rows.length - 1]) : null;

  return NextResponse.json({
    points: rows.map(serializeRow),
    nextCursor,
    decimated: false,
    boundsIgnored: false,
    total,
  });
}
```

- [ ] **Step 3: Run the route's tests and verify they pass**

Run: `pnpm exec vitest run tests/unit/api-locations-route.test.ts`

Expected: all tests pass (both the updated legacy tests from Task 1 and the four new tests from Task 2).

- [ ] **Step 4: Lint the route file**

Run: `pnpm exec eslint app/api/locations/route.ts tests/unit/api-locations-route.test.ts`

Expected: no errors.

---

### Task 4: Commit API + tests

**Files:**
- Commit: `app/api/locations/route.ts`, `tests/unit/api-locations-route.test.ts`

- [ ] **Step 1: Commit**

```bash
git add app/api/locations/route.ts tests/unit/api-locations-route.test.ts
git commit -m "feat(api): add skipBoundsIfSmall flag to locations route"
```

---

### Task 5: Send `skipBoundsIfSmall=true` from the map

**Files:**
- Modify: `components/map/MapWrapper.tsx` (the locations `queryFn` around line 95)

- [ ] **Step 1: Add the flag to the URLSearchParams**

In `components/map/MapWrapper.tsx`, find the `URLSearchParams` constructor inside the locations `queryFn` (around line 96-103) and add `skipBoundsIfSmall: "true"` to it:

```ts
      const params = new URLSearchParams({
        start: rangeStart!,
        end: rangeEnd!,
        minLat: String(mapBounds!.minLat),
        maxLat: String(mapBounds!.maxLat),
        minLon: String(mapBounds!.minLon),
        maxLon: String(mapBounds!.maxLon),
        skipBoundsIfSmall: "true",
      });
```

Leave the rest of the `queryFn` (cursor handling, fetch call) unchanged.

- [ ] **Step 2: Lint**

Run: `pnpm exec eslint components/map/MapWrapper.tsx`

Expected: no errors.

- [ ] **Step 3: Run the full unit test suite to catch regressions**

Run: `pnpm exec vitest run`

Expected: all tests pass.

- [ ] **Step 4: Manually verify the dev server responds correctly**

Start the dev server (if not already running): `pnpm dev`

In a second terminal, hit the endpoint with the new flag. Replace `<start>` and `<end>` with a small range that you know has few points:

```bash
curl -s "http://localhost:3000/api/locations?start=2026-04-12T00:00:00.000Z&end=2026-04-12T23:59:59.999Z&minLat=0&maxLat=1&minLon=0&maxLon=1&skipBoundsIfSmall=true" | jq '{ total, boundsIgnored, decimated, points: (.points|length) }'
```

Expected when the day has fewer than 20k points: `boundsIgnored: true`, `points` may exceed what the (0,1)×(0,1) bbox would have contained.

Without the flag (default behaviour):

```bash
curl -s "http://localhost:3000/api/locations?start=2026-04-12T00:00:00.000Z&end=2026-04-12T23:59:59.999Z&minLat=0&maxLat=1&minLon=0&maxLon=1" | jq '{ total, boundsIgnored, decimated, points: (.points|length) }'
```

Expected: `boundsIgnored: false`, point count consistent with the tight bbox.

Open the map in the browser, pan/zoom within a small time range, and confirm the point count stays stable as the viewport moves.

- [ ] **Step 5: Commit**

```bash
git add components/map/MapWrapper.tsx
git commit -m "feat(map): request unbounded points when range fits"
```

---

## Self-Review

- **Spec coverage:** API change (new param, `boundsIgnored` field, branch behaviour) → Tasks 1–4. Frontend change (always send `true`) → Task 5. Tests for all three branches (unbounded small, unbounded→fallback, default) → Task 2. Pagination on the unbounded branch → Task 2 (cursor test). Decimation only in the bounded fallback → naturally preserved (unbounded branch has no decimation code path). All sections of the spec are covered.
- **No placeholders:** every step has concrete code, exact paths, and runnable commands.
- **Type consistency:** `parseBool`, `timeWhere`, `where`, `cursorClause`, `selectCols`, `boundsIgnored` are defined and used consistently. Response shape matches the spec (`points`, `nextCursor`, `decimated`, `boundsIgnored`, `total`).
