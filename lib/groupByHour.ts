import { format } from "date-fns";
import { totalDistanceKm } from "@/lib/geo";

export type SerializedPoint = {
  id: number;
  lat: number;
  lon: number;
  tst: number;
  recordedAt: string;
  acc: number | null;
  batt: number | null;
  tid: string | null;
  alt: number | null;
  vel: number | null;
};

export type HourGroup = {
  hour: string;
  label: string;
  points: SerializedPoint[];
  distanceKm: number;
};

export type DailyStats = {
  totalPoints: number;
  totalDistanceKm: number;
  durationMinutes: number;
  hourGroups: HourGroup[];
};

export function computeDailyStats(points: SerializedPoint[]): DailyStats {
  if (points.length === 0) {
    return {
      totalPoints: 0,
      totalDistanceKm: 0,
      durationMinutes: 0,
      hourGroups: [],
    };
  }

  const buckets = new Map<string, SerializedPoint[]>();
  for (const p of points) {
    const key = format(new Date(p.recordedAt), "HH");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }

  const hourGroups: HourGroup[] = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, pts]) => ({
      hour: format(new Date(pts[0].recordedAt), "HH:00"),
      label: format(new Date(pts[0].recordedAt), "h a"),
      points: pts,
      distanceKm: totalDistanceKm(pts),
    }));

  const firstTst = points[0].tst;
  const lastTst = points[points.length - 1].tst;
  const durationMinutes = Math.round((lastTst - firstTst) / 60);

  return {
    totalPoints: points.length,
    totalDistanceKm: totalDistanceKm(points),
    durationMinutes,
    hourGroups,
  };
}
