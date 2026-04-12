import { describe, it, expect } from "vitest";
import { assembleStats } from "@/lib/stats";

describe("assembleStats", () => {
  it("returns zeros for empty input", () => {
    const stats = assembleStats(
      { totalPoints: 0, firstTst: null, lastTst: null, daysWithData: 0, totalKm: 0 },
      [],
      "hour",
    );
    expect(stats).toEqual({
      totalPoints: 0,
      totalDistanceKm: 0,
      durationMinutes: 0,
      daysWithData: 0,
      groups: [],
    });
  });

  it("labels hour groups with `h a` and keys as `HH:00`", () => {
    const stats = assembleStats(
      { totalPoints: 3, firstTst: 1_700_000_000, lastTst: 1_700_003_600, daysWithData: 1, totalKm: 2.5 },
      [
        { bucketKey: "09", bucketStart: new Date("2026-04-12T09:12:00Z"), bucketKm: 1.5 },
        { bucketKey: "10", bucketStart: new Date("2026-04-12T10:03:00Z"), bucketKm: 1.0 },
      ],
      "hour",
    );
    expect(stats.totalDistanceKm).toBeCloseTo(2.5, 6);
    expect(stats.durationMinutes).toBe(Math.round((1_700_003_600 - 1_700_000_000) / 60));
    expect(stats.daysWithData).toBe(1);
    expect(stats.groups).toHaveLength(2);
    expect(stats.groups[0].key).toMatch(/^\d{2}:00$/);
    expect(stats.groups[0].label).toMatch(/(AM|PM)/);
    expect(stats.groups[0].distanceKm).toBeCloseTo(1.5, 6);
  });

  it("labels day groups with ISO date key and weekday label", () => {
    const stats = assembleStats(
      { totalPoints: 2, firstTst: 1_700_000_000, lastTst: 1_700_090_000, daysWithData: 2, totalKm: 4.2 },
      [
        { bucketKey: "2026-04-11", bucketStart: new Date("2026-04-11T07:00:00Z"), bucketKm: 2.0 },
        { bucketKey: "2026-04-12", bucketStart: new Date("2026-04-12T08:00:00Z"), bucketKm: 2.2 },
      ],
      "day",
    );
    expect(stats.groups[0].key).toBe("2026-04-11");
    expect(stats.groups[1].key).toBe("2026-04-12");
    expect(stats.groups[0].label).toMatch(/^\w{3}, \w{3} \d+$/);
  });
});
