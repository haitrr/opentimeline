import { NextResponse } from "next/server";
import { detectUnknownVisits } from "@/lib/detectUnknownVisits";

export async function POST(request: Request) {
  let rangeStart: Date | undefined;
  let rangeEnd: Date | undefined;

  try {
    const body = await request.json();
    if (body.start) rangeStart = new Date(body.start);
    if (body.end) rangeEnd = new Date(body.end);
  } catch {
    // no body or invalid JSON — run without range filter
  }

  const created = await detectUnknownVisits(rangeStart, rangeEnd);
  return NextResponse.json({ created });
}
