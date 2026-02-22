import { notFound } from "next/navigation";
import { getPointsForDate } from "@/lib/locations";
import { computeDailyStats } from "@/lib/groupByHour";
import TimelineLayout from "@/components/TimelineLayout";

type Props = { params: Promise<{ date: string }> };

export default async function TimelineDatePage({ params }: Props) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (isNaN(parsedDate.getTime())) notFound();

  const points = await getPointsForDate(parsedDate);
  const stats = computeDailyStats(points);

  return <TimelineLayout date={date} points={points} stats={stats} />;
}
