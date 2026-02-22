import { notFound } from "next/navigation";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  parseISO,
} from "date-fns";
import { getPointsForRange, getAllPoints } from "@/lib/locations";
import { computePeriodStats } from "@/lib/groupByHour";
import TimelineLayout from "@/components/TimelineLayout";

export type RangeType = "day" | "week" | "month" | "year" | "custom" | "all";

const VALID_RANGES: RangeType[] = ["day", "week", "month", "year", "custom", "all"];

function getRangeBounds(date: Date, rangeType: RangeType, endDateStr?: string) {
  switch (rangeType) {
    case "week":
      return {
        start: startOfWeek(date, { weekStartsOn: 1 }),
        end: endOfWeek(date, { weekStartsOn: 1 }),
      };
    case "month":
      return { start: startOfMonth(date), end: endOfMonth(date) };
    case "year":
      return { start: startOfYear(date), end: endOfYear(date) };
    case "custom": {
      const endDate = endDateStr ? parseISO(endDateStr) : date;
      return { start: startOfDay(date), end: endOfDay(endDate) };
    }
    default:
      return { start: startOfDay(date), end: endOfDay(date) };
  }
}

type Props = {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ range?: string; end?: string }>;
};

export default async function TimelineDatePage({ params, searchParams }: Props) {
  const { date } = await params;
  const { range, end } = await searchParams;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (isNaN(parsedDate.getTime())) notFound();

  const rangeType: RangeType = VALID_RANGES.includes(range as RangeType)
    ? (range as RangeType)
    : "day";

  let points;
  if (rangeType === "all") {
    points = await getAllPoints();
  } else {
    const { start, end: rangeEnd } = getRangeBounds(parsedDate, rangeType, end);
    points = await getPointsForRange(start, rangeEnd);
  }
  const stats = computePeriodStats(points, rangeType === "day" ? "hour" : "day");

  return (
    <TimelineLayout
      date={date}
      range={rangeType}
      endDate={end}
      points={points}
      stats={stats}
    />
  );
}
