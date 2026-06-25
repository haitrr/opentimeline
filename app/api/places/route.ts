import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo";
import { detectVisitsForPlace } from "@/lib/detectVisits";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 10000;
const VALID_SORTS = ["recent", "visits", "name", "time_spent"] as const;
type Sort = (typeof VALID_SORTS)[number];

type PlaceRow = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  isActive: boolean;
  createdAt: Date;
  parentId: number | null;
  parentName: string | null;
  childCount: bigint | number;
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
  const tag = sp.get("tag")?.trim().toLowerCase() || null;
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

  const parentIdParam = sp.get("parentId");
  const parentIdFilter: number | null =
    parentIdParam != null ? Number.parseInt(parentIdParam, 10) : null;

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
  if (tag) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "PlaceTag" pt
        JOIN "Tag" t ON t.id = pt."tagId"
        WHERE pt."placeId" = p.id AND LOWER(t.name) = ${tag}
      )`
    );
  }
  if (parentIdFilter != null) {
    conditions.push(Prisma.sql`p."parentId" = ${parentIdFilter}`);
  }
  const whereClause = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;

  let orderBy: Prisma.Sql;
  if (sort === "name") {
    orderBy = Prisma.sql`p.name ASC, p.id DESC`;
  } else if (sort === "visits") {
    orderBy = Prisma.sql`v_counts.confirmed DESC NULLS LAST, p.id DESC`;
  } else if (sort === "time_spent") {
    orderBy = Prisma.sql`time_spent_agg.total_seconds DESC NULLS LAST, p.id DESC`;
  } else {
    orderBy = Prisma.sql`last_confirmed.last_at DESC NULLS LAST, p.id DESC`;
  }

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<PlaceRow[]>`
      SELECT
        p.id,
        p.name,
        p.lat,
        p.lon,
        p.radius,
        p."isActive",
        p."createdAt",
        p."parentId",
        parent.name AS "parentName",
        COALESCE(child_counts.child_count, 0) AS "childCount",
        last_confirmed.last_at AS "lastVisitAt",
        COALESCE(v_counts.confirmed, 0) AS "confirmedVisits",
        COALESCE(v_counts.total, 0) AS "totalVisits"
      FROM "Place" p
      LEFT JOIN "Place" parent ON parent.id = p."parentId"
      LEFT JOIN (
        SELECT "parentId", COUNT(*) AS child_count
        FROM "Place"
        WHERE "parentId" IS NOT NULL
        GROUP BY "parentId"
      ) child_counts ON child_counts."parentId" = p.id
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
      LEFT JOIN (
        SELECT "placeId", SUM(EXTRACT(EPOCH FROM ("departureAt" - "arrivalAt"))) AS total_seconds
        FROM "Visit"
        WHERE status = 'confirmed'
        GROUP BY "placeId"
      ) time_spent_agg ON time_spent_agg."placeId" = p.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ${limit + 1} OFFSET ${offset}
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count
      FROM "Place" p
      ${whereClause}
    `,
  ]);

  const total = Number(countRows[0]?.count ?? 0);
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

  const tagsByPlaceId = new Map<number, string[]>();
  if (placeIds.length > 0) {
    const placeTags = await prisma.placeTag.findMany({
      where: { placeId: { in: placeIds } },
      select: { placeId: true, tag: { select: { name: true } } },
    });
    for (const pt of placeTags) {
      const existing = tagsByPlaceId.get(pt.placeId) ?? [];
      existing.push(pt.tag.name);
      tagsByPlaceId.set(pt.placeId, existing);
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
      parentId: r.parentId,
      parentName: r.parentName ?? null,
      childCount: Number(r.childCount),
      totalVisits: Number(r.totalVisits),
      confirmedVisits: Number(r.confirmedVisits),
      visitsInRange: inR.confirmed + inR.suggested,
      confirmedVisitsInRange: inR.confirmed,
      suggestedVisitsInRange: inR.suggested,
      lastVisitAt: r.lastVisitAt ? r.lastVisitAt.toISOString() : null,
      tags: tagsByPlaceId.get(r.id) ?? [],
    };
  });

  return NextResponse.json({ places, nextOffset, total });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, lat, lon, radius, supersedesVisitId, parentId } = body;

  if (!name || lat == null || lon == null) {
    return NextResponse.json(
      { error: "name, lat, and lon are required" },
      { status: 400 }
    );
  }

  const place = await prisma.place.create({
    data: {
      name: String(name),
      lat: Number(lat),
      lon: Number(lon),
      radius: radius != null ? Number(radius) : 50,
      ...(parentId != null ? { parentId: Number(parentId) } : {}),
    },
  });

  // Sub-places are annotation-only — skip visit detection and unknown suggestion dismissal.
  if (parentId != null) {
    return NextResponse.json({ place }, { status: 201 });
  }

  let supersededVisit: {
    id: number;
    placeId: number;
    arrivalAt: Date;
    departureAt: Date;
    pointCount: number;
  } | null = null;
  if (supersedesVisitId != null) {
    const id = Number(supersedesVisitId);
    if (Number.isInteger(id)) {
      supersededVisit = await prisma.visit.findUnique({
        where: { id },
        select: { id: true, placeId: true, arrivalAt: true, departureAt: true, pointCount: true },
      });
    }
  }

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

    // Remove any other suggestions at the original place that overlap the same
    // time range — they would otherwise linger alongside the new place's suggestions.
    await prisma.visit.deleteMany({
      where: {
        placeId: supersededVisit.placeId,
        status: "suggested",
        arrivalAt: { lt: supersededVisit.departureAt },
        departureAt: { gt: supersededVisit.arrivalAt },
      },
    });
  }

  await detectVisitsForPlace(place.id);

  // After detection, remove overlapping suggestions at OTHER places for the same
  // time windows — the new place wins those time ranges now.
  const newSuggestions = await prisma.visit.findMany({
    where: { placeId: place.id, status: "suggested" },
    select: { arrivalAt: true, departureAt: true },
  });
  for (const s of newSuggestions) {
    await prisma.visit.deleteMany({
      where: {
        NOT: { placeId: place.id },
        status: "suggested",
        arrivalAt: { lt: s.departureAt },
        departureAt: { gt: s.arrivalAt },
      },
    });
  }

  // Also clean up suggestions at the new place that duplicate the confirmed
  // transplanted time range (detection may produce slightly different interpolated times).
  if (supersededVisit) {
    await prisma.visit.deleteMany({
      where: {
        placeId: place.id,
        status: "suggested",
        arrivalAt: { lt: supersededVisit.departureAt },
        departureAt: { gt: supersededVisit.arrivalAt },
      },
    });
  }

  return NextResponse.json({ place }, { status: 201 });
}
