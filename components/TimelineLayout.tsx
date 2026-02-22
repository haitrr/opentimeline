"use client";

import DateNav from "@/components/DateNav";
import TimelineSidebar from "@/components/TimelineSidebar";
import DailyStats from "@/components/DailyStats";
import MapWrapper from "@/components/map/MapWrapper";
import ImportGpxButton from "@/components/ImportGpxButton";
import PlacesPanel from "@/components/PlacesPanel";
import VisitSuggestionsPanel from "@/components/VisitSuggestionsPanel";
import UnknownVisitSuggestionsPanel from "@/components/UnknownVisitSuggestionsPanel";
import BackgroundDetector from "@/components/BackgroundDetector";
import ThemeToggle from "@/components/ThemeToggle";
import type { DailyStats as DailyStatsType } from "@/lib/groupByHour";
import type { SerializedPoint } from "@/lib/groupByHour";
import type { RangeType } from "@/app/timeline/[date]/page";
import { useState } from "react";

type Props = {
  date: string;
  range: RangeType;
  endDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
  points: SerializedPoint[];
  stats: DailyStatsType;
};

export default function TimelineLayout({
  date,
  range,
  endDate,
  rangeStart,
  rangeEnd,
  points,
  stats,
}: Props) {
  const [mobilePanelsOpen, setMobilePanelsOpen] = useState(false);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-gray-50 md:h-screen md:w-screen md:flex-row">
      <aside
        className={`absolute inset-x-0 top-0 z-[900] max-h-[75vh] flex-col overflow-hidden border-b border-gray-200 bg-white shadow-lg transition-transform md:static md:flex md:h-full md:w-80 md:shrink-0 md:border-b-0 md:border-r md:shadow-none ${mobilePanelsOpen ? "flex" : "hidden"}`}
      >
        <header className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <h1 className="text-base font-semibold text-gray-900">
                OpenTimeline
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setMobilePanelsOpen(false)}
                className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 md:hidden"
                aria-label="Close panel"
              >
                ✕
              </button>
            </div>
          </div>
          <DateNav currentDate={date} range={range} endDate={endDate} />
          <div className="mt-2">
            <ImportGpxButton />
          </div>
        </header>
        <DailyStats stats={stats} range={range} />
        <TimelineSidebar rangeStart={rangeStart} rangeEnd={rangeEnd} />
        <PlacesPanel />
        <VisitSuggestionsPanel />
        <UnknownVisitSuggestionsPanel />
      </aside>

      <main className="relative min-h-0 flex-1">
        <MapWrapper points={points} rangeStart={rangeStart} rangeEnd={rangeEnd} />
        <BackgroundDetector />
        <button
          type="button"
          onClick={() => setMobilePanelsOpen((open) => !open)}
          className="absolute left-3 top-3 z-[900] rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow md:hidden"
        >
          {mobilePanelsOpen ? "Hide panel" : "Show panel"}
        </button>
      </main>
    </div>
  );
}
