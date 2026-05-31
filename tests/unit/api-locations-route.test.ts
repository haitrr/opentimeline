import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn(), deviceFilter: { findMany: vi.fn() } },
}));

import { GET } from "@/app/api/locations/route";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;
const queryRaw = prisma.$queryRaw as unknown as MockFn;
const filterFindMany = prisma.deviceFilter.findMany as unknown as MockFn;

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
    filterFindMany.mockResolvedValue([]);
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

  it("returns all matching points in one response when under threshold", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(2), total_km: 0 }])
      .mockResolvedValueOnce([
        { id: 101, lat: 11, lon: 31, tst: 1, recordedAt: new Date("2026-04-12T01:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null },
        { id: 102, lat: 12, lon: 32, tst: 2, recordedAt: new Date("2026-04-12T02:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null },
      ]);

    const res = await GET(req(BOUNDS));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.decimated).toBe(false);
    expect(body.boundsIgnored).toBe(false);
    expect(body.total).toBe(2);
    expect(body.points).toHaveLength(2);
    expect(body.points[0].recordedAt).toBe("2026-04-12T01:00:00.000Z");
  });

  it("uses distance-bucket sampling when count exceeds threshold and trajectory has length", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(100000) }])
      .mockResolvedValueOnce([{ total_km: 500 }])
      .mockResolvedValueOnce(
        Array.from({ length: 20000 }, (_, i) => ({
          id: i + 1,
          lat: 11 + i * 0.0001,
          lon: 31 + i * 0.0001,
          tst: i,
          recordedAt: new Date("2026-04-12T01:00:00Z"),
          acc: null,
          batt: null,
          tid: null,
          alt: null,
          vel: null,
          deviceId: null,
        })),
      );

    const res = await GET(req(BOUNDS));
    const body = await res.json();

    expect(body.decimated).toBe(true);
    expect(body.boundsIgnored).toBe(false);
    expect(body.total).toBe(100000);
    expect(body.points.length).toBeLessThanOrEqual(20000);

    const countSql = JSON.stringify(queryRaw.mock.calls[0]);
    expect(countSql).not.toContain("total_km");

    const distSql = JSON.stringify(queryRaw.mock.calls[1]);
    expect(distSql).toContain("total_km");

    const sampleSql = JSON.stringify(queryRaw.mock.calls[2]);
    expect(sampleSql).toContain("cum_km");
    expect(sampleSql).toContain("bucket");
    expect(sampleSql).not.toContain("ROW_NUMBER");
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
      .mockResolvedValueOnce([{ total_km: 100 }])
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
          deviceId: null,
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
      .mockResolvedValueOnce([{ total: BigInt(100), total_km: 1 }])
      .mockResolvedValueOnce([]);

    const res = await GET(req(BOUNDS));
    const body = await res.json();

    expect(body.boundsIgnored).toBe(false);

    const countSql = JSON.stringify(queryRaw.mock.calls[0]);
    expect(countSql).toContain("lat BETWEEN");
    expect(countSql).toContain("lon BETWEEN");
  });

  it("splits count from distance query for bounded datasets over threshold", async () => {
    const rows = Array.from({ length: 20000 }, (_, i) => ({
      id: i + 1, lat: 11 + i * 0.0001, lon: 31 + i * 0.0001, tst: i,
      recordedAt: new Date("2026-04-12T01:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null, deviceId: null,
    }));
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(100000) }])  // 1: cheap count, no haversine
      .mockResolvedValueOnce([{ total_km: 500 }])           // 2: distance only
      .mockResolvedValueOnce(rows);                         // 3: decimated rows

    const res = await GET(req(BOUNDS));
    const body = await res.json();

    expect(body.decimated).toBe(true);
    expect(body.total).toBe(100000);

    const cheapCountSql = JSON.stringify(queryRaw.mock.calls[0]);
    expect(cheapCountSql).not.toContain("total_km");
    expect(cheapCountSql).not.toContain("asin");

    const distanceSql = JSON.stringify(queryRaw.mock.calls[1]);
    expect(distanceSql).toContain("total_km");
    expect(distanceSql).not.toContain("cum_km");

    const decimateSql = JSON.stringify(queryRaw.mock.calls[2]);
    expect(decimateSql).toContain("cum_km");
  });

  it("skips distance query when bounded count is under threshold", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(2) }])
      .mockResolvedValueOnce([
        { id: 101, lat: 11, lon: 31, tst: 1, recordedAt: new Date("2026-04-12T01:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null, deviceId: null },
      ]);

    const res = await GET(req(BOUNDS));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.decimated).toBe(false);
    expect(body.total).toBe(2);
    expect(queryRaw).toHaveBeenCalledTimes(2); // count + fetch, no distance query

    const countSql = JSON.stringify(queryRaw.mock.calls[0]);
    expect(countSql).not.toContain("total_km");
  });

  it("returns up to 50k points unbounded when skipBoundsIfSmall is true", async () => {
    const rows = Array.from({ length: 30000 }, (_, i) => ({
      id: i + 1, lat: 11, lon: 31, tst: i,
      recordedAt: new Date("2026-04-12T01:00:00Z"), acc: null, batt: null, tid: null, alt: null, vel: null, deviceId: null,
    }));
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(30000) }])
      .mockResolvedValueOnce(rows);

    const res = await GET(req({ ...BOUNDS, skipBoundsIfSmall: "true" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.boundsIgnored).toBe(true);
    expect(body.decimated).toBe(false);
    expect(body.total).toBe(30000);
    expect(body.points.length).toBe(30000);

    const fetchSql = JSON.stringify(queryRaw.mock.calls[1]);
    expect(fetchSql).not.toContain("lat BETWEEN");
  });

  it("falls back to stride sampling when trajectory is stationary", async () => {
    queryRaw
      .mockResolvedValueOnce([{ total: BigInt(100000) }])
      .mockResolvedValueOnce([{ total_km: 0 }])
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
          deviceId: null,
        })),
      );

    const res = await GET(req(BOUNDS));
    const body = await res.json();

    expect(body.decimated).toBe(true);
    expect(body.points.length).toBeLessThanOrEqual(20000);

    const sampleSql = JSON.stringify(queryRaw.mock.calls[2]);
    expect(sampleSql).toContain("ROW_NUMBER");
    expect(sampleSql).not.toContain("cum_km");
  });
});
