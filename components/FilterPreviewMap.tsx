"use client";

import { useEffect, useMemo, useRef } from "react";
import Map, { Source, Layer, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Feature } from "geojson";
import type { SerializedPoint } from "@/lib/groupByHour";
import { computeInitialViewState } from "@/components/map/mapUtils";

type Props = {
  points: SerializedPoint[];
  className?: string;
};

const PATH_SPLIT_SEC = 600;

function buildPathGeoJSON(points: SerializedPoint[]): FeatureCollection {
  const sorted = [...points].sort((a, b) => a.tst - b.tst);
  const features: Feature[] = [];
  if (sorted.length < 2) return { type: "FeatureCollection", features };

  let current: [number, number][] = [[sorted[0].lon, sorted[0].lat]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].tst - sorted[i - 1].tst;
    if (gap > PATH_SPLIT_SEC) {
      if (current.length >= 2) {
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: current },
          properties: {},
        });
      }
      current = [];
    }
    current.push([sorted[i].lon, sorted[i].lat]);
  }
  if (current.length >= 2) {
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: current },
      properties: {},
    });
  }
  return { type: "FeatureCollection", features };
}

export default function FilterPreviewMap({ points, className }: Props) {
  const mapRef = useRef<MapRef>(null);
  const pathGeoJSON = useMemo(() => buildPathGeoJSON(points), [points]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialViewState = useMemo(() => computeInitialViewState(points), []);

  useEffect(() => {
    if (points.length === 0) return;
    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    mapRef.current?.fitBounds(bounds, { padding: 40, duration: 300, maxZoom: 14 });
  }, [points]);

  return (
    <div className={className} style={{ height: 250 }}>
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <Source id="filter-preview-path" type="geojson" data={pathGeoJSON}>
          <Layer
            id="filter-preview-line"
            type="line"
            paint={{
              "line-color": "#3b82f6",
              "line-width": 2,
              "line-opacity": 0.8,
            }}
          />
        </Source>
      </Map>
    </div>
  );
}
