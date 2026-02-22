import { NextRequest, NextResponse } from "next/server";
import { isImmichConfigured, getImmichPhotos } from "@/lib/immich";

export async function GET(req: NextRequest) {
  if (!isImmichConfigured()) {
    return NextResponse.json([]);
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing start or end" }, { status: 400 });
  }

  try {
    const photos = await getImmichPhotos(new Date(start), new Date(end));
    return NextResponse.json(photos);
  } catch (err) {
    console.error("Immich fetch error:", err);
    return NextResponse.json([]);
  }
}
