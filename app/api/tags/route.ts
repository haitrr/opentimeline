import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get("q")?.trim() || null;

  const tags = await prisma.tag.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { places: { _count: "desc" } },
    take: 10,
    select: { name: true },
  });

  return NextResponse.json({ tags: tags.map((t) => t.name) });
}
