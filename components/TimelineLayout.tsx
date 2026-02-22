import DateNav from "@/components/DateNav";
import TimelineSidebar from "@/components/TimelineSidebar";
import DailyStats from "@/components/DailyStats";
import MapWrapper from "@/components/map/MapWrapper";
import ImportGpxButton from "@/components/ImportGpxButton";
import type { DailyStats as DailyStatsType } from "@/lib/groupByHour";
import type { SerializedPoint } from "@/lib/groupByHour";

type Props = {
  date: string;
  points: SerializedPoint[];
  stats: DailyStatsType;
};

export default function TimelineLayout({ date, points, stats }: Props) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Left Sidebar */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-white">
        <header className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <h1 className="text-base font-semibold text-gray-900">
              OpenTimeline
            </h1>
          </div>
          <DateNav currentDate={date} />
          <div className="mt-2">
            <ImportGpxButton />
          </div>
        </header>
        <DailyStats stats={stats} />
        <TimelineSidebar hourGroups={stats.hourGroups} />
      </aside>

      {/* Map */}
      <main className="relative flex-1">
        <MapWrapper points={points} />
      </main>
    </div>
  );
}
