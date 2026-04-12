import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { GET } from "@/app/api/locations/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;
const queryRaw = prisma.$queryRaw as unknown as MockFn;

function req(params: Record<string, string>) {
  const usp = new URLSearchParams(params);
  return new Request(`http://localhost/api/locations?${usp.toString()}`);
}

const BOUNDS = {
  start: "2026-04-12T00:00:00.000Z",
  end: "2026-04-12T23:59:59.999Z",
  minLat: "10",
  maxLat: "20",
  minLon: "30",
  maxLon: "40",
};

describe("GET /api/locations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when start is missing", async () => {
    const { start: _s, ...rest } = BOUNDS;
    const res = await GET(req(rest));
    expect(res.status).toBe(400);
  });

  it("returns 400 when viewport bounds are missing", async () => {
    const { minLat: _a, ...rest } = BOUNDS;
    const res = await GET(req(rest));
    expect(res.status).toBe(400);
  });

  it("returns 400 on non-numeric bounds", async () => {
    const res = await GET(req({ ...BOUNDS, minLat: "nope" }));
    expect(res.status).toBe(400);
  });

  it("paginates when count is under the threshold", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(5000) }])
      .mockResolvedValueOnce([
        { id: 101, lat: 11, lon: 31, tst: 1, recordedAt: new Date("2026-04-12T01:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null },
        { id: 102, lat: 12, lon: 32, tst: 2, recordedAt: new Date("2026-04-12T02:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null },
      ]);

    const res = await GET(req({ ...BOUNDS, limit: "2" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.decimated).toBe(false);
    expect(body.boundsIgnored).toBe(false);
    expect(body.total).toBe(5000);
    expect(body.points).toHaveLength(2);
    expect(body.nextCursor).toBe("2:102");
    expect(body.points[0].recordedAt).toBe("2026-04-12T01:00:00.000Z");
  });

  it("sets nextCursor=null when page is under the limit", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(10) }])
      .mockResolvedValueOnce([
        { id: 1, lat: 11, lon: 31, tst: 1, recordedAt: new Date("2026-04-12T01:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null },
      ]);

    const res = await GET(req({ ...BOUNDS, limit: "100" }));
    const body = await res.json();
    expect(body.nextCursor).toBeNull();
    expect(body.boundsIgnored).toBe(false);
  });

  it("decimates when count exceeds threshold", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(100000) }])
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

    const res = await GET(req(BOUNDS));
    const body = await res.json();

    expect(body.decimated).toBe(true);
    expect(body.boundsIgnored).toBe(false);
    expect(body.nextCursor).toBeNull();
    expect(body.total).toBe(100000);
    expect(body.points.length).toBeLessThanOrEqual(20000);
  });

  it("passes cursor into the pagination query", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(100) }])
      .mockResolvedValueOnce([]);

    await GET(req({ ...BOUNDS, cursor: "42:500" }));

    const pageCallArgs = queryRaw.mock.calls[1];
    const text = JSON.stringify(pageCallArgs);
    expect(text).toContain("500");
    expect(text).toContain("42");
  });

  it("clamps limit to MAX_PAGE_LIMIT", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(100) }])
      .mockResolvedValueOnce([]);

    const res = await GET(req({ ...BOUNDS, limit: "99999" }));
    expect(res.status).toBe(200);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

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
});
