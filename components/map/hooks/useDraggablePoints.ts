"use client";

import { useCallback, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";

export type HoveredPoint = {
  id: number;
  lat: number;
  lon: number;
} | null;

export function useDraggablePoints(mapRef: React.RefObject<MapRef | null>) {
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint>(null);
  const prevHoveredFeatureIdRef = useRef<number | string | null>(null);
  const isDraggingRef = useRef(false);

  // Called from MapLibreMap's rAF in handleMouseMove.
  // Returns the cursor string to use: "grab", "grabbing", or null.
  // Also manages feature-state for the hover highlight.
  const processMouseMove = useCallback((
    point: [number, number],
    map: MapRef,
    isActive: boolean,
  ): "grab" | "grabbing" | null => {
    if (isDraggingRef.current) return "grabbing";

    if (!isActive) {
      if (prevHoveredFeatureIdRef.current != null) {
        map.setFeatureState(
          { source: "points", id: prevHoveredFeatureIdRef.current },
          { hover: false },
        );
        prevHoveredFeatureIdRef.current = null;
        setHoveredPoint(null);
      }
      return null;
    }

    const features = map.queryRenderedFeatures(point, { layers: ["location-points"] });
    const f = features[0];

    if (!f || f.id == null) {
      if (prevHoveredFeatureIdRef.current != null) {
        map.setFeatureState(
          { source: "points", id: prevHoveredFeatureIdRef.current },
          { hover: false },
        );
        prevHoveredFeatureIdRef.current = null;
      }
      setHoveredPoint(null);
      return null;
    }

    const featureId = f.id as number | string;
    const pointId = Number(f.properties?.id);
    const coords = (f.geometry as { type: "Point"; coordinates: [number, number] }).coordinates;

    if (prevHoveredFeatureIdRef.current !== featureId) {
      if (prevHoveredFeatureIdRef.current != null) {
        map.setFeatureState(
          { source: "points", id: prevHoveredFeatureIdRef.current },
          { hover: false },
        );
      }
      map.setFeatureState({ source: "points", id: featureId }, { hover: true });
      prevHoveredFeatureIdRef.current = featureId;
    }

    setHoveredPoint((prev) =>
      prev?.id === pointId ? prev : { id: pointId, lat: coords[1], lon: coords[0] }
    );
    return "grab";
  }, []);

  const processMouseLeave = useCallback((map: MapRef) => {
    if (isDraggingRef.current) return;
    if (prevHoveredFeatureIdRef.current != null) {
      map.setFeatureState(
        { source: "points", id: prevHoveredFeatureIdRef.current },
        { hover: false },
      );
      prevHoveredFeatureIdRef.current = null;
    }
    setHoveredPoint(null);
  }, []);

  const onDragStart = useCallback(() => {
    isDraggingRef.current = true;
    mapRef.current?.dragPan.disable();
  }, [mapRef]);

  const onDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    mapRef.current?.dragPan.enable();
    if (prevHoveredFeatureIdRef.current != null) {
      mapRef.current?.setFeatureState(
        { source: "points", id: prevHoveredFeatureIdRef.current },
        { hover: false },
      );
      prevHoveredFeatureIdRef.current = null;
    }
    setHoveredPoint(null);
  }, [mapRef]);

  return { hoveredPoint, processMouseMove, processMouseLeave, onDragStart, onDragEnd };
}
