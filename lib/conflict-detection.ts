import type { SerializedPoint } from "@/lib/groupByHour";

export type ConflictRange = {
  fromTime: Date;
  toTime: Date;
  deviceIds: string[];
};

const EARTH_RADIUS_M = 6371000;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function medianPosition(points: SerializedPoint[]): { lat: number; lon: number } {
  const lats = [...points.map((p) => p.lat)].sort((a, b) => a - b);
  const lons = [...points.map((p) => p.lon)].sort((a, b) => a - b);
  const mid = Math.floor(lats.length / 2);
  return { lat: lats[mid], lon: lons[mid] };
}

export function detectConflicts(
  points: SerializedPoint[],
  bucketMinutes = 5,
  distanceThresholdMeters = 200
): ConflictRange[] {
  const devicePoints = points.filter((p) => p.deviceId !== null);
  if (devicePoints.length === 0) return [];

  const devices = [...new Set(devicePoints.map((p) => p.deviceId as string))];
  if (devices.length < 2) return [];

  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets = new Map<number, Map<string, SerializedPoint[]>>();

  for (const point of devicePoints) {
    const t = new Date(point.recordedAt).getTime();
    const bucket = Math.floor(t / bucketMs);
    if (!buckets.has(bucket)) buckets.set(bucket, new Map());
    const deviceMap = buckets.get(bucket)!;
    if (!deviceMap.has(point.deviceId!)) deviceMap.set(point.deviceId!, []);
    deviceMap.get(point.deviceId!)!.push(point);
  }

  const conflictBuckets: number[] = [];
  const conflictDevicesMap = new Map<number, string[]>();

  for (const [bucket, deviceMap] of buckets) {
    if (deviceMap.size < 2) continue;
    const entries = [...deviceMap.entries()];
    const involved: string[] = [];

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const pos1 = medianPosition(entries[i][1]);
        const pos2 = medianPosition(entries[j][1]);
        if (haversineMeters(pos1.lat, pos1.lon, pos2.lat, pos2.lon) > distanceThresholdMeters) {
          if (!involved.includes(entries[i][0])) involved.push(entries[i][0]);
          if (!involved.includes(entries[j][0])) involved.push(entries[j][0]);
        }
      }
    }

    if (involved.length > 0) {
      conflictBuckets.push(bucket);
      conflictDevicesMap.set(bucket, involved);
    }
  }

  if (conflictBuckets.length === 0) return [];

  conflictBuckets.sort((a, b) => a - b);
  const ranges: ConflictRange[] = [];
  let rangeStart = conflictBuckets[0];
  let rangeEnd = conflictBuckets[0];
  let rangeDevices = new Set(conflictDevicesMap.get(rangeStart)!);

  for (let i = 1; i < conflictBuckets.length; i++) {
    const b = conflictBuckets[i];
    if (b <= rangeEnd + 2) {
      rangeEnd = b;
      conflictDevicesMap.get(b)!.forEach((d) => rangeDevices.add(d));
    } else {
      ranges.push({
        fromTime: new Date(rangeStart * bucketMs),
        toTime: new Date((rangeEnd + 1) * bucketMs),
        deviceIds: [...rangeDevices],
      });
      rangeStart = b;
      rangeEnd = b;
      rangeDevices = new Set(conflictDevicesMap.get(b)!);
    }
  }
  ranges.push({
    fromTime: new Date(rangeStart * bucketMs),
    toTime: new Date((rangeEnd + 1) * bucketMs),
    deviceIds: [...rangeDevices],
  });

  return ranges;
}
