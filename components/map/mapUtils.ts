import type { SerializedPoint } from "@/lib/groupByHour";

/** Interpolates green → cyan → blue → purple → red for t in [0, 1]. */
export function interpolateColor(t: number): string {
  const stops: [number, number, number][] = [
    [34, 197, 94],   // #22c55e green
    [6, 182, 212],   // #06b6d4 cyan
    [59, 130, 246],  // #3b82f6 blue
    [168, 85, 247],  // #a855f7 purple
    [239, 68, 68],   // #ef4444 red
  ];
  const seg = t * (stops.length - 1);
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const s = seg - i;
  const [r1, g1, b1] = stops[i];
  const [r2, g2, b2] = stops[i + 1];
  const r = Math.round(r1 + s * (r2 - r1));
  const g = Math.round(g1 + s * (g2 - g1));
  const b = Math.round(b1 + s * (b2 - b1));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Generates a polygon approximating a geo-accurate circle of radiusM metres. */
export function geoCircle(
  lat: number,
  lon: number,
  radiusM: number,
  steps = 32
): { type: "Polygon"; coordinates: [number, number][][] } {
  const coords: [number, number][] = [];
  const earthR = 6371000;
  const angR = radiusM / earthR;
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 2 * Math.PI) / steps;
    const dLat = angR * Math.cos(angle);
    const dLon = (angR * Math.sin(angle)) / Math.cos((lat * Math.PI) / 180);
    coords.push([lon + (dLon * 180) / Math.PI, lat + (dLat * 180) / Math.PI]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

export function computeInitialViewState(points: SerializedPoint[]) {
  if (points.length === 0) return { longitude: 0, latitude: 20, zoom: 2 };
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLon = points[0].lon;
  let maxLon = points[0].lon;
  for (let index = 1; index < points.length; index++) {
    const point = points[index];
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLon = Math.min(minLon, point.lon);
    maxLon = Math.max(maxLon, point.lon);
  }
  return {
    bounds: [
      [minLon, minLat],
      [maxLon, maxLat],
    ] as [[number, number], [number, number]],
    fitBoundsOptions: { padding: 40 },
  };
}
