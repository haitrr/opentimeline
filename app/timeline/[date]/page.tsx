import { notFound } from "next/navigation";
import { getPointsForRange, getAllPoints } from "@/lib/locations";
import { computePeriodStats } from "@/lib/groupByHour";
import { getRangeBounds } from "@/lib/getRangeBounds";
import DateNav from "@/components/DateNav";
import DailyStats from "@/components/DailyStats";
import TimelineSidebar from "@/components/TimelineSidebar";

export type RangeType = "day" | "week" | "month" | "year" | "custom" | "all";

const VALID_RANGES: RangeType[] = ["day", "week", "month", "year", "custom", "all"];

type Props = {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ range?: string; end?: string }>;
};

export default async function TimelineDatePage({ params, searchParams }: Props) {
  const { date } = await params;
  const { range, end } = await searchParams;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const parsedDate = new Date(`${date}T00:00:00`);
  if (isNaN(parsedDate.getTime())) notFound();

  const rangeType: RangeType = VALID_RANGES.includes(range as RangeType)
    ? (range as RangeType)
    : "day";

  let points;
  let rangeStart: string | undefined;
  let rangeEnd: string | undefined;
  if (rangeType === "all") {
    points = await getAllPoints();
  } else {
    const { start, end: rangeBoundEnd } = getRangeBounds(parsedDate, rangeType, end);
    rangeStart = start.toISOString();
    rangeEnd = rangeBoundEnd.toISOString();
    points = await getPointsForRange(start, rangeBoundEnd);
  }
  const stats = computePeriodStats(points, rangeType === "day" ? "hour" : "day");

  return (
    <>
      <div className="border-b border-gray-200 px-4">
        <DateNav currentDate={date} range={rangeType} endDate={end} />
      </div>
      <DailyStats stats={stats} range={rangeType} />
      <TimelineSidebar rangeStart={rangeStart} rangeEnd={rangeEnd} />
    </>
  );
}
