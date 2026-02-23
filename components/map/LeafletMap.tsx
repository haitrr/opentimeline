"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Circle,
  Marker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { format } from "date-fns";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
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
  onPlaceMoveRequest?: (place: PlaceData, lat: number, lon: number) => void;
  onUnknownVisitCreatePlace?: (uv: UnknownVisitData) => void;
  onPhotoClick?: (photo: ImmichPhoto) => void;
};

function FlyToHandler() {
  const map = useMap();
  useEffect(() => {
    function handler(e: Event) {
      const { lat, lon } = (e as CustomEvent<{ lat: number; lon: number }>).detail;
      map.flyTo([lat, lon], 17, { duration: 1 });
    }
    window.addEventListener("opentimeline:fly-to", handler);
    return () => window.removeEventListener("opentimeline:fly-to", handler);
  }, [map]);
  return null;
}

function HeatLayer({
  points,
  visible,
}: {
  points: SerializedPoint[];
  visible: boolean;
}) {
  const map = useMap();
  const layerRef = useRef<L.HeatLayer | null>(null);
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const handleZoomEnd = () => setZoom(map.getZoom());
    map.on("zoomend", handleZoomEnd);
    return () => {
      map.off("zoomend", handleZoomEnd);
    };
  }, [map]);

  const heatPoints = useMemo(() => {
    if (points.length === 0) return [] as L.HeatLatLngTuple[];
    const maxPoints = 4000;
    const stride = Math.max(1, Math.ceil(points.length / maxPoints));
    const sampled = points.filter((_, index) => index % stride === 0);
    return sampled.map((point) => {
      const accuracyWeight = point.acc ? Math.max(0.2, Math.min(1, 30 / point.acc)) : 0.7;
      const speed = point.vel ?? 0;
      const motionWeight =
        speed >= 25 ? 0.01 :
        speed >= 10 ? 0.03 :
        speed >= 4 ? 0.08 :
        speed >= 1.5 ? 0.6 :
        1.9;
      const weight = Math.max(0.005, accuracyWeight * motionWeight);
      return [point.lat, point.lon, weight] as L.HeatLatLngTuple;
    });
  }, [points]);

  useEffect(() => {
    if (!visible || heatPoints.length === 0) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    const lowZoom = zoom <= 8;
    const midZoom = zoom > 8 && zoom <= 11;
    const dynamicMax = lowZoom ? 0.55 : midZoom ? 1.2 : 2.2;
    const dynamicMinOpacity = lowZoom ? 0.16 : midZoom ? 0.12 : 0.1;
    const dynamicRadius = lowZoom ? 5 : midZoom ? 7 : 12;
    const dynamicBlur = lowZoom ? 4 : midZoom ? 5 : 10;

    const nextLayer = L.heatLayer(heatPoints, {
      radius: dynamicRadius,
      blur: dynamicBlur,
      minOpacity: dynamicMinOpacity,
      max: dynamicMax,
      maxZoom: 12,
      gradient: {
        0.2: "#93c5fd",
        0.5: "#c4b5fd",
        0.8: "#f472b6",
        1.0: "#ef4444",
      },
    });
    nextLayer.addTo(map);
    layerRef.current = nextLayer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, visible, heatPoints, zoom]);

  return null;
}

const MAP_LAYER_SETTINGS_KEY = "opentimeline:map-layer-settings";

type MapLayerSettings = {
  showHeatmap?: boolean;
  showLine?: boolean;
  showVisitedPlaces?: boolean;
  showPoints?: boolean;
  showPlaces?: boolean;
  hidePoints?: boolean;
  hidePlaces?: boolean;
};

const DEFAULT_MAP_LAYER_SETTINGS: {
  showHeatmap: boolean;
  showLine: boolean;
  showVisitedPlaces: boolean;
  hidePoints: boolean;
  hidePlaces: boolean;
} = {
  showHeatmap: false,
  showLine: true,
  showVisitedPlaces: true,
  hidePoints: false,
  hidePlaces: false,
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

export default function LeafletMap({ points, places = [], unknownVisits = [], photos = [], onMapClick, onPlaceClick, onPlaceMoveRequest, onUnknownVisitCreatePlace, onPhotoClick }: Props) {
  const positions = useMemo(
    () => points.map((p) => [p.lat, p.lon] as [number, number]),
    [points]
  );

  const bounds = useMemo(() => computeBounds(points), [points]);
  const placeClickedRef = useRef(false);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<number | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(DEFAULT_MAP_LAYER_SETTINGS.showHeatmap);
  const [showLine, setShowLine] = useState(DEFAULT_MAP_LAYER_SETTINGS.showLine);
  const [showVisitedPlaces, setShowVisitedPlaces] = useState(DEFAULT_MAP_LAYER_SETTINGS.showVisitedPlaces);
  const [hidePoints, setHidePoints] = useState(DEFAULT_MAP_LAYER_SETTINGS.hidePoints);
  const [hidePlaces, setHidePlaces] = useState(DEFAULT_MAP_LAYER_SETTINGS.hidePlaces);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MAP_LAYER_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MapLayerSettings;
      if (typeof parsed.showHeatmap === "boolean") setShowHeatmap(parsed.showHeatmap);
      if (typeof parsed.showLine === "boolean") setShowLine(parsed.showLine);
      if (typeof parsed.showVisitedPlaces === "boolean") {
        setShowVisitedPlaces(parsed.showVisitedPlaces);
      }
      if (typeof parsed.showPoints === "boolean") {
        setHidePoints(!parsed.showPoints);
      } else if (typeof parsed.hidePoints === "boolean") {
        setHidePoints(parsed.hidePoints);
      }
      if (typeof parsed.showPlaces === "boolean") {
        setHidePlaces(!parsed.showPlaces);
      } else if (typeof parsed.hidePlaces === "boolean") {
        setHidePlaces(parsed.hidePlaces);
      }
    } catch {
      // ignore invalid local storage values
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      window.localStorage.setItem(
        MAP_LAYER_SETTINGS_KEY,
        JSON.stringify({
          showHeatmap,
          showLine,
          showVisitedPlaces,
          showPoints: !hidePoints,
          showPlaces: !hidePlaces,
        })
      );
    } catch {
      // ignore local storage write errors
    }
  }, [settingsLoaded, showHeatmap, showLine, showVisitedPlaces, hidePoints, hidePlaces]);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsDarkTheme(root.classList.contains("dark"));
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Meta") {
        setIsCtrlPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Meta") {
        setIsCtrlPressed(false);
      }
    };

    const handleWindowBlur = () => setIsCtrlPressed(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  const dragHandleIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: '<div class="h-4 w-4 rounded-full border-2 border-blue-700 bg-blue-500 opacity-80 shadow"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    []
  );

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
    <div className="relative h-full w-full">
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
      <HeatLayer points={points} visible={showHeatmap} />
      {onMapClick && <MapClickHandler onMapClick={onMapClick} placeClickedRef={placeClickedRef} />}

      {showLine && positions.length > 1 && (
        <Polyline
          positions={positions}
          color="#3b82f6"
          weight={showHeatmap ? 1.5 : 2}
          opacity={showHeatmap ? 0.32 : 0.45}
        />
      )}

      {!hidePoints && points.map((p, i) => {
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

      {!hidePlaces && places.map((place) => {
        const rawHasConfirmedInRange = (place.confirmedVisitsInRange ?? 0) > 0;
        const rawHasSuggestedInRange = (place.suggestedVisitsInRange ?? 0) > 0;
        const hasConfirmedInRange = showVisitedPlaces && rawHasConfirmedInRange;
        const hasSuggestedInRange = showVisitedPlaces && rawHasSuggestedInRange;
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
            {isCtrlPressed && (
              <Marker
                position={[place.lat, place.lon]}
                icon={dragHandleIcon}
                draggable
                eventHandlers={{
                  dragend: (event) => {
                    const marker = event.target as L.Marker;
                    const next = marker.getLatLng();
                    onPlaceMoveRequest?.(place, next.lat, next.lng);
                    marker.setLatLng([place.lat, place.lon]);
                  },
                }}
              />
            )}
          </React.Fragment>
        );
      })}

      {!hidePlaces && showVisitedPlaces && unknownVisits.map((uv) => (
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

      <div className="pointer-events-none absolute bottom-4 left-4 z-900">
        {layersMenuOpen && (
          <div className="pointer-events-auto absolute bottom-full left-0 mb-2 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
            <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Map layers</p>
            <label className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              <span>Heatmap</span>
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(event) => setShowHeatmap(event.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <label className="mt-1 flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              <span>Path line</span>
              <input
                type="checkbox"
                checked={showLine}
                onChange={(event) => setShowLine(event.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <label className="mt-1 flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              <span>Highlight visited places</span>
              <input
                type="checkbox"
                checked={showVisitedPlaces}
                onChange={(event) => setShowVisitedPlaces(event.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <label className="mt-1 flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              <span>Points</span>
              <input
                type="checkbox"
                checked={!hidePoints}
                onChange={(event) => setHidePoints(!event.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <label className="mt-1 flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              <span>Place</span>
              <input
                type="checkbox"
                checked={!hidePlaces}
                onChange={(event) => setHidePlaces(!event.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setShowHeatmap(DEFAULT_MAP_LAYER_SETTINGS.showHeatmap);
                setShowLine(DEFAULT_MAP_LAYER_SETTINGS.showLine);
                setShowVisitedPlaces(DEFAULT_MAP_LAYER_SETTINGS.showVisitedPlaces);
                setHidePoints(DEFAULT_MAP_LAYER_SETTINGS.hidePoints);
                setHidePlaces(DEFAULT_MAP_LAYER_SETTINGS.hidePlaces);
                try {
                  window.localStorage.removeItem(MAP_LAYER_SETTINGS_KEY);
                } catch {
                  // ignore local storage errors
                }
              }}
              className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              Reset map settings
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setLayersMenuOpen((open) => !open)}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white p-2.5 text-gray-600 shadow-md hover:bg-gray-50 hover:text-gray-800"
          aria-expanded={layersMenuOpen}
          aria-label="Open map layer settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path
              fillRule="evenodd"
              d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.223 1.164a6.98 6.98 0 0 1 1.48.85l1.08-.54a1 1 0 0 1 1.232.236l1.668 1.668a1 1 0 0 1 .236 1.232l-.54 1.08c.332.46.616.958.85 1.48l1.164.223a1 1 0 0 1 .804.98v2.36a1 1 0 0 1-.804.98l-1.164.223a6.98 6.98 0 0 1-.85 1.48l.54 1.08a1 1 0 0 1-.236 1.232l-1.668 1.668a1 1 0 0 1-1.232.236l-1.08-.54a6.98 6.98 0 0 1-1.48.85l-.223 1.164a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.223-1.164a6.98 6.98 0 0 1-1.48-.85l-1.08.54a1 1 0 0 1-1.232-.236L2.157 16.61a1 1 0 0 1-.236-1.232l.54-1.08a6.98 6.98 0 0 1-.85-1.48l-1.164-.223A1 1 0 0 1 .643 11.615v-2.36a1 1 0 0 1 .804-.98l1.164-.223a6.98 6.98 0 0 1 .85-1.48l-.54-1.08a1 1 0 0 1 .236-1.232L4.825 2.592a1 1 0 0 1 1.232-.236l1.08.54c.46-.332.958-.616 1.48-.85l.223-1.164ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
