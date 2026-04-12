import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { startOfDay, endOfDay } from "date-fns";
import type { SerializedPoint, DailyStats } from "@/lib/groupByHour";
import { assembleStats, type StatsGlobalsRow, type StatsBucketRow } from "@/lib/stats";

export const DECIMATION_THRESHOLD = 20_000;
export const DEFAULT_PAGE_LIMIT = 5_000;
export const MAX_PAGE_LIMIT = 10_000;

type GlobalsRawRow = {
  total_points: bigint;
  first_tst: number | bigint | null;
  last_tst: number | bigint | null;
  days_with_data: bigint;
  total_km: number | null;
};

type BucketRawRow = {
  bucket_key: string;
  bucket_start: Date;
  bucket_km: number | null;
};

export async function getStatsForRange(
  start: Date | undefined,
  end: Date | undefined,
  groupBy: "hour" | "day",
): Promise<DailyStats> {
  const hasRange = start !== undefined && end !== undefined;
  const whereClause = hasRange
    ? Prisma.sql`WHERE "recordedAt" BETWEEN ${start} AND ${end}`
    : Prisma.empty;
  const bucketFormat = groupBy === "hour" ? "HH24" : "YYYY-MM-DD";

  const globalsRows = await prisma.$queryRaw<GlobalsRawRow[]>(Prisma.sql`
    WITH ordered AS (
      SELECT
        tst,
        "recordedAt",
        lat,
        lon,
        LAG(lat) OVER (ORDER BY tst) AS prev_lat,
        LAG(lon) OVER (ORDER BY tst) AS prev_lon
      FROM "LocationPoint"
      ${whereClause}
    )
    SELECT
      COUNT(*)::bigint                                               AS total_points,
      MIN(tst)                                                       AS first_tst,
      MAX(tst)                                                       AS last_tst,
      COUNT(DISTINCT date_trunc('day', "recordedAt"))::bigint        AS days_with_data,
      COALESCE(SUM(
        CASE WHEN prev_lat IS NULL THEN 0
             ELSE 2 * 6371 * asin(sqrt(
               power(sin(radians(lat - prev_lat) / 2), 2) +
               cos(radians(prev_lat)) * cos(radians(lat)) *
               power(sin(radians(lon - prev_lon) / 2), 2)
             ))
        END
      ), 0)::double precision                                        AS total_km
    FROM ordered;
  `);

  const bucketRows = await prisma.$queryRaw<BucketRawRow[]>(Prisma.sql`
    WITH ordered AS (
      SELECT
        tst,
        "recordedAt",
        lat,
        lon,
        LAG(lat) OVER (ORDER BY tst) AS prev_lat,
        LAG(lon) OVER (ORDER BY tst) AS prev_lon,
        to_char("recordedAt", ${bucketFormat})                                AS bucket_key,
        LAG(to_char("recordedAt", ${bucketFormat})) OVER (ORDER BY tst)       AS prev_bucket_key
      FROM "LocationPoint"
      ${whereClause}
    )
    SELECT
      bucket_key,
      MIN("recordedAt")                                              AS bucket_start,
      COALESCE(SUM(
        CASE
          WHEN prev_lat IS NULL OR prev_bucket_key IS NULL OR prev_bucket_key <> bucket_key THEN 0
          ELSE 2 * 6371 * asin(sqrt(
            power(sin(radians(lat - prev_lat) / 2), 2) +
            cos(radians(prev_lat)) * cos(radians(lat)) *
            power(sin(radians(lon - prev_lon) / 2), 2)
          ))
        END
      ), 0)::double precision                                        AS bucket_km
    FROM ordered
    GROUP BY bucket_key
    ORDER BY bucket_key;
  `);

  const globals: StatsGlobalsRow = globalsRows[0]
    ? {
        totalPoints: Number(globalsRows[0].total_points),
        firstTst: globalsRows[0].first_tst !== null ? Number(globalsRows[0].first_tst) : null,
        lastTst: globalsRows[0].last_tst !== null ? Number(globalsRows[0].last_tst) : null,
        daysWithData: Number(globalsRows[0].days_with_data),
        totalKm: globalsRows[0].total_km ?? 0,
      }
    : { totalPoints: 0, firstTst: null, lastTst: null, daysWithData: 0, totalKm: 0 };

  const buckets: StatsBucketRow[] = bucketRows.map((b) => ({
    bucketKey: b.bucket_key,
    bucketStart: b.bucket_start,
    bucketKm: b.bucket_km ?? 0,
  }));

  return assembleStats(globals, buckets, groupBy);
}

export async function getPointsForDate(date: Date): Promise<SerializedPoint[]> {
  return getPointsForRange(startOfDay(date), endOfDay(date));
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
