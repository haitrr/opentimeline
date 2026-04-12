import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DECIMATION_THRESHOLD,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "@/lib/locations";

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

  const limitRaw = parseNumber(searchParams.get("limit"));
  const limit = Math.max(
    1,
    Math.min(MAX_PAGE_LIMIT, limitRaw ?? DEFAULT_PAGE_LIMIT),
  );
  const cursor = parseNumber(searchParams.get("cursor"));

  const where = Prisma.sql`
    "recordedAt" BETWEEN ${start} AND ${end}
    AND lat BETWEEN ${minLat} AND ${maxLat}
    AND lon BETWEEN ${minLon} AND ${maxLon}
  `;

  const countRows = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total
    FROM "LocationPoint"
    WHERE ${where};
  `);
  const total = Number(countRows[0]?.total ?? BigInt(0));

  const selectCols = Prisma.sql`id, lat, lon, tst, "recordedAt", acc, batt, tid, alt, vel`;

  if (total > DECIMATION_THRESHOLD) {
    const stride = Math.ceil(total / DECIMATION_THRESHOLD);
    const rows = await prisma.$queryRaw<PointRow[]>(Prisma.sql`
      SELECT ${selectCols}
      FROM (
        SELECT ${selectCols}, ROW_NUMBER() OVER (ORDER BY tst) AS rn
        FROM "LocationPoint"
        WHERE ${where}
      ) AS sub
      WHERE rn % ${stride} = 0
      ORDER BY tst;
    `);

    return NextResponse.json({
      points: rows.map(serializeRow),
      nextCursor: null,
      decimated: true,
      total,
    });
  }

  const cursorClause = cursor !== null ? Prisma.sql`AND id > ${cursor}` : Prisma.empty;
  const rows = await prisma.$queryRaw<PointRow[]>(Prisma.sql`
    SELECT ${selectCols}
    FROM "LocationPoint"
    WHERE ${where}
    ${cursorClause}
    ORDER BY id
    LIMIT ${limit};
  `);

  const nextCursor = total >= limit ? (rows[rows.length - 1]?.id ?? null) : null;

  return NextResponse.json({
    points: rows.map(serializeRow),
    nextCursor,
    decimated: false,
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
  };
}
