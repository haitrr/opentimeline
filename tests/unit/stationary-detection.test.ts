import { describe, it, expect } from "vitest";
import { detectStationarySuggestions } from "@/lib/stationary-detection";
import type { SerializedPoint } from "@/lib/groupByHour";

function pt(overrides: {
  deviceId?: string | null;
  lat: number;
  lon: number;
  recordedAt: string;
  vel?: number | null;
}): SerializedPoint {
  return { id: 1, tst: 0, acc: null, batt: null, tid: null, alt: null, vel: null, deviceId: null, ...overrides };
}

// Generates points for a device staying near a fixed location (stationary)
function stationaryPoints(deviceId: string, baseTime: Date, durationMinutes: number): SerializedPoint[] {
  const points: SerializedPoint[] = [];
  for (let i = 0; i < durationMinutes; i++) {
    const t = new Date(baseTime.getTime() + i * 60_000).toISOString();
    points.push(pt({ deviceId, lat: 10.0001 * (1 + (i % 3) * 0.00001), lon: 10, recordedAt: t, vel: 0 }));
  }
  return points;
}

// Generates points for a device moving ~10 m/s northward
function movingPoints(deviceId: string, baseTime: Date, durationMinutes: number): SerializedPoint[] {
  const points: SerializedPoint[] = [];
  for (let i = 0; i < durationMinutes; i++) {
    const t = new Date(baseTime.getTime() + i * 60_000).toISOString();
    const lat = 10 + (i * 60 * 10) / 111_000; // 10 m/s * 60 s per point
    points.push(pt({ deviceId, lat, lon: 10, recordedAt: t, vel: 10 }));
  }
  return points;
}

describe("detectStationarySuggestions", () => {
  it("returns empty for no points", () => {
    expect(detectStationarySuggestions([])).toEqual([]);
  });

  it("returns empty for a single device", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = stationaryPoints("phone", base, 30);
    expect(detectStationarySuggestions(points)).toEqual([]);
  });

  it("returns empty when both devices are moving", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = [
      ...movingPoints("phone", base, 30),
      ...movingPoints("watch", base, 30),
    ];
    expect(detectStationarySuggestions(points)).toEqual([]);
  });

  it("returns empty when both devices are stationary", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = [
      ...stationaryPoints("phone", base, 30),
      ...stationaryPoints("watch", base, 30),
    ];
    expect(detectStationarySuggestions(points)).toEqual([]);
  });

  it("detects suggestion when one device is stationary and the other is moving", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = [
      ...stationaryPoints("watch", base, 60),
      ...movingPoints("phone", base, 60),
    ];
    const suggestions = detectStationarySuggestions(points);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].stationaryDeviceId).toBe("watch");
    expect(suggestions[0].movingDeviceId).toBe("phone");
    expect(suggestions[0].fromTime).toBeInstanceOf(Date);
    expect(suggestions[0].toTime).toBeInstanceOf(Date);
    expect(suggestions[0].toTime.getTime()).toBeGreaterThan(suggestions[0].fromTime.getTime());
  });

  it("merges adjacent suggestion buckets into one range", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = [
      ...stationaryPoints("watch", base, 60),
      ...movingPoints("phone", base, 60),
    ];
    const suggestions = detectStationarySuggestions(points);
    // All adjacent buckets should be merged into a single suggestion
    expect(suggestions).toHaveLength(1);
  });

  it("ignores points with null deviceId", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    const points = [
      ...stationaryPoints("watch", base, 30),
      pt({ deviceId: null, lat: 20, lon: 20, recordedAt: new Date(base.getTime() + 5 * 60_000).toISOString(), vel: 10 }),
    ];
    expect(detectStationarySuggestions(points)).toEqual([]);
  });

  it("requires minimum 3 points per device per bucket to classify", () => {
    const base = new Date("2026-04-01T08:00:00Z");
    // Only 1 point each — not enough signal
    const points = [
      pt({ deviceId: "watch", lat: 10, lon: 10, recordedAt: base.toISOString(), vel: 0 }),
      pt({ deviceId: "phone", lat: 11, lon: 10, recordedAt: new Date(base.getTime() + 60_000).toISOString(), vel: 10 }),
    ];
    expect(detectStationarySuggestions(points)).toEqual([]);
  });
});
