import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { getStatsForRange } from "@/lib/locations";
import { prisma } from "@/lib/prisma";

type MockFn = ReturnType<typeof vi.fn>;

const queryRaw = prisma.$queryRaw as unknown as MockFn;

describe("getStatsForRange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zeroed stats when there are no points", async () => {
    queryRaw
      .mockResolvedValueOnce([
        { total_points: BigInt(0), first_tst: null, last_tst: null, days_with_data: BigInt(0), total_km: 0 },
      ])
      .mockResolvedValueOnce([]);

    const stats = await getStatsForRange(new Date("2026-01-01"), new Date("2026-01-02"), "hour");

    expect(stats.totalPoints).toBe(0);
    expect(stats.groups).toEqual([]);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it("assembles DailyStats from globals + bucket rows", async () => {
    queryRaw
      .mockResolvedValueOnce([
        {
          total_points: BigInt(120),
          first_tst: 1_700_000_000,
          last_tst: 1_700_003_600,
          days_with_data: BigInt(1),
          total_km: 5.25,
        },
      ])
      .mockResolvedValueOnce([
        { bucket_key: "09", bucket_start: new Date("2026-04-12T09:00:00Z"), bucket_km: 2.25 },
        { bucket_key: "10", bucket_start: new Date("2026-04-12T10:00:00Z"), bucket_km: 3.0 },
      ]);

    const stats = await getStatsForRange(new Date("2026-04-12T00:00:00Z"), new Date("2026-04-12T23:59:59Z"), "hour");

    expect(stats.totalPoints).toBe(120);
    expect(stats.totalDistanceKm).toBeCloseTo(5.25, 6);
    expect(stats.daysWithData).toBe(1);
    expect(stats.groups).toHaveLength(2);
    expect(stats.groups[0].distanceKm).toBeCloseTo(2.25, 6);
  });

  it("works with undefined range (scans all points)", async () => {
    queryRaw
      .mockResolvedValueOnce([
        { total_points: BigInt(3), first_tst: BigInt(1), last_tst: BigInt(61), days_with_data: BigInt(1), total_km: 0.1 },
      ])
      .mockResolvedValueOnce([
        { bucket_key: "2026-04-12", bucket_start: new Date("2026-04-12T00:00:00Z"), bucket_km: 0.1 },
      ]);

    const stats = await getStatsForRange(undefined, undefined, "day");

    expect(stats.totalPoints).toBe(3);
    expect(stats.groups[0].key).toBe("2026-04-12");
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});
