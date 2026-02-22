import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const visits = await prisma.visit.findMany({
    where: status ? { status } : undefined,
    include: {
      place: {
        select: { id: true, name: true, lat: true, lon: true, radius: true },
      },
    },
    orderBy: { arrivalAt: "desc" },
  });

  return NextResponse.json(visits);
}
