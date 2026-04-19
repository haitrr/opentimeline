import { describe, it, expect } from "vitest";
import { applyDeviceFilters } from "@/lib/device-filters";
import type { SerializedPoint } from "@/lib/groupByHour";

function pt(overrides: { deviceId?: string | null; recordedAt: string }): SerializedPoint {
  return { id: 1, lat: 10, lon: 10, tst: 0, acc: null, batt: null, tid: null, alt: null, vel: null, deviceId: null, ...overrides };
}

const FILTER = {
  id: "f1",
  fromTime: new Date("2026-04-01T08:00:00Z"),
  toTime: new Date("2026-04-01T18:00:00Z"),
  deviceIds: ["phone"],
  label: null as string | null,
  createdAt: new Date(),
};

describe("applyDeviceFilters", () => {
  it("returns all points when no filters", () => {
    expect(applyDeviceFilters([pt({ recordedAt: "2026-04-01T10:00:00Z", deviceId: "phone" })], [])).toHaveLength(1);
  });

  it("keeps point from allowed device in filter range", () => {
    expect(applyDeviceFilters([pt({ recordedAt: "2026-04-01T10:00:00Z", deviceId: "phone" })], [FILTER])).toHaveLength(1);
  });

  it("removes point from excluded device in filter range", () => {
    expect(applyDeviceFilters([pt({ recordedAt: "2026-04-01T10:00:00Z", deviceId: "tablet" })], [FILTER])).toHaveLength(0);
  });

  it("removes point with null deviceId in filter range", () => {
    expect(applyDeviceFilters([pt({ recordedAt: "2026-04-01T10:00:00Z", deviceId: null })], [FILTER])).toHaveLength(0);
  });

  it("keeps all points outside filter range regardless of device", () => {
    expect(applyDeviceFilters([pt({ recordedAt: "2026-04-01T20:00:00Z", deviceId: "tablet" })], [FILTER])).toHaveLength(1);
  });
});
