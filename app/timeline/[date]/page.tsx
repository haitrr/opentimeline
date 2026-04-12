import { notFound } from "next/navigation";
import { getStatsForRange } from "@/lib/locations";
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

  const groupBy = rangeType === "day" ? "hour" : "day";

  let rangeStart: string | undefined;
  let rangeEnd: string | undefined;
  let stats;
  if (rangeType === "all") {
    rangeStart = new Date(0).toISOString();
    rangeEnd = new Date().toISOString();
    stats = await getStatsForRange(undefined, undefined, groupBy);
  } else {
    const { start, end: rangeBoundEnd } = getRangeBounds(parsedDate, rangeType, end);
    rangeStart = start.toISOString();
    rangeEnd = rangeBoundEnd.toISOString();
    stats = await getStatsForRange(start, rangeBoundEnd, groupBy);
  }

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
