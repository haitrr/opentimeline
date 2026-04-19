import { describe, it, expect } from "vitest";
import { detectConflicts } from "@/lib/conflict-detection";
import type { SerializedPoint } from "@/lib/groupByHour";

function pt(overrides: { deviceId?: string | null; lat: number; lon: number; recordedAt: string }): SerializedPoint {
  return { id: 1, tst: 0, acc: null, batt: null, tid: null, alt: null, vel: null, deviceId: null, ...overrides };
}

describe("detectConflicts", () => {
  it("returns empty array for no points", () => {
    expect(detectConflicts([])).toEqual([]);
  });

  it("returns empty for only one device", () => {
    const points = [
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: "2026-04-01T08:00:00Z" }),
      pt({ deviceId: "phone", lat: 10.001, lon: 10.001, recordedAt: "2026-04-01T08:02:00Z" }),
    ];
    expect(detectConflicts(points)).toEqual([]);
  });

  it("returns empty when two devices are in the same location", () => {
    const points = [
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: "2026-04-01T08:00:00Z" }),
      pt({ deviceId: "tablet", lat: 10.001, lon: 10.001, recordedAt: "2026-04-01T08:01:00Z" }),
    ];
    // ~150m apart — under 200m threshold
    expect(detectConflicts(points)).toEqual([]);
  });

  it("detects conflict when devices are far apart in the same bucket", () => {
    const points = [
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: "2026-04-01T08:00:00Z" }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: "2026-04-01T08:01:00Z" }),
    ];
    // ~150km apart
    const conflicts = detectConflicts(points);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].deviceIds).toContain("phone");
    expect(conflicts[0].deviceIds).toContain("tablet");
  });

  it("merges adjacent conflict buckets into one range", () => {
    const base = new Date("2026-04-01T08:00:00Z").getTime();
    const bucket = 5 * 60 * 1000;
    const points = [
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: new Date(base).toISOString() }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: new Date(base + 1000).toISOString() }),
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: new Date(base + bucket).toISOString() }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: new Date(base + bucket + 1000).toISOString() }),
    ];
    expect(detectConflicts(points)).toHaveLength(1);
  });

  it("returns separate ranges for non-adjacent conflict buckets", () => {
    const base = new Date("2026-04-01T08:00:00Z").getTime();
    const bucket = 5 * 60 * 1000;
    const points = [
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: new Date(base).toISOString() }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: new Date(base + 1000).toISOString() }),
      pt({ deviceId: "phone", lat: 10, lon: 10, recordedAt: new Date(base + bucket * 3).toISOString() }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: new Date(base + bucket * 3 + 1000).toISOString() }),
    ];
    expect(detectConflicts(points)).toHaveLength(2);
  });

  it("does not conflict when two devices move together at different reporting rates", () => {
    // Simulates pixel4a (1Hz) and iphone17pro (~0.03Hz) carried by the same person.
    // In a 5-min bucket the median positions would differ because the fast device has
    // many more points early in the journey — but nearest-timestamp matching should
    // show they were always at the same location.
    const base = new Date("2026-04-01T08:00:00Z").getTime();
    const points: ReturnType<typeof pt>[] = [];
    // pixel4a: 300 points every second, moving north at ~10m/s
    for (let s = 0; s < 300; s++) {
      const lat = 10 + (s * 10) / 111000; // ~10 m/s northward
      points.push(pt({ deviceId: "pixel4a", lat, lon: 10, recordedAt: new Date(base + s * 1000).toISOString() }));
    }
    // iphone17pro: 1 point every 30 seconds, at the same position as pixel4a
    for (let s = 0; s < 300; s += 30) {
      const lat = 10 + (s * 10) / 111000;
      points.push(pt({ deviceId: "iphone17pro", lat, lon: 10, recordedAt: new Date(base + s * 1000).toISOString() }));
    }
    expect(detectConflicts(points)).toEqual([]);
  });

  it("ignores points with null deviceId", () => {
    const points = [
      pt({ deviceId: null, lat: 10, lon: 10, recordedAt: "2026-04-01T08:00:00Z" }),
      pt({ deviceId: "tablet", lat: 11, lon: 11, recordedAt: "2026-04-01T08:01:00Z" }),
    ];
    expect(detectConflicts(points)).toEqual([]);
  });
});
