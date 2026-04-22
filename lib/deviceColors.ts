export type DeviceColor = { color: string; strokeColor: string };

export const NULL_DEVICE_COLOR: DeviceColor = {
  color: "#3b82f6",
  strokeColor: "#1d4ed8",
};

export const DEVICE_COLOR_PALETTE: DeviceColor[] = [
  { color: "#f97316", strokeColor: "#ea580c" },
  { color: "#a855f7", strokeColor: "#9333ea" },
  { color: "#06b6d4", strokeColor: "#0891b2" },
  { color: "#f59e0b", strokeColor: "#d97706" },
  { color: "#10b981", strokeColor: "#059669" },
  { color: "#ec4899", strokeColor: "#db2777" },
  { color: "#84cc16", strokeColor: "#65a30d" },
  { color: "#6366f1", strokeColor: "#4f46e5" },
];

export function buildDeviceColorMap(
  deviceIds: (string | null)[],
): Map<string | null, DeviceColor> {
  const result = new Map<string | null, DeviceColor>();
  let paletteIndex = 0;
  for (const id of deviceIds) {
    if (result.has(id)) continue;
    if (id === null) {
      result.set(null, NULL_DEVICE_COLOR);
    } else {
      result.set(id, DEVICE_COLOR_PALETTE[paletteIndex % DEVICE_COLOR_PALETTE.length]);
      paletteIndex++;
    }
  }
  return result;
}
