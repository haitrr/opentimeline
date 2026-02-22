export type GpxPoint = {
  lat: number;
  lon: number;
  tst: number;
  recordedAt: string;
  alt: number | null;
  vel: number | null;
  cog: number | null;
};

/**
 * Parses a GPX file string into an array of GpxPoint objects.
 * Uses the browser's native DOMParser — must be called client-side.
 */
export function parseGpx(gpxText: string): GpxPoint[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxText, "application/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid GPX file: failed to parse XML");
  }

  const points: GpxPoint[] = [];

  // Support both track points (<trkpt>) and waypoints (<wpt>)
  const trkpts = Array.from(doc.querySelectorAll("trkpt, wpt"));

  for (const trkpt of trkpts) {
    const lat = parseFloat(trkpt.getAttribute("lat") ?? "");
    const lon = parseFloat(trkpt.getAttribute("lon") ?? "");

    if (isNaN(lat) || isNaN(lon)) continue;

    const timeEl = trkpt.querySelector("time");
    if (!timeEl?.textContent) continue;

    const date = new Date(timeEl.textContent.trim());
    if (isNaN(date.getTime())) continue;

    const tst = Math.floor(date.getTime() / 1000);

    const eleEl = trkpt.querySelector("ele");
    const alt = eleEl?.textContent ? parseFloat(eleEl.textContent) : null;

    // Speed/course may appear in <extensions> (common in Garmin/OsmAnd GPX)
    const speedEl = trkpt.querySelector("speed, Speed");
    const vel = speedEl?.textContent
      ? parseFloat(speedEl.textContent) * 3.6 // m/s → km/h
      : null;

    const courseEl = trkpt.querySelector("course, Course");
    const cog = courseEl?.textContent ? parseFloat(courseEl.textContent) : null;

    points.push({
      lat,
      lon,
      tst,
      recordedAt: date.toISOString(),
      alt: alt != null && !isNaN(alt) ? alt : null,
      vel: vel != null && !isNaN(vel) ? vel : null,
      cog: cog != null && !isNaN(cog) ? cog : null,
    });
  }

  return points;
}
