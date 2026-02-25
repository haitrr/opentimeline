import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineKm, hasEvidenceOfLeavingInGap } from "@/lib/geo";

const DAY_BUFFER_MS = 5 * 24 * 60 * 60 * 1000;
const MAX_GAP_MINUTES = 15;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");
  const radiusM = parseFloat(searchParams.get("radiusM") ?? "");
  const rangeStart = searchParams.get("rangeStart");
  const rangeEnd = searchParams.get("rangeEnd");

  if (isNaN(lat) || isNaN(lon) || isNaN(radiusM)) {
    return NextResponse.json({ error: "lat, lon, radiusM are required" }, { status: 400 });
  }

  const radiusKm = radiusM / 1000;

  const allPoints = await prisma.locationPoint.findMany({
    orderBy: { recordedAt: "asc" },
    select: { lat: true, lon: true, recordedAt: true },
    where:
      rangeStart || rangeEnd
        ? {
            AND: [
              ...(rangeStart
                ? [{ recordedAt: { gte: new Date(new Date(rangeStart).getTime() - DAY_BUFFER_MS) } }]
                : []),
              ...(rangeEnd
                ? [{ recordedAt: { lte: new Date(new Date(rangeEnd).getTime() + DAY_BUFFER_MS) } }]
                : []),
            ],
          }
        : undefined,
  });

  const nearby = allPoints
    .filter((p) => haversineKm(p.lat, p.lon, lat, lon) <= radiusKm)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (nearby.length === 0) return NextResponse.json([]);

  const timeWindowMs = MAX_GAP_MINUTES * 60 * 1000;
  const groups: { arrivalAt: Date; departureAt: Date; pointCount: number }[] = [];
  let group = [nearby[0]];

  for (let i = 1; i < nearby.length; i++) {
    const gapMs =
      new Date(nearby[i].recordedAt).getTime() - new Date(nearby[i - 1].recordedAt).getTime();

    if (gapMs <= timeWindowMs) {
      group.push(nearby[i]);
    } else {
      const prevTime = new Date(nearby[i - 1].recordedAt).getTime();
      const currTime = new Date(nearby[i].recordedAt).getTime();
      if (hasEvidenceOfLeavingInGap(allPoints, prevTime, currTime, lat, lon, radiusKm)) {
        const arrival = new Date(group[0].recordedAt);
        const departure = new Date(group[group.length - 1].recordedAt);
        if (arrival.getTime() === departure.getTime()) {
          arrival.setMinutes(arrival.getMinutes() - 1);
          departure.setMinutes(departure.getMinutes() + 1);
        }
        groups.push({ arrivalAt: arrival, departureAt: departure, pointCount: group.length });
        group = [nearby[i]];
      } else {
        group.push(nearby[i]);
      }
    }
  }

  const lastArrival = new Date(group[0].recordedAt);
  const lastDeparture = new Date(group[group.length - 1].recordedAt);
  if (lastArrival.getTime() === lastDeparture.getTime()) {
    lastArrival.setMinutes(lastArrival.getMinutes() - 1);
    lastDeparture.setMinutes(lastDeparture.getMinutes() + 1);
  }
  groups.push({ arrivalAt: lastArrival, departureAt: lastDeparture, pointCount: group.length });

  // Only keep periods where arrival or departure falls within the requested range
  const start = rangeStart ? new Date(rangeStart) : null;
  const end = rangeEnd ? new Date(rangeEnd) : null;
  const filtered = groups.filter((g) => {
    if (!start && !end) return true;
    const arrivalInRange = (!start || g.arrivalAt >= start) && (!end || g.arrivalAt <= end);
    const departureInRange = (!start || g.departureAt >= start) && (!end || g.departureAt <= end);
    const coversRange = (!start || g.arrivalAt <= start) && (!end || g.departureAt >= end);
    return arrivalInRange || departureInRange || coversRange;
  });

  // Most recent first
  filtered.sort((a, b) => b.arrivalAt.getTime() - a.arrivalAt.getTime());

  return NextResponse.json(
    filtered.map((g) => ({
      arrivalAt: g.arrivalAt.toISOString(),
      departureAt: g.departureAt.toISOString(),
      pointCount: g.pointCount,
    }))
  );
}
