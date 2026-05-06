import type { DailyStats } from "@/lib/groupByHour";

export default function DailyStats({
  stats,
}: {
  stats: DailyStats;
}) {
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
        <p className="text-xs text-muted-foreground">Points</p>
        <p className="text-sm font-semibold">{stats.totalPoints > 0 ? stats.totalPoints : "—"}</p>
      </div>
    </div>
  );
}
