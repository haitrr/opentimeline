"use client";

import { useState } from "react";
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
import { useQuery } from "@tanstack/react-query";
import type { RangeType } from "@/app/timeline/[date]/page";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Trip = { id: number; name: string; startDate: string; endDate: string };

async function fetchTrips(): Promise<{ trips: Trip[] }> {
  const res = await fetch("/api/trips");
  if (!res.ok) throw new Error("Failed to fetch trips");
  return res.json();
}

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
  const [tripsOpen, setTripsOpen] = useState(false);
  const [tripSearch, setTripSearch] = useState("");
  const { data: tripsData } = useQuery({ queryKey: ["trips"], queryFn: fetchTrips });
  const trips = tripsData?.trips ?? [];
  const filteredTrips = trips.filter((t) =>
    t.name.toLowerCase().includes(tripSearch.toLowerCase())
  );

  const navigate = (d: Date, r?: RangeType, end?: string) => {
    const r2 = r ?? range;
    const dateStr = format(d, "yyyy-MM-dd");
    const params =
      r2 !== "day"
        ? `?range=${r2}${end ? `&end=${end}` : ""}`
        : "";
    router.push(`/timeline/${dateStr}${params}`);
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
      {/* Range type selector + trips picker */}
      <div className="mb-2 flex flex-wrap gap-1">
        {(["day", "week", "month", "year", "custom", "all"] as RangeType[]).map((r) => (
          <Button
            key={r}
            variant={range === r ? "default" : "outline"}
            size="sm"
            className="h-7 flex-1 text-xs capitalize"
            onClick={() => switchRange(r)}
          >
            {RANGE_LABELS[r]}
          </Button>
        ))}
        {trips.length > 0 && (
          <Popover open={tripsOpen} onOpenChange={setTripsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                Trips
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <div className="border-b p-2">
                <input
                  type="text"
                  placeholder="Search trips…"
                  value={tripSearch}
                  onChange={(e) => setTripSearch(e.target.value)}
                  className="w-full rounded border bg-transparent px-2 py-1.5 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Search trips"
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {filteredTrips.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No trips found</p>
                ) : (
                  filteredTrips.map((trip) => {
                    const start = trip.startDate.slice(0, 10);
                    const end = trip.endDate.slice(0, 10);
                    return (
                      <button
                        key={trip.id}
                        type="button"
                        className="flex w-full flex-col px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                        onClick={() => {
                          setTripsOpen(false);
                          setTripSearch("");
                          router.push(`/timeline/${start}?range=custom&end=${end}&fit=1`);
                        }}
                      >
                        <span className="truncate text-sm font-medium">{trip.name}</span>
                        <span className="text-xs text-muted-foreground">{start} – {end}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Navigation row */}
      <div className="flex flex-wrap items-center justify-between gap-1 sm:flex-nowrap">
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${range === "all" ? "invisible" : ""}`}
          onClick={goPrev}
          aria-label="Previous period"
        >
          &#8592;
        </Button>

        {range === "day" && (
          <input
            type="date"
            value={currentDate}
            max={today}
            onChange={(e) => {
              if (e.target.value) navigate(parseISO(e.target.value));
            }}
            className="min-w-0 flex-1 cursor-pointer rounded border-none bg-transparent text-center text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus-visible:ring-ring"
          />
        )}

        {range === "custom" && (
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-1 sm:w-auto">
            <input
              type="date"
              value={currentDate}
              max={endDate ?? today}
              onChange={(e) => {
                if (e.target.value) navigate(parseISO(e.target.value), "custom", endDate);
              }}
              className="min-w-0 cursor-pointer rounded border bg-transparent px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-2 focus-visible:ring-ring"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <input
              type="date"
              value={endDate ?? currentDate}
              min={currentDate}
              max={today}
              onChange={(e) => {
                if (e.target.value) navigate(date, "custom", e.target.value);
              }}
              className="min-w-0 cursor-pointer rounded border bg-transparent px-1 py-0.5 text-xs text-foreground focus:outline-none focus:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}

        {periodLabel && (
          <span className="text-sm font-medium text-foreground sm:text-center">
            {periodLabel}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${range === "all" ? "invisible" : ""}`}
          onClick={goNext}
          disabled={isNextDisabled()}
          aria-label="Next period"
        >
          &#8594;
        </Button>
      </div>

    </div>
  );
}
