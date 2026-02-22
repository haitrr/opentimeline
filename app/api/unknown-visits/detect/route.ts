import { NextResponse } from "next/server";
import { detectUnknownVisits } from "@/lib/detectUnknownVisits";

export async function POST() {
  const created = await detectUnknownVisits();
  return NextResponse.json({ created });
}
