import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import type { SerializedPoint } from "@/lib/groupByHour";

export async function getPointsForDate(date: Date): Promise<SerializedPoint[]> {
  return getPointsForRange(startOfDay(date), endOfDay(date));
}

export async function getAllPoints(): Promise<SerializedPoint[]> {
  const points = await prisma.locationPoint.findMany({
    orderBy: { tst: "asc" },
    select: {
      id: true,
      lat: true,
      lon: true,
      tst: true,
      recordedAt: true,
      acc: true,
      batt: true,
      tid: true,
      alt: true,
      vel: true,
    },
  });

  return points.map((p) => ({
    ...p,
    recordedAt: p.recordedAt.toISOString(),
  }));
}

export async function getPointsForRange(
  start: Date,
  end: Date
): Promise<SerializedPoint[]> {
  const points = await prisma.locationPoint.findMany({
    where: {
      recordedAt: {
        gte: start,
        lte: end,
      },
    },
    orderBy: { tst: "asc" },
    select: {
      id: true,
      lat: true,
      lon: true,
      tst: true,
      recordedAt: true,
      acc: true,
      batt: true,
      tid: true,
      alt: true,
      vel: true,
    },
  });

  return points.map((p) => ({
    ...p,
    recordedAt: p.recordedAt.toISOString(),
  }));
}
