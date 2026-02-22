"use client";

import React, { useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Circle,
  Popup,
  useMapEvents,
} from "react-leaflet";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";
import type { SerializedPoint } from "@/lib/groupByHour";
import type { PlaceData } from "@/lib/detectVisits";

type Props = {
  points: SerializedPoint[];
  places?: PlaceData[];
  onMapClick?: (lat: number, lon: number) => void;
  onPlaceClick?: (place: PlaceData) => void;
};

function MapClickHandler({
  onMapClick,
  placeClickedRef,
}: {
  onMapClick: (lat: number, lon: number) => void;
  placeClickedRef: React.MutableRefObject<boolean>;
}) {
  useMapEvents({
    click(e) {
      if (placeClickedRef.current) {
        placeClickedRef.current = false;
        return;
      }
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function computeBounds(
  points: SerializedPoint[]
): [[number, number], [number, number]] | undefined {
  if (points.length === 0) return undefined;
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  return [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ];
}

export default function LeafletMap({ points, places = [], onMapClick, onPlaceClick }: Props) {
  const positions = useMemo(
    () => points.map((p) => [p.lat, p.lon] as [number, number]),
    [points]
  );

  const bounds = useMemo(() => computeBounds(points), [points]);
  const placeClickedRef = useRef(false);

  const defaultCenter: [number, number] = [20, 0];
  const defaultZoom = 2;

  return (
    <MapContainer
      center={bounds ? undefined : defaultCenter}
      zoom={bounds ? undefined : defaultZoom}
      bounds={bounds}
      boundsOptions={{ padding: [40, 40] }}
      className="h-full w-full"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      {onMapClick && <MapClickHandler onMapClick={onMapClick} placeClickedRef={placeClickedRef} />}

      {positions.length > 1 && (
        <Polyline
          positions={positions}
          color="#3b82f6"
          weight={3}
          opacity={0.8}
        />
      )}

      {points.map((p, i) => {
        // Show start/end points bigger; only render every Nth point for performance
        const isFirst = i === 0;
        const isLast = i === points.length - 1;
        const shouldRender = isFirst || isLast || points.length <= 200 || i % Math.ceil(points.length / 200) === 0;
        if (!shouldRender) return null;

        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lon]}
            radius={isFirst || isLast ? 6 : 4}
            fillColor={isFirst ? "#22c55e" : isLast ? "#ef4444" : "#3b82f6"}
            color={isFirst ? "#15803d" : isLast ? "#b91c1c" : "#1d4ed8"}
            weight={1.5}
            fillOpacity={0.85}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">
                  {format(new Date(p.recordedAt), "HH:mm:ss")}
                </p>
                {p.acc != null && <p className="text-gray-500">±{Math.round(p.acc)}m</p>}
                {p.batt != null && <p className="text-gray-500">Battery: {p.batt}%</p>}
                {p.vel != null && p.vel > 0 && (
                  <p className="text-gray-500">{Math.round(p.vel)} km/h</p>
                )}
                <p className="text-gray-400 mt-1">
                  {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {places.map((place) => (
        <Circle
          key={place.id}
          center={[place.lat, place.lon]}
          radius={place.radius}
          pathOptions={{
            color: "#f97316",
            fillColor: "#f97316",
            fillOpacity: 0.15,
            weight: 2,
          }}
          eventHandlers={
            onPlaceClick
              ? {
                  click() {
                    placeClickedRef.current = true;
                    onPlaceClick(place);
                  },
                }
              : undefined
          }
        />
      ))}
    </MapContainer>
  );
}
