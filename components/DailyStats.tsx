import type { DailyStats } from "@/lib/groupByHour";

export default function DailyStats({ stats }: { stats: DailyStats }) {
  const hours = Math.floor(stats.durationMinutes / 60);
  const mins = stats.durationMinutes % 60;
  const durationStr =
    stats.durationMinutes === 0
      ? "—"
      : hours > 0
      ? `${hours}h ${mins}m`
      : `${mins}m`;

  return (
    <div className="grid grid-cols-3 gap-2 border-b border-gray-200 px-4 py-3 text-center">
      <div>
        <p className="text-xs text-gray-500">Distance</p>
        <p className="text-sm font-semibold text-gray-800">
          {stats.totalDistanceKm > 0
            ? `${stats.totalDistanceKm.toFixed(1)} km`
            : "—"}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-500">Points</p>
        <p className="text-sm font-semibold text-gray-800">
          {stats.totalPoints > 0 ? stats.totalPoints : "—"}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-500">Duration</p>
        <p className="text-sm font-semibold text-gray-800">{durationStr}</p>
      </div>
    </div>
  );
}
