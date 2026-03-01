import { NextRequest, NextResponse } from "next/server";
import { getPointsForDate, getPointsForRange, getAllPoints } from "@/lib/locations";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("all") === "true") {
    const points = await getAllPoints();
    return NextResponse.json(points);
  }

  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  if (startParam && endParam) {
    const start = new Date(startParam);
    const end = new Date(endParam);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const points = await getPointsForRange(start, end);
    return NextResponse.json(points);
  }

  const dateParam = searchParams.get("date");
  const dateStr = dateParam ?? format(new Date(), "yyyy-MM-dd");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD" }, { status: 400 });
  }

  const points = await getPointsForDate(new Date(`${dateStr}T00:00:00`));
  return NextResponse.json(points);
}
