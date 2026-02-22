"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Circle,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { format } from "date-fns";
import "leaflet/dist/leaflet.css";
import type { SerializedPoint } from "@/lib/groupByHour";
import type { PlaceData } from "@/lib/detectVisits";
import type { UnknownVisitData } from "@/components/map/MapWrapper";
import type { ImmichPhoto } from "@/lib/immich";

type Props = {
  points: SerializedPoint[];
  places?: PlaceData[];
  unknownVisits?: UnknownVisitData[];
  photos?: ImmichPhoto[];
  onMapClick?: (lat: number, lon: number) => void;
  onPlaceClick?: (place: PlaceData) => void;
  onUnknownVisitCreatePlace?: (uv: UnknownVisitData) => void;
  onPhotoClick?: (photo: ImmichPhoto) => void;
};

function FlyToHandler() {
  const map = useMap();
  useEffect(() => {
    function handler(e: Event) {
      const { lat, lon } = (e as CustomEvent<{ lat: number; lon: number }>).detail;
      map.flyTo([lat, lon], Math.max(map.getZoom(), 15), { duration: 1 });
    }
    window.addEventListener("opentimeline:fly-to", handler);
    return () => window.removeEventListener("opentimeline:fly-to", handler);
  }, [map]);
  return null;
}

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

export default function LeafletMap({ points, places = [], unknownVisits = [], photos = [], onMapClick, onPlaceClick, onUnknownVisitCreatePlace, onPhotoClick }: Props) {
  const positions = useMemo(
    () => points.map((p) => [p.lat, p.lon] as [number, number]),
    [points]
  );

  const bounds = useMemo(() => computeBounds(points), [points]);
  const placeClickedRef = useRef(false);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<number | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsDarkTheme(root.classList.contains("dark"));
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const tileConfig = isDarkTheme
    ? {
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
      }
    : {
        url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        subdomains: "abc",
      };

  const defaultCenter: [number, number] = [20, 0];
  const defaultZoom = 2;

  return (
    <MapContainer
      center={bounds ? undefined : defaultCenter}
      zoom={bounds ? undefined : defaultZoom}
      bounds={bounds}
      boundsOptions={{ padding: [40, 40] }}
      zoomControl={false}
      className="h-full w-full"
    >
      <TileLayer
        key={isDarkTheme ? "dark" : "light"}
        url={tileConfig.url}
        attribution={tileConfig.attribution}
        subdomains={tileConfig.subdomains}
        maxZoom={19}
      />

      <FlyToHandler />
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

      {places.map((place) => {
        const hasConfirmedInRange = (place.confirmedVisitsInRange ?? 0) > 0;
        const hasSuggestedInRange = (place.suggestedVisitsInRange ?? 0) > 0;
        const hasVisitsInRange = hasConfirmedInRange || hasSuggestedInRange;
        const isHovered = hoveredPlaceId === place.id;

        const handlePlaceClick = () => {
          if (!onPlaceClick) return;
          placeClickedRef.current = true;
          onPlaceClick(place);
        };

        return (
          <React.Fragment key={place.id}>
            {(hasVisitsInRange || isHovered) && (
              <Circle
                center={[place.lat, place.lon]}
                radius={place.radius}
                pathOptions={{
                  color: hasVisitsInRange ? "#16a34a" : "#7e22ce",
                  fillColor: hasVisitsInRange ? "#22c55e" : "#a855f7",
                  fillOpacity: hasVisitsInRange ? 0.2 : 0.15,
                  weight: 2,
                  dashArray: hasConfirmedInRange || !hasSuggestedInRange ? undefined : "6, 6",
                }}
                eventHandlers={{
                  click: handlePlaceClick,
                  mouseover: () => setHoveredPlaceId(place.id),
                  mouseout: () => setHoveredPlaceId((current) => (current === place.id ? null : current)),
                }}
              >
                  <Tooltip
                  permanent={hasVisitsInRange || isHovered}
                  direction="top"
                  className="!border-border !bg-background !text-foreground"
                  offset={[0, -8]}
                >
                  <span className="text-xs font-medium text-foreground">{place.name}</span>
                </Tooltip>
              </Circle>
            )}

            <CircleMarker
              center={[place.lat, place.lon]}
              radius={hasVisitsInRange ? 5 : 3}
              pathOptions={{
                color: hasVisitsInRange ? "#15803d" : "#7e22ce",
                fillColor: hasVisitsInRange ? "#22c55e" : "#a855f7",
                fillOpacity: 0.9,
                weight: hasVisitsInRange ? 2 : 1.5,
              }}
              eventHandlers={{
                click: handlePlaceClick,
                mouseover: () => setHoveredPlaceId(place.id),
                mouseout: () => setHoveredPlaceId((current) => (current === place.id ? null : current)),
              }}
            />
          </React.Fragment>
        );
      })}

      {unknownVisits.map((uv) => (
        <Circle
          key={uv.id}
          center={[uv.lat, uv.lon]}
          radius={50}
          pathOptions={{
            color: "#eab308",
            fillColor: "#eab308",
            fillOpacity: 0.2,
            weight: 2,
            dashArray: "5, 5",
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            <span className="text-xs font-medium">Unknown</span>
          </Tooltip>
          <Popup>
            <div className="text-xs">
              <p className="font-semibold text-yellow-700">Unknown</p>
              <p className="text-gray-600 mt-0.5">
                {format(new Date(uv.arrivalAt), "MMM d, HH:mm")} –{" "}
                {format(new Date(uv.departureAt), "HH:mm")}
              </p>
              <p className="text-gray-400 mb-2">{uv.pointCount} points</p>
              {onUnknownVisitCreatePlace && (
                <button
                  onClick={() => onUnknownVisitCreatePlace(uv)}
                  className="w-full rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                >
                  Create Place
                </button>
              )}
            </div>
          </Popup>
        </Circle>
      ))}

      {photos.filter((p) => p.lat !== null && p.lon !== null).map((photo) => (
        <CircleMarker
          key={photo.id}
          center={[photo.lat!, photo.lon!]}
          radius={6}
          fillColor="#a855f7"
          color="#7e22ce"
          weight={1.5}
          fillOpacity={0.9}
        >
          <Popup>
            <div className="text-xs" style={{ minWidth: 120 }}>
              <button onClick={() => onPhotoClick?.(photo)} style={{ display: "block", padding: 0, border: "none", background: "none", cursor: "pointer" }}>
                <img
                  src={`/api/immich/thumbnail?id=${photo.id}`}
                  alt=""
                  style={{ width: 128, height: 96, objectFit: "cover", borderRadius: 4, marginBottom: 4 }}
                />
              </button>
              <p className="text-gray-500 text-center">
                {format(new Date(photo.takenAt), "HH:mm")}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
