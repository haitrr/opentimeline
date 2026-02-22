import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "suggested";

  const suggestions = await prisma.unknownVisitSuggestion.findMany({
    where: { status },
    orderBy: { arrivalAt: "desc" },
  });

  return NextResponse.json(suggestions);
}
