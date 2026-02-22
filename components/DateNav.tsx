"use client";

import { useRouter } from "next/navigation";
import {
  format,
  addDays,
  subDays,
  parseISO,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfWeek,
  endOfWeek,
  endOfMonth,
  endOfYear,
} from "date-fns";
import type { RangeType } from "@/app/timeline/[date]/page";

const RANGE_LABELS: Record<RangeType, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
  custom: "Custom",
  all: "All",
};

export default function DateNav({
  currentDate,
  range = "day",
  endDate,
}: {
  currentDate: string;
  range?: RangeType;
  endDate?: string;
}) {
  const router = useRouter();
  const date = parseISO(currentDate);
  const today = format(new Date(), "yyyy-MM-dd");

  const navigate = (d: Date, r?: RangeType, end?: string) => {
    const r2 = r ?? range;
    const params =
      r2 !== "day"
        ? `?range=${r2}${end ? `&end=${end}` : ""}`
        : "";
    router.push(`/timeline/${format(d, "yyyy-MM-dd")}${params}`);
  };

  const goPrev = () => {
    switch (range) {
      case "day":
        return navigate(subDays(date, 1));
      case "week":
        return navigate(subWeeks(date, 1));
      case "month":
        return navigate(subMonths(date, 1));
      case "year":
        return navigate(subYears(date, 1));
      case "custom": {
        const end = endDate ? parseISO(endDate) : date;
        const days =
          Math.round((end.getTime() - date.getTime()) / 86400000) + 1;
        return navigate(
          subDays(date, days),
          "custom",
          format(subDays(end, days), "yyyy-MM-dd")
        );
      }
      case "all":
        return;
    }
  };

  const goNext = () => {
    switch (range) {
      case "day":
        return navigate(addDays(date, 1));
      case "week":
        return navigate(addWeeks(date, 1));
      case "month":
        return navigate(addMonths(date, 1));
      case "year":
        return navigate(addYears(date, 1));
      case "custom": {
        const end = endDate ? parseISO(endDate) : date;
        const days =
          Math.round((end.getTime() - date.getTime()) / 86400000) + 1;
        return navigate(
          addDays(date, days),
          "custom",
          format(addDays(end, days), "yyyy-MM-dd")
        );
      }
      case "all":
        return;
    }
  };

  const isNextDisabled = () => {
    switch (range) {
      case "day":
        return currentDate >= today;
      case "week":
        return (
          format(endOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd") >= today
        );
      case "month":
        return format(endOfMonth(date), "yyyy-MM-dd") >= today;
      case "year":
        return format(endOfYear(date), "yyyy-MM-dd") >= today;
      case "custom":
        return (endDate ?? currentDate) >= today;
      case "all":
        return true;
    }
  };

  const getPeriodLabel = () => {
    switch (range) {
      case "week": {
        const start = startOfWeek(date, { weekStartsOn: 1 });
        const end = endOfWeek(date, { weekStartsOn: 1 });
        return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
      }
      case "month":
        return format(date, "MMMM yyyy");
      case "year":
        return format(date, "yyyy");
      case "all":
        return "All time";
      default:
        return null;
    }
  };

  const switchRange = (newRange: RangeType) => {
    navigate(
      date,
      newRange,
      newRange === "custom" ? format(date, "yyyy-MM-dd") : undefined
    );
  };

  const periodLabel = getPeriodLabel();

  return (
    <div className="py-2">
      {/* Range type selector */}
      <div className="mb-2 flex overflow-hidden rounded-md border border-gray-200 text-xs">
        {(["day", "week", "month", "year", "custom", "all"] as RangeType[]).map(
          (r) => (
            <button
              key={r}
              onClick={() => switchRange(r)}
              className={`flex-1 py-1 capitalize transition-colors ${
                range === r
                  ? "bg-blue-500 font-medium text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          )
        )}
      </div>

      {/* Navigation row */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          className={`rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 ${range === "all" ? "invisible" : ""}`}
          aria-label="Previous period"
        >
          &#8592;
        </button>

        {range === "day" && (
          <input
            type="date"
            value={currentDate}
            max={today}
            onChange={(e) => {
              if (e.target.value) navigate(parseISO(e.target.value));
            }}
            className="cursor-pointer rounded border-none bg-transparent text-center text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        )}

        {range === "custom" && (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={currentDate}
              max={endDate ?? today}
              onChange={(e) => {
                if (e.target.value)
                  navigate(parseISO(e.target.value), "custom", endDate);
              }}
              className="cursor-pointer rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <span className="text-xs text-gray-400">–</span>
            <input
              type="date"
              value={endDate ?? currentDate}
              min={currentDate}
              max={today}
              onChange={(e) => {
                if (e.target.value) navigate(date, "custom", e.target.value);
              }}
              className="cursor-pointer rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        )}

        {periodLabel && (
          <span className="text-sm font-medium text-gray-700">
            {periodLabel}
          </span>
        )}

        <button
          onClick={goNext}
          disabled={isNextDisabled()}
          className={`rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 ${range === "all" ? "invisible" : "disabled:cursor-not-allowed disabled:opacity-30"}`}
          aria-label="Next period"
        >
          &#8594;
        </button>
      </div>
    </div>
  );
}
