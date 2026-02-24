"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Source, Layer, Marker, Popup, type MapRef, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { format } from "date-fns";
import type { SerializedPoint } from "@/lib/groupByHour";
import type { PlaceData } from "@/lib/detectVisits";
import type { UnknownVisitData } from "@/components/map/MapWrapper";
import type { ImmichPhoto } from "@/lib/immich";

type Props = {
  points: SerializedPoint[];
  rangeKey?: string;
  shouldAutoFit?: boolean;
  places?: PlaceData[];
  unknownVisits?: UnknownVisitData[];
  photos?: ImmichPhoto[];
  onMapClick?: (lat: number, lon: number) => void;
  onPlaceClick?: (place: PlaceData) => void;
  onPlaceMoveRequest?: (place: PlaceData, lat: number, lon: number) => void;
  onUnknownVisitCreatePlace?: (uv: UnknownVisitData) => void;
  onPhotoClick?: (photo: ImmichPhoto) => void;
};

type PopupState =
  | { kind: "point"; point: SerializedPoint; lat: number; lon: number }
  | { kind: "unknownVisit"; uv: UnknownVisitData; lat: number; lon: number }
  | { kind: "photo"; photo: ImmichPhoto; lat: number; lon: number }
  | null;

/** Generates a polygon approximating a geo-accurate circle of radiusM metres. */
function geoCircle(
  lat: number,
  lon: number,
  radiusM: number,
  steps = 64
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

const DEFAULT_MAP_LAYER_SETTINGS = {
  showHeatmap: false,
  showLine: true,
  showVisitedPlaces: true,
  hidePoints: false,
  hidePlaces: false,
};

const FIT_BOUNDS_PADDING = 40;
const FIT_BOUNDS_MAX_ZOOM = 16.5;

function computeInitialViewState(points: SerializedPoint[]) {
  if (points.length === 0) return { longitude: 0, latitude: 20, zoom: 2 };
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  return {
    bounds: [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ] as [[number, number], [number, number]],
    fitBoundsOptions: { padding: 40 },
  };
}

function FlyToHandler({ mapRef }: { mapRef: React.RefObject<MapRef | null> }) {
  useEffect(() => {
    function handler(e: Event) {
      const { lat, lon } = (e as CustomEvent<{ lat: number; lon: number }>).detail;
      mapRef.current?.flyTo({ center: [lon, lat], zoom: 17, duration: 1000 });
    }
    window.addEventListener("opentimeline:fly-to", handler);
    return () => window.removeEventListener("opentimeline:fly-to", handler);
  }, [mapRef]);
  return null;
}

export default function MapLibreMap({
  points,
  rangeKey,
  shouldAutoFit = false,
  places = [],
  unknownVisits = [],
  photos = [],
  onMapClick,
  onPlaceClick,
  onPlaceMoveRequest,
  onUnknownVisitCreatePlace,
  onPhotoClick,
}: Props) {
  const mapRef = useRef<MapRef>(null);

  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(DEFAULT_MAP_LAYER_SETTINGS.showHeatmap);
  const [showLine, setShowLine] = useState(DEFAULT_MAP_LAYER_SETTINGS.showLine);
  const [showVisitedPlaces, setShowVisitedPlaces] = useState(DEFAULT_MAP_LAYER_SETTINGS.showVisitedPlaces);
  const [hidePoints, setHidePoints] = useState(DEFAULT_MAP_LAYER_SETTINGS.hidePoints);
  const [hidePlaces, setHidePlaces] = useState(DEFAULT_MAP_LAYER_SETTINGS.hidePlaces);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const [popup, setPopup] = useState<PopupState>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<number | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const autoFitAppliedForRangeKeyRef = useRef<string | null>(null);

  const unknownVisitPopupPhotos = useMemo(() => {
    if (popup?.kind !== "unknownVisit") return [] as ImmichPhoto[];
    const start = new Date(popup.uv.arrivalAt).getTime();
    const end = new Date(popup.uv.departureAt).getTime();

    return photos
      .filter((photo) => {
        const takenAt = new Date(photo.takenAt).getTime();
        return takenAt >= start && takenAt <= end;
      })
      .sort(
        (a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime()
      );
  }, [popup, photos]);

  // Load layer settings from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MAP_LAYER_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MapLayerSettings;
      if (typeof parsed.showHeatmap === "boolean") setShowHeatmap(parsed.showHeatmap);
      if (typeof parsed.showLine === "boolean") setShowLine(parsed.showLine);
      if (typeof parsed.showVisitedPlaces === "boolean") setShowVisitedPlaces(parsed.showVisitedPlaces);
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

  // Save layer settings to localStorage
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

  // Theme detection
  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsDarkTheme(root.classList.contains("dark"));
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Meta key detection for place drag
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Meta") setIsCtrlPressed(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Meta") setIsCtrlPressed(false);
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

  // Apply fit only when explicitly requested by manual DateNav changes
  useEffect(() => {
    if (!shouldAutoFit) {
      autoFitAppliedForRangeKeyRef.current = null;
      return;
    }
    if (!isMapLoaded || !rangeKey || points.length === 0) return;
    if (autoFitAppliedForRangeKeyRef.current === rangeKey) return;

    const map = mapRef.current;
    if (!map) return;

    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    map.fitBounds(
      [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
      { padding: FIT_BOUNDS_PADDING, duration: 800, maxZoom: FIT_BOUNDS_MAX_ZOOM }
    );
    autoFitAppliedForRangeKeyRef.current = rangeKey;
  }, [shouldAutoFit, isMapLoaded, rangeKey, points]);

  // Compute initial view state once on mount
  const [initialViewState] = useState(() => computeInitialViewState(points));

  // Path GeoJSON
  const pathGeoJSON = useMemo(
    () => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: points.map((p) => [p.lon, p.lat]),
      },
      properties: {},
    }),
    [points]
  );

  // Location points GeoJSON (sampled for performance)
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
        properties: {
          id: p.id,
          isFirst,
          isLast,
          batt: p.batt,
          recordedAt: p.recordedAt,
          acc: p.acc,
          vel: p.vel,
        },
      });
    });
    return { type: "FeatureCollection" as const, features };
  }, [points]);

  // Heatmap GeoJSON with pre-computed weights
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

  // Place circles GeoJSON (polygon features with numeric IDs for feature state)
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

  // Place dots GeoJSON (point features + labels)
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
          },
        };
      }),
    }),
    [places, showVisitedPlaces, hoveredPlaceId]
  );

  // Unknown visits GeoJSON
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

  // Photos GeoJSON
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

  // Map click handler
  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const map = mapRef.current;
      if (!map) return;

      const candidateLayers = [
        "place-dot-circle",
        "place-circle-fill",
        "uv-fill",
        "photo-circles",
        "location-points",
      ].filter((id) => !!map.getLayer(id));

      const features = candidateLayers.length > 0
        ? map.queryRenderedFeatures(event.point, { layers: candidateLayers })
        : [];

      setPopup(null);

      if (features.length > 0) {
        const f = features[0];
        const layerId = f.layer.id;

        if (layerId === "place-dot-circle" || layerId === "place-circle-fill") {
          const placeId = f.properties?.placeId as number | undefined;
          const place = places.find((p) => p.id === placeId);
          if (place) onPlaceClick?.(place);
          return;
        }

        if (layerId === "uv-fill") {
          const props = f.properties as {
            uvId: number;
            lat: number;
            lon: number;
            arrivalAt: string;
            departureAt: string;
            pointCount: number;
          };
          const uv = unknownVisits.find((u) => u.id === props.uvId);
          if (uv) {
            setPopup({ kind: "unknownVisit", uv, lat: uv.lat, lon: uv.lon });
          }
          return;
        }

        if (layerId === "photo-circles") {
          const photoId = f.properties?.photoId as string | undefined;
          const photo = photos.find((p) => p.id === photoId);
          if (photo) {
            setPopup({ kind: "photo", photo, lat: photo.lat!, lon: photo.lon! });
          }
          return;
        }

        if (layerId === "location-points") {
          const props = f.properties as SerializedPoint;
          setPopup({ kind: "point", point: props, lat: event.lngLat.lat, lon: event.lngLat.lng });
          return;
        }

        return;
      }

      onMapClick?.(event.lngLat.lat, event.lngLat.lng);
    },
    [places, unknownVisits, photos, onMapClick, onPlaceClick]
  );

  // Mouse move handler for hover state and cursor
  const handleMouseMove = useCallback((event: MapLayerMouseEvent) => {
    const map = mapRef.current;
    if (!map) return;
    const candidateLayers = [
      "place-dot-circle",
      "place-circle-fill",
      "uv-fill",
      "photo-circles",
      "location-points",
    ].filter((id) => !!map.getLayer(id));

    const features = candidateLayers.length > 0
      ? map.queryRenderedFeatures(event.point, { layers: candidateLayers })
      : [];

    map.getCanvas().style.cursor = features.length > 0 ? "pointer" : "";

    const placeFeature = features.find(
      (f) => f.layer.id === "place-dot-circle" || f.layer.id === "place-circle-fill"
    );
    const newHoveredId = (placeFeature?.properties?.placeId as number | undefined) ?? null;
    setHoveredPlaceId((prev) => (prev === newHoveredId ? prev : newHoveredId));
  }, []);

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = "";
    setHoveredPlaceId(null);
  }, []);

  const mapStyle = isDarkTheme
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

  // Add arrow SDF image on map load
  const handleMapLoad = useCallback(() => {
    setIsMapLoaded(true);
    const map = mapRef.current;
    if (!map || map.hasImage("arrow-direction")) return;
    const size = 12;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(6, 4);
    ctx.lineTo(6, 1);
    ctx.lineTo(12, 6);
    ctx.lineTo(6, 11);
    ctx.lineTo(6, 8);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    const data = ctx.getImageData(0, 0, size, size).data;
    map.addImage("arrow-direction", { width: size, height: size, data }, { sdf: true });
  }, []);

  // Layer visibility helper
  const vis = (show: boolean) => (show ? "visible" : "none") as "visible" | "none";

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={initialViewState}
        onLoad={handleMapLoad}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ width: "100%", height: "100%" }}
      >
        <FlyToHandler mapRef={mapRef} />

        {/* Heatmap */}
        <Source id="heatmap" type="geojson" data={heatGeoJSON}>
          <Layer
            id="heatmap-layer"
            type="heatmap"
            layout={{ visibility: vis(showHeatmap) }}
            paint={{
              "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 2, 1],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.45, 11, 0.9, 14, 1.8],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 11, 7, 14, 12],
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0, "rgba(0,0,255,0)",
                0.2, "#93c5fd",
                0.5, "#c4b5fd",
                0.8, "#f472b6",
                1.0, "#ef4444",
              ],
              "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.75, 11, 0.80, 14, 0.85],
            }}
          />
        </Source>

        {/* Path line */}
        {points.length > 1 && (
          <Source id="path" type="geojson" data={pathGeoJSON}>
            <Layer
              id="path-line"
              type="line"
              layout={{ visibility: vis(showLine) }}
              paint={{
                "line-color": "#3b82f6",
                "line-width": showHeatmap ? 2 : 3,
                "line-opacity": showHeatmap ? 0.5 : 0.75,
              }}
            />
            <Layer
              id="path-arrows"
              type="symbol"
              layout={{
                visibility: vis(showLine),
                "symbol-placement": "line",
                "symbol-spacing": 80,
                "icon-image": "arrow-direction",
                "icon-size": 1,
                "icon-rotation-alignment": "map",
                "icon-allow-overlap": false,
              }}
              paint={{
                "icon-color": "#3b82f6",
                "icon-opacity": showHeatmap ? 0.5 : 0.75,
              }}
            />
          </Source>
        )}

        {/* Unknown visits (below place circles) */}
        <Source id="unknown-visits" type="geojson" data={unknownVisitsGeoJSON}>
          <Layer
            id="uv-fill"
            type="fill"
            layout={{ visibility: vis(!hidePlaces && showVisitedPlaces) }}
            paint={{ "fill-color": "#eab308", "fill-opacity": 0.2 }}
          />
          <Layer
            id="uv-outline"
            type="line"
            layout={{ visibility: vis(!hidePlaces && showVisitedPlaces) }}
            paint={{ "line-color": "#eab308", "line-width": 2, "line-dasharray": [5, 5] }}
          />
        </Source>

        {/* Place circles */}
        <Source id="place-circles" type="geojson" data={placeCirclesGeoJSON}>
          {/* Fill */}
          <Layer
            id="place-circle-fill"
            type="fill"
            layout={{ visibility: vis(!hidePlaces) }}
            filter={["any", ["get", "hasVisitsInRange"], ["get", "hovered"]]}
            paint={{
              "fill-color": ["case", ["get", "hasConfirmedInRange"], "#22c55e", "#a855f7"],
              "fill-opacity": ["case", ["get", "hasConfirmedInRange"], 0.2, 0.15],
            }}
          />
          {/* Solid outline: confirmed or hovered */}
          <Layer
            id="place-circle-solid-outline"
            type="line"
            layout={{ visibility: vis(!hidePlaces) }}
            filter={["any", ["get", "hasConfirmedInRange"], ["get", "hovered"]]}
            paint={{
              "line-color": ["case", ["get", "hasConfirmedInRange"], "#16a34a", "#7e22ce"],
              "line-width": 2,
            }}
          />
          {/* Dashed outline: suggested only, not confirmed, not hovered */}
          <Layer
            id="place-circle-dashed-outline"
            type="line"
            layout={{ visibility: vis(!hidePlaces) }}
            filter={["all",
              ["get", "hasSuggestedInRange"],
              ["!", ["get", "hasConfirmedInRange"]],
              ["!", ["get", "hovered"]],
            ]}
            paint={{
              "line-color": "#7e22ce",
              "line-width": 2,
              "line-dasharray": [6, 6],
            }}
          />
        </Source>

        {/* Location points */}
        <Source id="points" type="geojson" data={pointsGeoJSON}>
          <Layer
            id="location-points"
            type="circle"
            layout={{ visibility: vis(!hidePoints) }}
            paint={{
              "circle-radius": [
                "case",
                ["any", ["get", "isFirst"], ["get", "isLast"]], 6,
                4,
              ],
              "circle-color": [
                "case",
                ["get", "isFirst"], "#22c55e",
                ["get", "isLast"], "#ef4444",
                "#3b82f6",
              ],
              "circle-stroke-color": [
                "case",
                ["get", "isFirst"], "#15803d",
                ["get", "isLast"], "#b91c1c",
                "#1d4ed8",
              ],
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.85,
            }}
          />
        </Source>

        {/* Photos */}
        <Source id="photos" type="geojson" data={photosGeoJSON}>
          <Layer
            id="photo-circles"
            type="circle"
            paint={{
              "circle-radius": 6,
              "circle-color": "#a855f7",
              "circle-stroke-color": "#7e22ce",
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.9,
            }}
          />
        </Source>

        {/* Place dots + labels */}
        <Source id="place-dots" type="geojson" data={placeDotsGeoJSON}>
          <Layer
            id="place-dot-circle"
            type="circle"
            layout={{ visibility: vis(!hidePlaces) }}
            paint={{
              "circle-radius": ["case", ["get", "hasVisitsInRange"], 5, 3],
              "circle-color": ["case", ["get", "hasConfirmedInRange"], "#22c55e", "#a855f7"],
              "circle-stroke-color": ["case", ["get", "hasConfirmedInRange"], "#15803d", "#7e22ce"],
              "circle-stroke-width": ["case", ["get", "hasVisitsInRange"], 2, 1.5],
              "circle-opacity": 0.9,
            }}
          />
          <Layer
            id="place-labels"
            type="symbol"
            layout={{
              visibility: vis(!hidePlaces),
              "text-field": ["get", "name"],
              "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
              "text-size": 12,
              "text-anchor": "bottom",
              "text-offset": [0, -0.8],
              "text-optional": true,
            }}
            filter={["any", ["get", "hasVisitsInRange"], ["get", "hovered"]]}
            paint={{
              "text-color": isDarkTheme ? "#e5e7eb" : "#1f2937",
              "text-halo-color": isDarkTheme ? "#111827" : "#ffffff",
              "text-halo-width": 1.5,
            }}
          />
        </Source>

        {/* Unknown visit labels */}
        <Source id="uv-labels-source" type="geojson" data={unknownVisitsGeoJSON}>
          <Layer
            id="uv-labels"
            type="symbol"
            layout={{
              visibility: vis(!hidePlaces && showVisitedPlaces),
              "text-field": "Unknown",
              "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
              "text-size": 12,
              "text-anchor": "top",
              "text-offset": [0, 0.5],
              "text-optional": true,
            }}
            paint={{
              "text-color": isDarkTheme ? "#fcd34d" : "#b45309",
              "text-halo-color": isDarkTheme ? "#1f2937" : "#ffffff",
              "text-halo-width": 1.5,
            }}
          />
        </Source>

        {/* Drag handles when Meta key held */}
        {isCtrlPressed &&
          !hidePlaces &&
          places.map((place) => (
            <Marker
              key={`drag-${place.id}`}
              latitude={place.lat}
              longitude={place.lon}
              draggable
              onDragEnd={(e) =>
                onPlaceMoveRequest?.(place, e.lngLat.lat, e.lngLat.lng)
              }
            >
              <div className="h-4 w-4 rounded-full border-2 border-blue-700 bg-blue-500 opacity-80 shadow" style={{ cursor: "grab" }} />
            </Marker>
          ))}

        {/* Point popup */}
        {popup?.kind === "point" && (
          <Popup
            latitude={popup.lat}
            longitude={popup.lon}
            onClose={() => setPopup(null)}
            closeButton
            anchor="bottom"
          >
            <div className="text-xs">
              <p className="font-semibold">
                {format(new Date(popup.point.recordedAt), "HH:mm:ss")}
              </p>
              {popup.point.acc != null && (
                <p className="text-gray-500">±{Math.round(popup.point.acc)}m</p>
              )}
              {popup.point.batt != null && (
                <p className="text-gray-500">Battery: {popup.point.batt}%</p>
              )}
              {popup.point.vel != null && popup.point.vel > 0 && (
                <p className="text-gray-500">{Math.round(popup.point.vel)} km/h</p>
              )}
              <p className="mt-1 text-gray-400">
                {popup.lat.toFixed(5)}, {popup.lon.toFixed(5)}
              </p>
            </div>
          </Popup>
        )}

        {/* Unknown visit popup */}
        {popup?.kind === "unknownVisit" && (
          <Popup
            latitude={popup.lat}
            longitude={popup.lon}
            onClose={() => setPopup(null)}
            closeButton
            anchor="bottom"
          >
            <div className="text-xs" style={{ minWidth: 180, maxWidth: 260 }}>
              <p className="font-semibold text-yellow-700">Unknown</p>
              <p className="mt-0.5 text-gray-600">
                {format(new Date(popup.uv.arrivalAt), "MMM d, HH:mm")} –{" "}
                {format(new Date(popup.uv.departureAt), "HH:mm")}
              </p>
              <p className="mb-2 text-gray-400">{popup.uv.pointCount} points</p>

              {unknownVisitPopupPhotos.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 text-[11px] font-medium text-gray-500">
                    Photos in this period ({unknownVisitPopupPhotos.length})
                  </p>
                  <div className="flex gap-1 overflow-x-auto pb-1">
                    {unknownVisitPopupPhotos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => {
                          onPhotoClick?.(photo);
                          setPopup(null);
                        }}
                        className="shrink-0"
                        style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
                        title={format(new Date(photo.takenAt), "HH:mm")}
                        type="button"
                      >
                        <div
                          className="h-14 w-14 rounded bg-cover bg-center"
                          style={{ backgroundImage: `url(/api/immich/thumbnail?id=${photo.id})` }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {onUnknownVisitCreatePlace && (
                <button
                  onClick={() => {
                    onUnknownVisitCreatePlace(popup.uv);
                    setPopup(null);
                  }}
                  className="w-full rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                >
                  Create Place
                </button>
              )}
            </div>
          </Popup>
        )}

        {/* Photo popup */}
        {popup?.kind === "photo" && (
          <Popup
            latitude={popup.lat}
            longitude={popup.lon}
            onClose={() => setPopup(null)}
            closeButton
            anchor="bottom"
          >
            <div className="text-xs" style={{ minWidth: 120 }}>
              <button
                onClick={() => {
                  onPhotoClick?.(popup.photo);
                  setPopup(null);
                }}
                style={{ display: "block", padding: 0, border: "none", background: "none", cursor: "pointer" }}
              >
                <img
                  src={`/api/immich/thumbnail?id=${popup.photo.id}`}
                  alt=""
                  style={{ width: 128, height: 96, objectFit: "cover", borderRadius: 4, marginBottom: 4 }}
                />
              </button>
              <p className="text-center text-gray-500">
                {format(new Date(popup.photo.takenAt), "HH:mm")}
              </p>
            </div>
          </Popup>
        )}
      </Map>

      {/* Fit all points button */}
      {points.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-16 z-900">
          <button
            type="button"
            onClick={() => {
              const map = mapRef.current;
              if (!map || points.length === 0) return;
              const lats = points.map((p) => p.lat);
              const lons = points.map((p) => p.lon);
              map.fitBounds(
                [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
                { padding: FIT_BOUNDS_PADDING, duration: 800, maxZoom: FIT_BOUNDS_MAX_ZOOM }
              );
            }}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white p-2.5 text-gray-600 shadow-md hover:bg-gray-50 hover:text-gray-800"
            aria-label="Fit all points"
            title="Fit all points"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M13.28 7.78l3.22-3.22v2.69a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.69l-3.22 3.22a.75.75 0 001.06 1.06zM2 17.25v-4.5a.75.75 0 011.5 0v2.69l3.22-3.22a.75.75 0 011.06 1.06L4.56 16.5h2.69a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zM12.22 13.28l3.22 3.22h-2.69a.75.75 0 000 1.5h4.5a.75.75 0 00.75-.75v-4.5a.75.75 0 00-1.5 0v2.69l-3.22-3.22a.75.75 0 10-1.06 1.06zM3.5 4.56l3.22 3.22a.75.75 0 001.06-1.06L4.56 3.5h2.69a.75.75 0 000-1.5h-4.5a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0V4.56z" />
            </svg>
          </button>
        </div>
      )}

      {/* Layer settings menu */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-900">
        {layersMenuOpen && (
          <div className="pointer-events-auto absolute bottom-full left-0 mb-2 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
            <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Map layers
            </p>
            <label className="flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              <span>Heatmap</span>
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <label className="mt-1 flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              <span>Path line</span>
              <input
                type="checkbox"
                checked={showLine}
                onChange={(e) => setShowLine(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <label className="mt-1 flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              <span>Highlight visited places</span>
              <input
                type="checkbox"
                checked={showVisitedPlaces}
                onChange={(e) => setShowVisitedPlaces(e.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <label className="mt-1 flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              <span>Points</span>
              <input
                type="checkbox"
                checked={!hidePoints}
                onChange={(e) => setHidePoints(!e.target.checked)}
                className="h-4 w-4"
              />
            </label>
            <label className="mt-1 flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              <span>Places</span>
              <input
                type="checkbox"
                checked={!hidePlaces}
                onChange={(e) => setHidePlaces(!e.target.checked)}
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
