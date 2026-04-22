/**
 * Seed data for testing conflict and stationary device detection scenarios.
 *
 * Scenarios seeded:
 *   1. 2026-04-20 08:00–12:00 — "phone" stationary at home, "watch" commuting (triggers stationary suggestion)
 *   2. 2026-04-20 13:00–15:00 — "phone" and "watch" moving together (no conflict, no stationary suggestion)
 *   3. 2026-04-21 09:00–11:00 — "phone" and "tablet" far apart simultaneously (triggers spatial conflict)
 *   4. 2026-04-21 14:00–16:00 — "tablet" stationary at office, "phone" moving around the city
 *
 * Run with: pnpm exec tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// San Francisco coordinates used as anchor points
const HOME = { lat: 37.7749, lon: -122.4194 };
const OFFICE = { lat: 37.8044, lon: -122.2712 }; // Oakland (far enough for spatial conflict)

function toTst(d: Date) {
  return Math.floor(d.getTime() / 1000);
}

/** Generate points for a device staying near a fixed lat/lon (jitter < 5 m). */
function stationaryPoints(
  deviceId: string,
  anchor: { lat: number; lon: number },
  start: Date,
  durationMinutes: number,
  intervalSeconds = 60
) {
  const points = [];
  const steps = Math.floor((durationMinutes * 60) / intervalSeconds);
  for (let i = 0; i < steps; i++) {
    const recordedAt = new Date(start.getTime() + i * intervalSeconds * 1000);
    // Sub-meter jitter — stays well within STATIONARY_RADIUS_M (100 m)
    const jitter = 0.000005 * (((i * 7) % 5) - 2);
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
 * Generate points for a device moving northward at ~10 m/s.
 * After `durationMinutes`, the device has moved ~36 km north.
 */
function movingPoints(
  deviceId: string,
  start: { lat: number; lon: number },
  startTime: Date,
  durationMinutes: number,
  intervalSeconds = 60
) {
  const points = [];
  const steps = Math.floor((durationMinutes * 60) / intervalSeconds);
  const speedMps = 10; // ~36 km/h
  const metersPerDegreeLat = 111_000;
  for (let i = 0; i < steps; i++) {
    const recordedAt = new Date(startTime.getTime() + i * intervalSeconds * 1000);
    const distanceTravelled = i * intervalSeconds * speedMps;
    points.push({
      lat: start.lat + distanceTravelled / metersPerDegreeLat,
      lon: start.lon,
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

  const allPoints: {
    lat: number; lon: number; tst: number; recordedAt: Date;
    vel: number; acc: number; deviceId: string;
  }[] = [];

  // ── Scenario 1 ──────────────────────────────────────────────────────────────
  // 2026-04-20 08:00–12:00
  // "phone" sits at home (stationary), "watch" commutes northward (moving).
  // Expected: stationary suggestion for "phone" during this window.
  console.log("Seeding scenario 1: phone stationary, watch commuting...");
  const s1Start = new Date("2026-04-20T08:00:00Z");
  allPoints.push(...stationaryPoints("phone", HOME, s1Start, 240));
  allPoints.push(...movingPoints("watch", HOME, s1Start, 240));

  // ── Scenario 2 ──────────────────────────────────────────────────────────────
  // 2026-04-20 13:00–15:00
  // Both "phone" and "watch" move together (walking pace, ~1.4 m/s).
  // Expected: no conflict, no stationary suggestion.
  console.log("Seeding scenario 2: phone and watch moving together...");
  const s2Start = new Date("2026-04-20T13:00:00Z");
  const walkSpeedMps = 1.4;
  const metersPerDegreeLat = 111_000;
  const s2Steps = 120; // 2 hours, 1 point/min
  for (let i = 0; i < s2Steps; i++) {
    const recordedAt = new Date(s2Start.getTime() + i * 60_000);
    const dist = i * 60 * walkSpeedMps;
    const lat = HOME.lat + dist / metersPerDegreeLat;
    // phone and watch at effectively same position (< 5 m apart)
    allPoints.push({ lat, lon: HOME.lon, tst: toTst(recordedAt), recordedAt, vel: walkSpeedMps, acc: 8, deviceId: "phone" });
    allPoints.push({ lat: lat + 0.000001, lon: HOME.lon, tst: toTst(recordedAt), recordedAt, vel: walkSpeedMps, acc: 8, deviceId: "watch" });
  }

  // ── Scenario 3 ──────────────────────────────────────────────────────────────
  // 2026-04-21 09:00–11:00
  // "phone" stays near HOME, "tablet" stays near OFFICE (~19 km apart).
  // Expected: spatial conflict detected (existing conflict detection).
  console.log("Seeding scenario 3: phone and tablet far apart (spatial conflict)...");
  const s3Start = new Date("2026-04-21T09:00:00Z");
  allPoints.push(...stationaryPoints("phone", HOME, s3Start, 120));
  allPoints.push(...stationaryPoints("tablet", OFFICE, s3Start, 120));

  // ── Scenario 4 ──────────────────────────────────────────────────────────────
  // 2026-04-21 14:00–16:00
  // "tablet" is stationary at OFFICE, "phone" is moving around the city.
  // Expected: stationary suggestion for "tablet" during this window.
  console.log("Seeding scenario 4: tablet stationary at office, phone moving...");
  const s4Start = new Date("2026-04-21T14:00:00Z");
  allPoints.push(...stationaryPoints("tablet", OFFICE, s4Start, 120));
  allPoints.push(...movingPoints("phone", HOME, s4Start, 120));

  await prisma.locationPoint.createMany({ data: allPoints });

  console.log(`Seeded ${allPoints.length} location points across 4 scenarios.`);
  console.log("");
  console.log("Scenarios:");
  console.log("  1. 2026-04-20 08:00–12:00 UTC — phone stationary, watch moving → stationary suggestion");
  console.log("  2. 2026-04-20 13:00–15:00 UTC — phone + watch moving together → no conflict");
  console.log("  3. 2026-04-21 09:00–11:00 UTC — phone at home, tablet at Oakland → spatial conflict");
  console.log("  4. 2026-04-21 14:00–16:00 UTC — tablet stationary, phone moving → stationary suggestion");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
