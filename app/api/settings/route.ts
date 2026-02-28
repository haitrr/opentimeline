import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULTS = {
  sessionGapMinutes: 15,
  minDwellMinutes: 15,
  postDepartureMinutes: 15,
  unknownClusterRadiusM: 50,
  unknownSessionGapMinutes: 15,
  unknownMinDwellMinutes: 15,
};

export async function GET() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  return NextResponse.json(settings ?? DEFAULTS);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const sessionGapMinutes = Math.max(1, Number(body.sessionGapMinutes) || DEFAULTS.sessionGapMinutes);
  const minDwellMinutes = Math.max(1, Number(body.minDwellMinutes) || DEFAULTS.minDwellMinutes);
  const postDepartureMinutes = Math.max(1, Number(body.postDepartureMinutes) || DEFAULTS.postDepartureMinutes);
  const unknownClusterRadiusM = Math.max(1, Number(body.unknownClusterRadiusM) || DEFAULTS.unknownClusterRadiusM);
  const unknownSessionGapMinutes = Math.max(1, Number(body.unknownSessionGapMinutes) || DEFAULTS.unknownSessionGapMinutes);
  const unknownMinDwellMinutes = Math.max(1, Number(body.unknownMinDwellMinutes) || DEFAULTS.unknownMinDwellMinutes);

  const settings = await prisma.appSettings.upsert({
    where: { id: 1 },
    update: { sessionGapMinutes, minDwellMinutes, postDepartureMinutes, unknownClusterRadiusM, unknownSessionGapMinutes, unknownMinDwellMinutes },
    create: { id: 1, sessionGapMinutes, minDwellMinutes, postDepartureMinutes, unknownClusterRadiusM, unknownSessionGapMinutes, unknownMinDwellMinutes },
  });

  return NextResponse.json(settings);
}
