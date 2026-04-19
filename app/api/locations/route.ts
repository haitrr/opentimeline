import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DECIMATION_THRESHOLD, haversineKmSql } from "@/lib/locations";
import { buildDeviceFilterSql } from "@/lib/device-filters";

type PointRow = {
  id: number;
  lat: number;
  lon: number;
  tst: number;
  recordedAt: Date;
  acc: number | null;
  batt: number | null;
  tid: string | null;
  alt: number | null;
  vel: number | null;
  deviceId: string | null;
};

function parseRequired(searchParams: URLSearchParams, key: string): string | null {
  const v = searchParams.get(key);
  return v === null || v === "" ? null : v;
}

function parseNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string | null): Date | null {
  if (raw === null) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseBool(raw: string | null): boolean {
  return raw === "true" || raw === "1";
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const start = parseDate(parseRequired(searchParams, "start"));
  const end = parseDate(parseRequired(searchParams, "end"));
  const minLat = parseNumber(parseRequired(searchParams, "minLat"));
  const maxLat = parseNumber(parseRequired(searchParams, "maxLat"));
  const minLon = parseNumber(parseRequired(searchParams, "minLon"));
  const maxLon = parseNumber(parseRequired(searchParams, "maxLon"));

  if (!start || !end || minLat === null || maxLat === null || minLon === null || maxLon === null) {
    return NextResponse.json(
      { error: "Missing or invalid required params: start, end, minLat, maxLat, minLon, maxLon" },
      { status: 400 },
    );
  }

  const skipBoundsIfSmall = parseBool(searchParams.get("skipBoundsIfSmall"));

  const deviceFilters = await prisma.deviceFilter.findMany();
  const deviceFilterSql = buildDeviceFilterSql(deviceFilters);

  const selectCols = Prisma.sql`id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel, "deviceId"`;

  if (skipBoundsIfSmall) {
    const timeWhere = Prisma.sql`"recordedAt" BETWEEN ${start} AND ${end} AND ${deviceFilterSql}`;

    const timeCountRows = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS total
      FROM "LocationPoint"
      WHERE ${timeWhere};
    `;
    const timeTotal = Number(timeCountRows[0]?.total ?? BigInt(0));

    if (timeTotal <= DECIMATION_THRESHOLD) {
      const rows = await prisma.$queryRaw<PointRow[]>`
        SELECT ${selectCols}
        FROM "LocationPoint"
        WHERE ${timeWhere}
        ORDER BY tst, id;
      `;

      return NextResponse.json({
        points: rows.map(serializeRow),
        decimated: false,
        boundsIgnored: true,
        total: timeTotal,
      });
    }
  }

  const where = Prisma.sql`
    "recordedAt" BETWEEN ${start} AND ${end}
    AND lat BETWEEN ${minLat} AND ${maxLat}
    AND lon BETWEEN ${minLon} AND ${maxLon}
    AND ${deviceFilterSql}
  `;

  const countRows = await prisma.$queryRaw<{ total: bigint; total_km: number | null }[]>`
    WITH lagged AS (
      SELECT lat, lon,
        LAG(lat) OVER (ORDER BY tst) AS prev_lat,
        LAG(lon) OVER (ORDER BY tst) AS prev_lon
      FROM "LocationPoint"
      WHERE ${where}
    )
    SELECT
      COUNT(*)::bigint AS total,
      COALESCE(SUM(${haversineKmSql}), 0)::double precision AS total_km
    FROM lagged;
  `;
  const total = Number(countRows[0]?.total ?? BigInt(0));
  const totalKm = Number(countRows[0]?.total_km ?? 0);

  const STATIONARY_EPSILON_KM = 0.001;

  if (total > DECIMATION_THRESHOLD) {
    if (totalKm < STATIONARY_EPSILON_KM) {
      const stride = Math.ceil(total / DECIMATION_THRESHOLD);
      const rows = await prisma.$queryRaw<PointRow[]>`
        SELECT ${selectCols}
        FROM (
          SELECT ${selectCols}, ROW_NUMBER() OVER (ORDER BY tst) AS rn
          FROM "LocationPoint"
          WHERE ${where}
        ) AS sub
        WHERE (rn - 1) % ${stride} = 0
        ORDER BY tst;
      `;

      return NextResponse.json({
        points: rows.map(serializeRow),
        decimated: true,
        boundsIgnored: false,
        total,
      });
    }

    const bucketKm = totalKm / DECIMATION_THRESHOLD;
    const rows = await prisma.$queryRaw<PointRow[]>`
      WITH lagged AS (
        SELECT id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel, "deviceId",
          LAG(lat) OVER (ORDER BY tst) AS prev_lat,
          LAG(lon) OVER (ORDER BY tst) AS prev_lon
        FROM "LocationPoint"
        WHERE ${where}
      ),
      ordered AS (
        SELECT id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel, "deviceId",
          SUM(${haversineKmSql}) OVER (ORDER BY tst) AS cum_km
        FROM lagged
      ),
      bucketed AS (
        SELECT id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel, "deviceId",
          floor(cum_km / ${bucketKm})::bigint AS bucket,
          LAG(floor(cum_km / ${bucketKm})::bigint) OVER (ORDER BY tst) AS prev_bucket
        FROM ordered
      )
      SELECT ${selectCols}
      FROM bucketed
      WHERE prev_bucket IS NULL OR bucket <> prev_bucket
      ORDER BY tst;
    `;

    return NextResponse.json({
      points: rows.map(serializeRow),
      decimated: true,
      boundsIgnored: false,
      total,
    });
  }

  const rows = await prisma.$queryRaw<PointRow[]>`
    SELECT ${selectCols}
    FROM "LocationPoint"
    WHERE ${where}
    ORDER BY tst, id;
  `;

  return NextResponse.json({
    points: rows.map(serializeRow),
    decimated: false,
    boundsIgnored: false,
    total,
  });
}

function serializeRow(r: PointRow) {
  return {
    id: r.id,
    lat: r.lat,
    lon: r.lon,
    tst: r.tst,
    recordedAt: r.recordedAt.toISOString(),
    acc: r.acc,
    batt: r.batt,
    tid: r.tid,
    alt: r.alt,
    vel: r.vel,
    deviceId: r.deviceId,
  };
}
