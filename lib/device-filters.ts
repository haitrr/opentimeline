import type { SerializedPoint } from "@/lib/groupByHour";

export type DeviceFilterRecord = {
  id: string;
  fromTime: Date;
  toTime: Date;
  deviceIds: string[];
  label: string | null;
  createdAt: Date;
};

export function applyDeviceFilters(
  points: SerializedPoint[],
  filters: DeviceFilterRecord[]
): SerializedPoint[] {
  if (filters.length === 0) return points;
  return points.filter((point) => {
    const t = new Date(point.recordedAt).getTime();
    for (const filter of filters) {
      if (t >= filter.fromTime.getTime() && t <= filter.toTime.getTime()) {
        return point.deviceId !== null && filter.deviceIds.includes(point.deviceId);
      }
    }
    return true;
  });
}
