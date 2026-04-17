import type { DailyStats } from "@/lib/groupByHour";
import type { RangeType } from "@/app/timeline/[date]/page";

export default function DailyStats({
  stats,
  range,
}: {
  stats: DailyStats;
  range: RangeType;
}) {
  const hours = Math.floor(stats.durationMinutes / 60);
  const mins = stats.durationMinutes % 60;
  const durationStr =
    stats.durationMinutes === 0
      ? "—"
      : hours > 0
      ? `${hours}h ${mins}m`
      : `${mins}m`;

  const thirdStat =
    range === "day"
      ? { label: "Duration", value: durationStr }
      : { label: "Days", value: stats.daysWithData > 0 ? stats.daysWithData : "—" };

  return (
    <div className="grid grid-cols-3 gap-2 border-b px-4 py-3 text-center">
      <div className="rounded-md bg-muted/50 px-2 py-2">
        <p className="text-xs text-muted-foreground">Distance</p>
        <p className="text-sm font-semibold">
          {stats.totalDistanceKm > 0
            ? `${stats.totalDistanceKm.toFixed(1)} km`
            : "—"}
        </p>
      </div>
      <div className="rounded-md bg-muted/50 px-2 py-2">
        <p className="text-xs text-muted-foreground">Points</p>
        <p className="text-sm font-semibold">
          {stats.totalPoints > 0 ? stats.totalPoints : "—"}
        </p>
      </div>
      <div className="rounded-md bg-muted/50 px-2 py-2">
        <p className="text-xs text-muted-foreground">{thirdStat.label}</p>
        <p className="text-sm font-semibold">{thirdStat.value}</p>
      </div>
    </div>
  );
}
