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
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [mobilePanelsOpen, setMobilePanelsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  async function detectVisits() {
    setDetecting(true);
    const body = JSON.stringify({
      ...(rangeStart ? { start: rangeStart } : {}),
      ...(rangeEnd ? { end: rangeEnd } : {}),
    });
    let total = 0;
    try {
      const r1 = await fetch("/api/visits/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (r1.ok) {
        const { newVisits } = await r1.json();
        total += newVisits ?? 0;
        if (newVisits > 0) {
          queryClient.invalidateQueries({ queryKey: ["visits"] });
          queryClient.invalidateQueries({ queryKey: ["places"] });
        }
      }
      const r2 = await fetch("/api/unknown-visits/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (r2.ok) {
        const { created } = await r2.json();
        total += created ?? 0;
        if (created > 0) {
          queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
          queryClient.invalidateQueries({ queryKey: ["places"] });
        }
      }
    } finally {
      setDetecting(false);
      setSettingsOpen(false);
      showToast(
        total === 0
          ? "No new visit suggestions found"
          : `${total} new visit suggestion${total === 1 ? "" : "s"} detected`
      );
    }
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-gray-50 md:h-screen md:w-screen md:flex-row">
      <aside
        className={`absolute inset-x-0 top-0 z-900 h-full max-h-[75vh] md:max-h-[100vh] flex-col overflow-hidden border-b border-gray-200 bg-white shadow-lg transition-transform md:relative md:flex md:h-full md:w-80 md:shrink-0 md:border-b-0 md:border-r md:shadow-none ${mobilePanelsOpen ? "flex" : "hidden"}`}
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
        </header>
        <DailyStats stats={stats} range={range} />
        <TimelineSidebar rangeStart={rangeStart} rangeEnd={rangeEnd} />
        <PlacesPanel />
        <VisitSuggestionsPanel />
        <UnknownVisitSuggestionsPanel />
        <div className="absolute bottom-4 left-4 z-10">
          {settingsOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
              <ImportGpxButton />
              <button
                type="button"
                onClick={detectVisits}
                disabled={detecting}
                className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                </svg>
                {detecting ? "Detecting…" : "Detect visits"}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white p-2.5 text-gray-600 shadow-md hover:bg-gray-50 hover:text-gray-800"
            aria-expanded={settingsOpen}
            aria-label="Open settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path
                fillRule="evenodd"
                d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.223 1.164a6.98 6.98 0 0 1 1.48.85l1.08-.54a1 1 0 0 1 1.232.236l1.668 1.668a1 1 0 0 1 .236 1.232l-.54 1.08c.332.46.616.958.85 1.48l1.164.223a1 1 0 0 1 .804.98v2.36a1 1 0 0 1-.804.98l-1.164.223a6.98 6.98 0 0 1-.85 1.48l.54 1.08a1 1 0 0 1-.236 1.232l-1.668 1.668a1 1 0 0 1-1.232.236l-1.08-.54a6.98 6.98 0 0 1-1.48.85l-.223 1.164a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.223-1.164a6.98 6.98 0 0 1-1.48-.85l-1.08.54a1 1 0 0 1-1.232-.236L2.157 16.61a1 1 0 0 1-.236-1.232l.54-1.08a6.98 6.98 0 0 1-.85-1.48l-1.164-.223A1 1 0 0 1 .643 11.615v-2.36a1 1 0 0 1 .804-.98l1.164-.223a6.98 6.98 0 0 1 .85-1.48l-.54-1.08a1 1 0 0 1 .236-1.232L4.825 2.592a1 1 0 0 1 1.232-.236l1.08.54c.46-.332.958-.616 1.48-.85l.223-1.164ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </aside>

      <main className="relative min-h-0 flex-1">
        <MapWrapper points={points} rangeStart={rangeStart} rangeEnd={rangeEnd} />
        <BackgroundDetector />
        {toast && (
          <div className="absolute top-4 left-1/2 z-900 -translate-x-1/2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-lg">
            {toast}
          </div>
        )}
        <button
          type="button"
          onClick={() => setMobilePanelsOpen((open) => !open)}
          className="absolute left-3 top-3 z-900 rounded border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow md:hidden"
        >
          {mobilePanelsOpen ? "Hide panel" : "Show panel"}
        </button>
      </main>
    </div>
  );
}
