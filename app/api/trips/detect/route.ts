import { NextResponse } from "next/server";
import { detectTripCandidates } from "@/lib/detectTrips";

export async function POST() {
  const candidates = await detectTripCandidates();
  return NextResponse.json({ candidates });
}
