import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "suggested";
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const suggestions = await prisma.unknownVisitSuggestion.findMany({
    where: {
      status,
      ...(start || end
        ? {
            AND: [
              ...(end ? [{ arrivalAt: { lt: new Date(end) } }] : []),
              ...(start ? [{ departureAt: { gt: new Date(start) } }] : []),
            ],
          }
        : {}),
    },
    orderBy: { arrivalAt: "asc" },
  });

  return NextResponse.json(suggestions);
}
