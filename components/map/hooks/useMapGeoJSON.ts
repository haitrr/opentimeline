"use client";

import { useMemo } from "react";
import type { SerializedPoint } from "@/lib/groupByHour";
import type { PlaceData } from "@/lib/detectVisits";
import type { UnknownVisitData } from "@/components/map/MapWrapper";
import type { ImmichPhoto } from "@/lib/immich";
import { haversineKm } from "@/lib/geo";
import { geoCircle, interpolateColor } from "@/components/map/mapUtils";

const PATH_SPLIT_SEC = 3600;
const PATH_SPLIT_KM = 5;

export function useMapGeoJSON(
  points: SerializedPoint[],
  places: PlaceData[],
  unknownVisits: UnknownVisitData[],
  photos: ImmichPhoto[],
  showVisitedPlaces: boolean,
  hoveredPlaceId: number | null,
) {
  const pathGeoJSON = useMemo(() => {
    const segments: [number, number][][] = [];
    let current: [number, number][] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i > 0) {
        const prev = points[i - 1];
        const tstGap = p.tst - prev.tst;
        const distKm = haversineKm(prev.lat, prev.lon, p.lat, p.lon);
        if (tstGap > PATH_SPLIT_SEC || distKm > PATH_SPLIT_KM) {
          if (current.length > 1) segments.push(current);
          current = [];
        }
      }
      current.push([p.lon, p.lat]);
    }
    if (current.length > 1) segments.push(current);
    return {
      type: "Feature" as const,
      geometry: {
        type: "MultiLineString" as const,
        coordinates: segments,
      },
      properties: {},
    };
  }, [points]);

  const lineGradientExpression = useMemo(() => {
    const fallback = ["interpolate", ["linear"], ["line-progress"], 0, "#22c55e", 0.25, "#06b6d4", 0.5, "#3b82f6", 0.75, "#a855f7", 1, "#ef4444"];
    if (points.length < 2) return fallback;

    const startTime = points[0].tst;
    const endTime = points[points.length - 1].tst;
    const totalTime = endTime - startTime;

    const cumDist: number[] = [0];
    for (let i = 1; i < points.length; i++) {
      cumDist.push(cumDist[i - 1] + haversineKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon));
    }
    const totalDist = cumDist[cumDist.length - 1];
    if (totalDist === 0 || totalTime === 0) return fallback;

    const stride = Math.max(1, Math.floor(points.length / 100));
    const expr: (string | number | string[])[] = ["interpolate", ["linear"], ["line-progress"]];
    const seen = new Set<number>();

    for (let i = 0; i < points.length; i += stride) {
      const distProgress = Math.min(1, cumDist[i] / totalDist);
      const key = Math.round(distProgress * 1e6);
      if (seen.has(key)) continue;
      seen.add(key);
      const timeProgress = Math.min(1, Math.max(0, (points[i].tst - startTime) / totalTime));
      expr.push(distProgress, interpolateColor(timeProgress));
    }

    const lastKey = Math.round(1e6);
    if (!seen.has(lastKey)) expr.push(1, "#ef4444");

    return expr;
  }, [points]);

  const pointsGeoJSON = useMemo(() => {
    const features: Array<{
      type: "Feature";
      geometry: { type: "Point"; coordinates: [number, number] };
      properties: { id: number; isFirst: boolean; isLast: boolean; batt: number | null; recordedAt: string; acc: number | null; vel: number | null };
    }> = [];
    points.forEach((p, i) => {
      const isFirst = i === 0;
      const isLast = i === points.length - 1;
      const shouldRender =
        isFirst ||
        isLast ||
        points.length <= 200 ||
        i % Math.ceil(points.length / 200) === 0;
      if (!shouldRender) return;
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { id: p.id, isFirst, isLast, batt: p.batt, recordedAt: p.recordedAt, acc: p.acc, vel: p.vel },
      });
    });
    return { type: "FeatureCollection" as const, features };
  }, [points]);

  const heatGeoJSON = useMemo(() => {
    if (points.length === 0) return { type: "FeatureCollection" as const, features: [] };
    const maxPoints = 4000;
    const stride = Math.max(1, Math.ceil(points.length / maxPoints));
    const features = points
      .filter((_, i) => i % stride === 0)
      .map((p) => {
        const accuracyWeight = p.acc ? Math.max(0.2, Math.min(1, 30 / p.acc)) : 0.7;
        const speed = p.vel ?? 0;
        const motionWeight =
          speed >= 25 ? 0.01 :
          speed >= 10 ? 0.03 :
          speed >= 4 ? 0.08 :
          speed >= 1.5 ? 0.6 :
          1.9;
        const weight = Math.max(0.005, accuracyWeight * motionWeight);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
          properties: { weight },
        };
      });
    return { type: "FeatureCollection" as const, features };
  }, [points]);

  const placeCirclesGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: places.map((p) => {
        const hasConfirmedInRange = showVisitedPlaces && (p.confirmedVisitsInRange ?? 0) > 0;
        const hasSuggestedInRange = showVisitedPlaces && (p.suggestedVisitsInRange ?? 0) > 0;
        return {
          type: "Feature" as const,
          id: p.id,
          geometry: geoCircle(p.lat, p.lon, p.radius),
          properties: {
            placeId: p.id,
            hasConfirmedInRange,
            hasSuggestedInRange,
            hasVisitsInRange: hasConfirmedInRange || hasSuggestedInRange,
            hovered: p.id === hoveredPlaceId,
          },
        };
      }),
    }),
    [places, showVisitedPlaces, hoveredPlaceId]
  );

  const placeDotsGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: places.map((p) => {
        const hasConfirmedInRange = showVisitedPlaces && (p.confirmedVisitsInRange ?? 0) > 0;
        const hasSuggestedInRange = showVisitedPlaces && (p.suggestedVisitsInRange ?? 0) > 0;
        return {
          type: "Feature" as const,
          id: p.id,
          geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
          properties: {
            placeId: p.id,
            name: p.name,
            hasConfirmedInRange,
            hasSuggestedInRange,
            hasVisitsInRange: hasConfirmedInRange || hasSuggestedInRange,
            hovered: p.id === hoveredPlaceId,
            visitCount: (p.confirmedVisitsInRange ?? 0) + (p.suggestedVisitsInRange ?? 0),
          },
        };
      }),
    }),
    [places, showVisitedPlaces, hoveredPlaceId]
  );

  const unknownVisitsGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: unknownVisits.map((uv) => ({
        type: "Feature" as const,
        id: uv.id,
        geometry: geoCircle(uv.lat, uv.lon, 50),
        properties: {
          uvId: uv.id,
          lat: uv.lat,
          lon: uv.lon,
          arrivalAt: uv.arrivalAt,
          departureAt: uv.departureAt,
          pointCount: uv.pointCount,
        },
      })),
    }),
    [unknownVisits]
  );

  const photosGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: photos
        .filter((p) => p.lat !== null && p.lon !== null)
        .map((p) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [p.lon!, p.lat!] },
          properties: { photoId: p.id, takenAt: p.takenAt },
        })),
    }),
    [photos]
  );

  return {
    pathGeoJSON,
    lineGradientExpression,
    pointsGeoJSON,
    heatGeoJSON,
    placeCirclesGeoJSON,
    placeDotsGeoJSON,
    unknownVisitsGeoJSON,
    photosGeoJSON,
  };
}
