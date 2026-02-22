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

export type TimeGroup = {
  key: string;
  label: string;
  points: SerializedPoint[];
  distanceKm: number;
};

// Kept for backward compatibility
export type HourGroup = TimeGroup;

export type DailyStats = {
  totalPoints: number;
  totalDistanceKm: number;
  durationMinutes: number;
  daysWithData: number;
  groups: TimeGroup[];
};

export function computeDailyStats(points: SerializedPoint[]): DailyStats {
  return computePeriodStats(points, "hour");
}

export function computePeriodStats(
  points: SerializedPoint[],
  groupBy: "hour" | "day"
): DailyStats {
  if (points.length === 0) {
    return {
      totalPoints: 0,
      totalDistanceKm: 0,
      durationMinutes: 0,
      daysWithData: 0,
      groups: [],
    };
  }

  const buckets = new Map<string, SerializedPoint[]>();
  for (const p of points) {
    const key =
      groupBy === "hour"
        ? format(new Date(p.recordedAt), "HH")
        : format(new Date(p.recordedAt), "yyyy-MM-dd");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }

  const groups: TimeGroup[] = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, pts]) => ({
      key:
        groupBy === "hour"
          ? format(new Date(pts[0].recordedAt), "HH:00")
          : format(new Date(pts[0].recordedAt), "yyyy-MM-dd"),
      label:
        groupBy === "hour"
          ? format(new Date(pts[0].recordedAt), "h a")
          : format(new Date(pts[0].recordedAt), "EEE, MMM d"),
      points: pts,
      distanceKm: totalDistanceKm(pts),
    }));

  const firstTst = points[0].tst;
  const lastTst = points[points.length - 1].tst;
  const durationMinutes = Math.round((lastTst - firstTst) / 60);

  const daysWithData = new Set(
    points.map((p) => format(new Date(p.recordedAt), "yyyy-MM-dd"))
  ).size;

  return {
    totalPoints: points.length,
    totalDistanceKm: totalDistanceKm(points),
    durationMinutes,
    daysWithData,
    groups,
  };
}
