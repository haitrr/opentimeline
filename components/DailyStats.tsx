import type { DailyStats } from "@/lib/groupByHour";
import type { RangeType } from "@/app/timeline/[date]/page";

export default function DailyStats({
  stats,
  range,
}: {
  stats: DailyStats;
  range: RangeType;
}) {
  const secondStat =
    range === "day"
      ? { label: "Points", value: stats.totalPoints > 0 ? stats.totalPoints : "—" }
      : { label: "Days", value: stats.daysWithData > 0 ? stats.daysWithData : "—" };

  return (
    <div className="grid grid-cols-2 gap-2 border-b px-4 py-3 text-center">
      <div className="rounded-md bg-muted/50 px-2 py-2">
        <p className="text-xs text-muted-foreground">Distance</p>
        <p className="text-sm font-semibold">
          {stats.totalDistanceKm > 0
            ? `${stats.totalDistanceKm.toFixed(1)} km`
            : "—"}
        </p>
      </div>
      <div className="rounded-md bg-muted/50 px-2 py-2">
        <p className="text-xs text-muted-foreground">{secondStat.label}</p>
        <p className="text-sm font-semibold">{secondStat.value}</p>
      </div>
    </div>
  );
}
