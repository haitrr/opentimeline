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

// Returns the average distance between nearest-in-time matched point pairs across two devices.
// Using nearest-timestamp matching (rather than median positions) correctly handles devices
// that move together but report at different frequencies: at any given moment both devices
// are at the same location, so their nearest-time counterparts will also be close.
function nearestMatchedAvgDistance(
  pointsA: SerializedPoint[],
  pointsB: SerializedPoint[],
  maxTimeDiffMs = 2 * 60 * 1000
): number | null {
  const [ref, other] = pointsA.length <= pointsB.length ? [pointsA, pointsB] : [pointsB, pointsA];
  const otherSorted = other
    .map((p) => ({ t: new Date(p.recordedAt).getTime(), lat: p.lat, lon: p.lon }))
    .sort((a, b) => a.t - b.t);

  const distances: number[] = [];

  for (const refPoint of ref) {
    const refTime = new Date(refPoint.recordedAt).getTime();
    let lo = 0, hi = otherSorted.length - 1, bestIdx = -1, bestDiff = Infinity;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const diff = Math.abs(otherSorted[mid].t - refTime);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = mid; }
      if (otherSorted[mid].t < refTime) lo = mid + 1;
      else hi = mid - 1;
    }
    if (bestIdx >= 0 && bestDiff <= maxTimeDiffMs) {
      const o = otherSorted[bestIdx];
      distances.push(haversineMeters(refPoint.lat, refPoint.lon, o.lat, o.lon));
    }
  }

  if (distances.length === 0) return null;
  return distances.reduce((s, d) => s + d, 0) / distances.length;
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
        const avgDist = nearestMatchedAvgDistance(entries[i][1], entries[j][1]);
        if (avgDist !== null && avgDist > distanceThresholdMeters) {
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
