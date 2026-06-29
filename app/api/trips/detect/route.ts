import { NextResponse } from "next/server";
import { detectTripCandidates } from "@/lib/detectTrips";

export async function POST() {
  try {
    const candidates = await detectTripCandidates();
    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ error: "Detection failed" }, { status: 500 });
  }
}
