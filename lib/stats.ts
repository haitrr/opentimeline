import { format } from "date-fns";
import type { DailyStats, TimeGroup } from "@/lib/groupByHour";

export type StatsGlobalsRow = {
  totalPoints: number;
  firstTst: number | null;
  lastTst: number | null;
  daysWithData: number;
  totalKm: number;
};

export type StatsBucketRow = {
  bucketKey: string;
  bucketStart: Date;
  bucketKm: number;
};

export function assembleStats(
  globals: StatsGlobalsRow,
  buckets: StatsBucketRow[],
  groupBy: "hour" | "day",
): DailyStats {
  if (globals.totalPoints === 0) {
    return {
      totalPoints: 0,
      totalDistanceKm: 0,
      durationMinutes: 0,
      daysWithData: 0,
      groups: [],
    };
  }

  const durationMinutes =
    globals.firstTst !== null && globals.lastTst !== null
      ? Math.round((globals.lastTst - globals.firstTst) / 60)
      : 0;

  const groups: TimeGroup[] = buckets.map((b) => ({
    key: groupBy === "hour" ? format(b.bucketStart, "HH:00") : format(b.bucketStart, "yyyy-MM-dd"),
    label: groupBy === "hour" ? format(b.bucketStart, "h a") : format(b.bucketStart, "EEE, MMM d"),
    distanceKm: b.bucketKm,
  }));

  return {
    totalPoints: globals.totalPoints,
    totalDistanceKm: globals.totalKm,
    durationMinutes,
    daysWithData: globals.daysWithData,
    groups,
  };
}
