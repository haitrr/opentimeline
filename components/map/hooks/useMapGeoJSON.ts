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
const TIME_BUCKETS = 256;

export function useMapGeoJSON(
  points: SerializedPoint[],
  places: PlaceData[],
  unknownVisits: UnknownVisitData[],
  photos: ImmichPhoto[],
  showVisitedPlaces: boolean,
  hoveredPlaceId: number | null,
  rangeStart?: string,
  rangeEnd?: string,
) {
  const pathGeoJSON = useMemo(() => {
    type PathFeature = {
      type: "Feature";
      geometry: { type: "LineString"; coordinates: [number, number][] };
      properties: { color: string };
    };
    const features: PathFeature[] = [];
    if (points.length < 2) {
      return { type: "FeatureCollection" as const, features };
    }

    const rangeStartSec = rangeStart ? Math.floor(new Date(rangeStart).getTime() / 1000) : points[0].tst;
    const rangeEndSec = rangeEnd ? Math.floor(new Date(rangeEnd).getTime() / 1000) : points[points.length - 1].tst;
    const totalTime = Math.max(1, rangeEndSec - rangeStartSec);

    const bucketOf = (tst: number) => {
      const raw = Math.floor(((tst - rangeStartSec) / totalTime) * TIME_BUCKETS);
      return Math.max(0, Math.min(TIME_BUCKETS - 1, raw));
    };
    const colorOf = (bucket: number) => interpolateColor((bucket + 0.5) / TIME_BUCKETS);

    let current: [number, number][] = [];
    let currentBucket = bucketOf(points[0].tst);
    const flush = () => {
      if (current.length > 1) {
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: current },
          properties: { color: colorOf(currentBucket) },
        });
      }
    };

    current.push([points[0].lon, points[0].lat]);
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const prev = points[i - 1];
      const tstGap = p.tst - prev.tst;
      const distKm = haversineKm(prev.lat, prev.lon, p.lat, p.lon);
      const bucket = bucketOf(p.tst);
      const isGap = tstGap > PATH_SPLIT_SEC || distKm > PATH_SPLIT_KM;
      if (isGap) {
        flush();
        current = [];
        currentBucket = bucket;
      } else if (bucket !== currentBucket) {
        // Keep this point to start the new colored segment and close the previous one on it.
        current.push([p.lon, p.lat]);
        flush();
        current = [[p.lon, p.lat]];
        currentBucket = bucket;
        continue;
      }
      current.push([p.lon, p.lat]);
    }
    flush();
    return { type: "FeatureCollection" as const, features };
  }, [points, rangeStart, rangeEnd]);

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
    pointsGeoJSON,
    heatGeoJSON,
    placeCirclesGeoJSON,
    placeDotsGeoJSON,
    unknownVisitsGeoJSON,
    photosGeoJSON,
  };
}
