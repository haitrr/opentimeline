/**
 * Seed data for testing conflict and stationary device detection scenarios.
 *
 * Scenarios (all on 2026-04-22, today, in local SF time):
 *   1. 08:00–10:00 — "phone" stationary at home, "watch" walking ~1 km away → stationary suggestion
 *   2. 11:00–12:00 — "phone" and "watch" walking together → no conflict
 *   3. 13:00–15:00 — "phone" at home, "tablet" at nearby park (~500 m away) → spatial conflict
 *   4. 15:00–17:00 — "tablet" stationary at park, "phone" walking → stationary suggestion
 *
 * Moving devices travel at cycling pace (~5 m/s) so tracks span only ~1–2 km.
 *
 * Run with: pnpm exec tsx --tsconfig tsconfig.json prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Mission District, San Francisco
const HOME   = { lat: 37.7599, lon: -122.4148 };
// Dolores Park — ~500 m north of HOME, far enough to trigger spatial conflict
const PARK   = { lat: 37.7596, lon: -122.4268 };

const METERS_PER_DEG_LAT = 111_000;
const METERS_PER_DEG_LON = 111_000 * Math.cos((37.76 * Math.PI) / 180);

function toTst(d: Date) {
  return Math.floor(d.getTime() / 1000);
}

type Point = {
  lat: number; lon: number; tst: number; recordedAt: Date;
  vel: number; acc: number; deviceId: string;
};

/** Device stays within a few metres of anchor — well under the 100 m stationary threshold. */
function stationaryPoints(
  deviceId: string,
  anchor: { lat: number; lon: number },
  start: Date,
  durationMinutes: number
): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < durationMinutes; i++) {
    const recordedAt = new Date(start.getTime() + i * 60_000);
    const jitter = 0.000004 * Math.sin(i); // ~±0.4 m
    points.push({
      lat: anchor.lat + jitter,
      lon: anchor.lon + jitter,
      tst: toTst(recordedAt),
      recordedAt,
      vel: 0,
      acc: 5,
      deviceId,
    });
  }
  return points;
}

/**
 * Device follows a rectangular block loop: north → east → south → west → repeat.
 * Each leg is ~400 m, so the full loop is ~1.6 km and clearly 2D on the map.
 * Speed: ~5 m/s (~18 km/h cycling pace).
 */
function movingPoints(
  deviceId: string,
  start: { lat: number; lon: number },
  startTime: Date,
  durationMinutes: number
): Point[] {
  const points: Point[] = [];
  const speedMps = 5;
  const legM = 400; // metres per leg

  // Four corners of the rectangle (offsets in metres from start)
  const legs: [number, number][] = [
    [0, legM],       // north
    [legM, legM],    // east
    [legM, 0],       // south
    [0, 0],          // west back to start
  ];
  const loopM = legM * 4;

  for (let i = 0; i < durationMinutes; i++) {
    const recordedAt = new Date(startTime.getTime() + i * 60_000);
    const totalDist = (i * 60 * speedMps) % loopM;

    // Which leg are we on?
    const legIdx = Math.floor(totalDist / legM);
    const t = (totalDist % legM) / legM; // 0–1 progress along leg
    const [fromN, fromE] = legs[legIdx];
    const [toN, toE] = legs[(legIdx + 1) % legs.length];
    const northM = fromN + (toN - fromN) * t;
    const eastM = fromE + (toE - fromE) * t;

    points.push({
      lat: start.lat + northM / METERS_PER_DEG_LAT,
      lon: start.lon + eastM / METERS_PER_DEG_LON,
      tst: toTst(recordedAt),
      recordedAt,
      vel: speedMps,
      acc: 10,
      deviceId,
    });
  }
  return points;
}

async function main() {
  console.log("Clearing existing seed data...");
  await prisma.locationPoint.deleteMany({
    where: { deviceId: { in: ["phone", "watch", "tablet"] } },
  });
  await prisma.deviceFilter.deleteMany();

  const allPoints: Point[] = [];

  // ── Scenario 1: 08:00–10:00 ─────────────────────────────────────────────────
  // phone stationary at home, watch cycling a short loop nearby.
  // → stationary suggestion for "phone"
  console.log("Seeding scenario 1: phone stationary, watch cycling...");
  const s1 = new Date("2026-04-22T08:00:00Z");
  allPoints.push(...stationaryPoints("phone", HOME, s1, 120));
  allPoints.push(...movingPoints("watch", HOME, s1, 120));

  // ── Scenario 2: 11:00–12:00 ─────────────────────────────────────────────────
  // Both phone and watch walk together (< 5 m apart at all times).
  // → no conflict, no stationary suggestion
  console.log("Seeding scenario 2: phone and watch walking together...");
  const s2 = new Date("2026-04-22T11:00:00Z");
  const walkMps = 1.2;
  for (let i = 0; i < 60; i++) {
    const recordedAt = new Date(s2.getTime() + i * 60_000);
    const dist = i * 60 * walkMps;
    const lat = HOME.lat + dist / METERS_PER_DEG_LAT;
    allPoints.push({ lat, lon: HOME.lon, tst: toTst(recordedAt), recordedAt, vel: walkMps, acc: 8, deviceId: "phone" });
    allPoints.push({ lat: lat + 0.000004, lon: HOME.lon, tst: toTst(recordedAt), recordedAt, vel: walkMps, acc: 8, deviceId: "watch" });
  }

  // ── Scenario 3: 13:00–15:00 ─────────────────────────────────────────────────
  // phone stationary at HOME, tablet stationary at PARK (~600 m west).
  // Devices are far apart simultaneously → spatial conflict.
  // → conflict detected by existing algorithm
  console.log("Seeding scenario 3: phone at home, tablet at park (spatial conflict)...");
  const s3 = new Date("2026-04-22T13:00:00Z");
  allPoints.push(...stationaryPoints("phone", HOME, s3, 120));
  allPoints.push(...stationaryPoints("tablet", PARK, s3, 120));

  // ── Scenario 4: 15:00–17:00 ─────────────────────────────────────────────────
  // tablet stays at PARK, phone cycles a loop around the neighbourhood.
  // → stationary suggestion for "tablet"
  console.log("Seeding scenario 4: tablet stationary at park, phone cycling...");
  const s4 = new Date("2026-04-22T15:00:00Z");
  allPoints.push(...stationaryPoints("tablet", PARK, s4, 120));
  allPoints.push(...movingPoints("phone", HOME, s4, 120));

  await prisma.locationPoint.createMany({ data: allPoints });

  const distanceParkM = Math.sqrt(
    ((PARK.lat - HOME.lat) * METERS_PER_DEG_LAT) ** 2 +
    ((PARK.lon - HOME.lon) * METERS_PER_DEG_LON) ** 2
  );

  console.log(`\nSeeded ${allPoints.length} location points.`);
  console.log(`Home: ${HOME.lat}, ${HOME.lon}`);
  console.log(`Park: ${PARK.lat}, ${PARK.lon}  (${Math.round(distanceParkM)} m from home)`);
  console.log("\nScenarios (2026-04-22 UTC):");
  console.log("  08:00–10:00 — phone stationary, watch cycling         → stationary suggestion");
  console.log("  11:00–12:00 — phone + watch walking together           → no conflict");
  console.log("  13:00–15:00 — phone at home, tablet at park (~600 m)  → spatial conflict");
  console.log("  15:00–17:00 — tablet stationary, phone cycling         → stationary suggestion");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
