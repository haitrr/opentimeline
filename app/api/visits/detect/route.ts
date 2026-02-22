import { NextResponse } from "next/server";
import { detectVisitsForAllPlaces } from "@/lib/detectVisits";

export async function POST() {
  const newVisits = await detectVisitsForAllPlaces();
  return NextResponse.json({ newVisits });
}
