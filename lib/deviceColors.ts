export type DeviceColor = { color: string; strokeColor: string };

export const NULL_DEVICE_COLOR: DeviceColor = {
  color: "#3b82f6",
  strokeColor: "#1d4ed8",
};

export const DEVICE_COLOR_PALETTE: DeviceColor[] = [
  { color: "#06b6d4", strokeColor: "#0891b2" },
  { color: "#a855f7", strokeColor: "#9333ea" },
  { color: "#f59e0b", strokeColor: "#d97706" },
  { color: "#10b981", strokeColor: "#059669" },
  { color: "#ec4899", strokeColor: "#db2777" },
  { color: "#84cc16", strokeColor: "#65a30d" },
  { color: "#6366f1", strokeColor: "#4f46e5" },
  { color: "#f97316", strokeColor: "#ea580c" },
];

export function buildDeviceColorMap(
  deviceIds: (string | null)[],
): Map<string | null, DeviceColor> {
  const counts = new Map<string | null, number>();
  for (const id of deviceIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const sorted = Array.from(counts.keys()).sort((a, b) => {
    const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (diff !== 0) return diff;
    return String(a) < String(b) ? -1 : 1;
  });

  const result = new Map<string | null, DeviceColor>();
  sorted.forEach((id, index) => {
    result.set(id, DEVICE_COLOR_PALETTE[index % DEVICE_COLOR_PALETTE.length]);
  });
  return result;
}
