import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams;
  const q = sp.get("q")?.trim() || null;
  const limitParam = sp.get("limit");
  const take = limitParam ? Math.min(1000, Math.max(1, parseInt(limitParam, 10) || 10)) : 10;

  const tags = await prisma.tag.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { places: { _count: "desc" } },
    take,
    select: { name: true },
  });

  return NextResponse.json({ tags: tags.map((t) => t.name) });
}
