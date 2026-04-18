import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 10000;
const VALID_SORTS = ["recent", "visits", "name"] as const;
type Sort = (typeof VALID_SORTS)[number];

type PlaceRow = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  isActive: boolean;
  createdAt: Date;
  lastVisitAt: Date | null;
  confirmedVisits: bigint | number;
  totalVisits: bigint | number;
};

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const startParam = sp.get("start");
  const endParam = sp.get("end");
  const minLat = sp.get("minLat");
  const maxLat = sp.get("maxLat");
  const minLon = sp.get("minLon");
  const maxLon = sp.get("maxLon");
  const q = sp.get("q")?.trim() || null;
  const sortRaw = sp.get("sort");
  const sort: Sort = VALID_SORTS.includes(sortRaw as Sort)
    ? (sortRaw as Sort)
    : "recent";

  const limitRaw = sp.get("limit");
  const offsetRaw = sp.get("offset");
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, limitRaw ? Number.parseInt(limitRaw, 10) || DEFAULT_LIMIT : DEFAULT_LIMIT)
  );
  const offset = Math.max(0, offsetRaw ? Number.parseInt(offsetRaw, 10) || 0 : 0);

  const start = startParam ? new Date(startParam) : null;
  const end = endParam ? new Date(endParam) : null;
  const hasValidRange =
    start != null &&
    end != null &&
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime());

  const conditions: Prisma.Sql[] = [];
  if (minLat != null && maxLat != null && minLon != null && maxLon != null) {
    conditions.push(
      Prisma.sql`p.lat BETWEEN ${Number.parseFloat(minLat)} AND ${Number.parseFloat(maxLat)}`
    );
    conditions.push(
      Prisma.sql`p.lon BETWEEN ${Number.parseFloat(minLon)} AND ${Number.parseFloat(maxLon)}`
    );
  }
  if (q) {
    conditions.push(Prisma.sql`LOWER(p.name) LIKE ${"%" + q.toLowerCase() + "%"}`);
  }
  const whereClause = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;

  let orderBy: Prisma.Sql;
  if (sort === "name") {
    orderBy = Prisma.sql`p.name ASC, p.id DESC`;
  } else if (sort === "visits") {
    orderBy = Prisma.sql`v_counts.confirmed DESC NULLS LAST, p.id DESC`;
  } else {
    orderBy = Prisma.sql`last_confirmed.last_at DESC NULLS LAST, p.id DESC`;
  }

  const rows = await prisma.$queryRaw<PlaceRow[]>`
    SELECT
      p.id,
      p.name,
      p.lat,
      p.lon,
      p.radius,
      p."isActive",
      p."createdAt",
      last_confirmed.last_at AS "lastVisitAt",
      COALESCE(v_counts.confirmed, 0) AS "confirmedVisits",
      COALESCE(v_counts.total, 0) AS "totalVisits"
    FROM "Place" p
    LEFT JOIN (
      SELECT "placeId", MAX("departureAt") AS last_at
      FROM "Visit"
      WHERE status = 'confirmed'
      GROUP BY "placeId"
    ) last_confirmed ON last_confirmed."placeId" = p.id
    LEFT JOIN (
      SELECT
        "placeId",
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed
      FROM "Visit"
      GROUP BY "placeId"
    ) v_counts ON v_counts."placeId" = p.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${limit + 1} OFFSET ${offset}
  `;

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextOffset = hasMore ? offset + limit : null;

  const placeIds = pageRows.map((r) => r.id);
  const inRangeMap = new Map<number, { confirmed: number; suggested: number }>();
  if (hasValidRange && placeIds.length > 0) {
    const grouped = await prisma.visit.groupBy({
      by: ["placeId", "status"],
      where: {
        placeId: { in: placeIds },
        status: { in: ["confirmed", "suggested"] },
        arrivalAt: { lte: end! },
        departureAt: { gte: start! },
      },
      _count: { _all: true },
    });
    for (const row of grouped) {
      const entry = inRangeMap.get(row.placeId) ?? { confirmed: 0, suggested: 0 };
      if (row.status === "confirmed") entry.confirmed = row._count._all;
      else if (row.status === "suggested") entry.suggested = row._count._all;
      inRangeMap.set(row.placeId, entry);
    }
  }

  const places = pageRows.map((r) => {
    const inR = inRangeMap.get(r.id) ?? { confirmed: 0, suggested: 0 };
    return {
      id: r.id,
      name: r.name,
      lat: r.lat,
      lon: r.lon,
      radius: r.radius,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      totalVisits: Number(r.totalVisits),
      confirmedVisits: Number(r.confirmedVisits),
      visitsInRange: inR.confirmed + inR.suggested,
      confirmedVisitsInRange: inR.confirmed,
      suggestedVisitsInRange: inR.suggested,
      lastVisitAt: r.lastVisitAt ? r.lastVisitAt.toISOString() : null,
    };
  });

  return NextResponse.json({ places, nextOffset });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, lat, lon, radius, supersedesVisitId } = body;

  if (!name || lat == null || lon == null) {
    return NextResponse.json(
      { error: "name, lat, and lon are required" },
      { status: 400 }
    );
  }

  let supersededVisit: {
    id: number;
    arrivalAt: Date;
    departureAt: Date;
    pointCount: number;
  } | null = null;
  if (supersedesVisitId != null) {
    const id = Number(supersedesVisitId);
    if (Number.isInteger(id)) {
      supersededVisit = await prisma.visit.findUnique({
        where: { id },
        select: { id: true, arrivalAt: true, departureAt: true, pointCount: true },
      });
    }
  }

  const place = await prisma.place.create({
    data: {
      name: String(name),
      lat: Number(lat),
      lon: Number(lon),
      radius: radius != null ? Number(radius) : 50,
    },
  });

  // Dismiss any unknown visit suggestions whose cluster center falls within
  // the new place's radius, before running visit detection to avoid duplicates.
  const placeRadiusKm = place.radius / 1000;
  const unknownSuggestions = await prisma.unknownVisitSuggestion.findMany({
    where: { status: "suggested" },
  });
  const overlapping = unknownSuggestions.filter(
    (s: (typeof unknownSuggestions)[number]) =>
      haversineKm(s.lat, s.lon, place.lat, place.lon) <= placeRadiusKm
  );
  if (overlapping.length > 0) {
    await prisma.unknownVisitSuggestion.updateMany({
      where: {
        id: { in: overlapping.map((s: (typeof overlapping)[number]) => s.id) },
      },
      data: { status: "confirmed" },
    });
  }

  // Transplant the superseded suggestion's exact time range as a confirmed
  // visit at the new place before detection runs, so the narrower radius
  // can't split it into multiple overlapping candidates.
  if (supersededVisit) {
    await prisma.visit.create({
      data: {
        placeId: place.id,
        arrivalAt: supersededVisit.arrivalAt,
        departureAt: supersededVisit.departureAt,
        status: "confirmed",
        pointCount: supersededVisit.pointCount,
      },
    });
    await prisma.visit.delete({ where: { id: supersededVisit.id } });
  }

  return NextResponse.json({ place }, { status: 201 });
}
