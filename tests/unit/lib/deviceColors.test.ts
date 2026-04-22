import { describe, it, expect } from "vitest";
import { buildDeviceColorMap, DEVICE_COLOR_PALETTE } from "@/lib/deviceColors";

describe("buildDeviceColorMap", () => {
  it("returns empty map for empty input", () => {
    const result = buildDeviceColorMap([]);
    expect(result.size).toBe(0);
  });

  it("assigns first palette color to the sole device", () => {
    const result = buildDeviceColorMap(["phone"]);
    expect(result.get("phone")).toEqual(DEVICE_COLOR_PALETTE[0]);
  });

  it("assigns first palette color to null deviceId when it's the only device", () => {
    const result = buildDeviceColorMap([null]);
    expect(result.get(null)).toEqual(DEVICE_COLOR_PALETTE[0]);
  });

  it("assigns first palette color to device with the most points", () => {
    const ids = ["watch", "phone", "phone", "phone", "watch"];
    const result = buildDeviceColorMap(ids);
    expect(result.get("phone")).toEqual(DEVICE_COLOR_PALETTE[0]);
    expect(result.get("watch")).toEqual(DEVICE_COLOR_PALETTE[1]);
  });

  it("assigns null the first palette color when it has the most points", () => {
    const ids = [null, null, null, "phone", "phone"];
    const result = buildDeviceColorMap(ids);
    expect(result.get(null)).toEqual(DEVICE_COLOR_PALETTE[0]);
    expect(result.get("phone")).toEqual(DEVICE_COLOR_PALETTE[1]);
  });

  it("assigns distinct colors to distinct devices", () => {
    const result = buildDeviceColorMap(["phone", "watch"]);
    expect(result.get("phone")?.color).not.toBe(result.get("watch")?.color);
  });

  it("cycles colors when there are more devices than palette entries", () => {
    const ids = Array.from({ length: DEVICE_COLOR_PALETTE.length + 1 }, (_, i) => `dev-${i}`);
    const result = buildDeviceColorMap(ids);
    expect(result.get("dev-0")?.color).toBe(result.get(`dev-${DEVICE_COLOR_PALETTE.length}`)?.color);
  });

  it("is deterministic — same input always produces same color assignment", () => {
    const ids = ["alpha", "beta", null, "gamma"];
    const r1 = buildDeviceColorMap(ids);
    const r2 = buildDeviceColorMap(ids);
    for (const id of ids) {
      expect(r1.get(id)).toEqual(r2.get(id));
    }
  });

  it("deduplicates repeated device IDs", () => {
    const result = buildDeviceColorMap(["phone", "phone", "phone"]);
    expect(result.size).toBe(1);
    expect(result.get("phone")).toEqual(DEVICE_COLOR_PALETTE[0]);
  });
});
