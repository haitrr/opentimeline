import type { SerializedPoint } from "@/lib/groupByHour";

export type StationarySuggestion = {
  fromTime: Date;
  toTime: Date;
  stationaryDeviceId: string;
  movingDeviceId: string;
};

const BUCKET_MINUTES = 15;
const STATIONARY_RADIUS_M = 100;
const STATIONARY_VELOCITY_MS = 2;
const MOVING_RADIUS_M = 300;
const MOVING_VELOCITY_MS = 5;
const MIN_POINTS = 3;

const EARTH_RADIUS_M = 6_371_000;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type Classification = "stationary" | "moving" | "unknown";

function classifyBucket(bucketPoints: SerializedPoint[]): Classification {
  if (bucketPoints.length < MIN_POINTS) return "unknown";

  const first = bucketPoints[0];
  let maxDist = 0;
  for (const p of bucketPoints) {
    const d = haversineMeters(first.lat, first.lon, p.lat, p.lon);
    if (d > maxDist) maxDist = d;
  }

  const vels = bucketPoints.map((p) => p.vel).filter((v): v is number => v !== null);
  const avgVel = vels.length > 0 ? vels.reduce((s, v) => s + v, 0) / vels.length : 0;

  if (maxDist < STATIONARY_RADIUS_M && avgVel < STATIONARY_VELOCITY_MS) return "stationary";
  if (maxDist > MOVING_RADIUS_M || avgVel > MOVING_VELOCITY_MS) return "moving";
  return "unknown";
}

export function detectStationarySuggestions(points: SerializedPoint[]): StationarySuggestion[] {
  const devicePoints = points.filter((p) => p.deviceId !== null);
  if (devicePoints.length === 0) return [];

  const devices = [...new Set(devicePoints.map((p) => p.deviceId as string))];
  if (devices.length < 2) return [];

  const bucketMs = BUCKET_MINUTES * 60 * 1000;

  const deviceBuckets = new Map<string, Map<number, SerializedPoint[]>>();
  for (const point of devicePoints) {
    const t = new Date(point.recordedAt).getTime();
    const bucket = Math.floor(t / bucketMs);
    if (!deviceBuckets.has(point.deviceId!)) deviceBuckets.set(point.deviceId!, new Map());
    const bucketMap = deviceBuckets.get(point.deviceId!)!;
    if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
    bucketMap.get(bucket)!.push(point);
  }

  const classifications = new Map<string, Map<number, Classification>>();
  for (const [deviceId, bucketMap] of deviceBuckets) {
    const classMap = new Map<number, Classification>();
    for (const [bucket, pts] of bucketMap) {
      classMap.set(bucket, classifyBucket(pts));
    }
    classifications.set(deviceId, classMap);
  }

  const suggestionBuckets: { bucket: number; stationaryDeviceId: string; movingDeviceId: string }[] = [];

  for (let i = 0; i < devices.length; i++) {
    for (let j = 0; j < devices.length; j++) {
      if (i === j) continue;
      const deviceA = devices[i];
      const deviceB = devices[j];
      const classA = classifications.get(deviceA)!;
      const classB = classifications.get(deviceB)!;

      for (const [bucket, classificationA] of classA) {
        if (classificationA === "stationary" && classB.get(bucket) === "moving") {
          suggestionBuckets.push({ bucket, stationaryDeviceId: deviceA, movingDeviceId: deviceB });
        }
      }
    }
  }

  if (suggestionBuckets.length === 0) return [];

  const pairKey = (s: string, m: string) => `${s}::${m}`;
  const byPair = new Map<string, number[]>();
  const pairDevices = new Map<string, { stationaryDeviceId: string; movingDeviceId: string }>();

  for (const { bucket, stationaryDeviceId, movingDeviceId } of suggestionBuckets) {
    const key = pairKey(stationaryDeviceId, movingDeviceId);
    if (!byPair.has(key)) {
      byPair.set(key, []);
      pairDevices.set(key, { stationaryDeviceId, movingDeviceId });
    }
    byPair.get(key)!.push(bucket);
  }

  const suggestions: StationarySuggestion[] = [];

  for (const [key, buckets] of byPair) {
    buckets.sort((a, b) => a - b);
    const { stationaryDeviceId, movingDeviceId } = pairDevices.get(key)!;

    let rangeStart = buckets[0];
    let rangeEnd = buckets[0];

    for (let i = 1; i < buckets.length; i++) {
      if (buckets[i] <= rangeEnd + 2) {
        rangeEnd = buckets[i];
      } else {
        suggestions.push({
          fromTime: new Date(rangeStart * bucketMs),
          toTime: new Date((rangeEnd + 1) * bucketMs),
          stationaryDeviceId,
          movingDeviceId,
        });
        rangeStart = buckets[i];
        rangeEnd = buckets[i];
      }
    }
    suggestions.push({
      fromTime: new Date(rangeStart * bucketMs),
      toTime: new Date((rangeEnd + 1) * bucketMs),
      stationaryDeviceId,
      movingDeviceId,
    });
  }

  return suggestions;
}
