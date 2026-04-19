import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { fromTime, toTime, deviceIds, label } = body ?? {};
  if (!fromTime || !toTime || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    const updated = await prisma.deviceFilter.update({
      where: { id },
      data: {
        fromTime: new Date(fromTime),
        toTime: new Date(toTime),
        deviceIds,
        label: label || null,
      },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.deviceFilter.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
