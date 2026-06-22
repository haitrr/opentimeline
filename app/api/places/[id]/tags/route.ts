import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  params: Promise<{ id: string }>
) {
  const { id } = await params;
  const placeId = Number.parseInt(id, 10);
  if (!Number.isInteger(placeId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const existing = await prisma.place.findUnique({ where: { id: placeId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  }

  const body = await request.json();
  const rawTags: string[] = Array.isArray(body.tags) ? body.tags : [];
  const normalized = rawTags.map((t) => String(t).toLowerCase().trim()).filter(Boolean);

  const savedTags = await prisma.$transaction(async (tx) => {
    const tagRows = await Promise.all(
      normalized.map((name) =>
        tx.tag.upsert({
          where: { name },
          create: { name },
          update: {},
          select: { id: true, name: true },
        })
      )
    );

    await tx.placeTag.deleteMany({ where: { placeId } });

    if (tagRows.length > 0) {
      await tx.placeTag.createMany({
        data: tagRows.map((t) => ({ placeId, tagId: t.id })),
        skipDuplicates: true,
      });
    }

    return tagRows.map((t) => t.name);
  });

  return NextResponse.json({ tags: savedTags });
}
