"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef, type MapLayerMouseEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { formatDistanceToNow } from "date-fns";
import { haversineKm } from "@/lib/geo";
import type { ImmichPhoto } from "@/lib/immich";
import { computeInitialViewState } from "@/components/map/mapUtils";
import { FIT_BOUNDS_PADDING, FIT_BOUNDS_MAX_ZOOM, type PopupState, type Props } from "@/components/map/mapConstants";
import { useLayerSettings } from "@/components/map/hooks/useLayerSettings";
import { useKeyboardShortcuts } from "@/components/map/hooks/useKeyboardShortcuts";
import { useJourneyPlayback } from "@/components/map/hooks/useJourneyPlayback";
import { useMapGeoJSON } from "@/components/map/hooks/useMapGeoJSON";
import FlyToHandler from "@/components/map/FlyToHandler";
import MapLayers from "@/components/map/MapLayers";
import MapPopups from "@/components/map/MapPopups";
import MapControls from "@/components/map/MapControls";
import PointsLegend from "@/components/map/PointsLegend";
import LayerToggleColumn from "@/components/map/LayerToggleColumn";

export default function MapLibreMap({
  points,
  pointsEnvelope = null,
  rangeStart,
  rangeEnd,
  rangeKey,
  shouldAutoFit = false,
  places = [],
  unknownVisits = [],
  photos = [],
  layerSettings: layerSettingsProp,
  onBoundsChange,
  onMapClick,
  onCreateVisit,
  onPlaceClick,
  onPlaceMoveRequest,
  onUnknownVisitCreatePlace,
  onPhotoClick,
}: Props) {
  const mapRef = useRef<MapRef>(null);

  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [popup, setPopup] = useState<PopupState>(null);
  const [hoveredPlace, setHoveredPlace] = useState<{ id: number; x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lat: number; lon: number } | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const autoFitDoneRef = useRef(false);

  const internalLayerSettings = useLayerSettings();
  const layerSettings = layerSettingsProp ?? internalLayerSettings;

  const shortcuts = useMemo(() => [
    { shortcut: { key: "p", meta: true }, handler: () => layerSettings.setHidePlaces(!layerSettings.hidePlaces) },
  ], [layerSettings]);
  useKeyboardShortcuts(shortcuts);

  const hoveredPlaceId = hoveredPlace?.id ?? null;
  const { isPlaying, playPos, playProgress, playTimestamp, startPlay, stopPlay } = useJourneyPlayback(points, rangeKey);
  const geoJSON = useMapGeoJSON(points, places, unknownVisits, photos, layerSettings.showVisitedPlaces, hoveredPlaceId, rangeStart, rangeEnd);

  const hoveredPlaceData = useMemo(
    () => (hoveredPlaceId != null ? places.find((p) => p.id === hoveredPlaceId) ?? null : null),
    [hoveredPlaceId, places]
  );

  const unknownVisitPopupPhotos = useMemo(() => {
    if (popup?.kind !== "unknownVisit") return [] as ImmichPhoto[];
    const start = new Date(popup.uv.arrivalAt).getTime();
    const end = new Date(popup.uv.departureAt).getTime();
    const { lat, lon } = popup.uv;
    return photos
      .filter((photo) => {
        const takenAt = new Date(photo.takenAt).getTime();
        if (takenAt < start || takenAt > end) return false;
        if (photo.lat != null && photo.lon != null) {
          return haversineKm(photo.lat, photo.lon, lat, lon) <= 0.5;
        }
        return true;
      })
      .sort((a, b) => new Date(a.takenAt).getTime() - new Date(b.takenAt).getTime());
  }, [popup, photos]);

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
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Meta") setIsCtrlPressed(true); };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === "Meta") setIsCtrlPressed(false); };
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

  // Auto-fit bounds only on initial load
  useEffect(() => {
    if (!shouldAutoFit || autoFitDoneRef.current) return;
    if (!isMapLoaded || !pointsEnvelope) return;
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(
      [[pointsEnvelope.minLon, pointsEnvelope.minLat], [pointsEnvelope.maxLon, pointsEnvelope.maxLat]],
      { padding: FIT_BOUNDS_PADDING, duration: 800, maxZoom: FIT_BOUNDS_MAX_ZOOM }
    );
    autoFitDoneRef.current = true;
  }, [shouldAutoFit, isMapLoaded, pointsEnvelope]);

  // Keep label layers on top after every render batch.
  // Guard: skip if place-labels is already the topmost layer, otherwise moveLayer()
  // triggers a re-render that fires idle again, creating an infinite GPU loop.
  useEffect(() => {
    if (!isMapLoaded) return;
    const map = mapRef.current;
    if (!map) return;
    const bringLabelsToTop = () => {
      try {
        const layers = map.getStyle()?.layers;
        if (layers && layers[layers.length - 1]?.id === "place-labels") return;
        if (map.getLayer("uv-labels")) map.moveLayer("uv-labels");
        if (map.getLayer("place-labels")) map.moveLayer("place-labels");
      } catch { /* layer may not exist yet */ }
    };
    bringLabelsToTop();
    map.on("idle", bringLabelsToTop);
    return () => { map.off("idle", bringLabelsToTop); };
  }, [isMapLoaded]);

  const reportBounds = useCallback(() => {
    if (!onBoundsChange) return;
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    onBoundsChange({
      minLon: bounds.getWest(),
      minLat: bounds.getSouth(),
      maxLon: bounds.getEast(),
      maxLat: bounds.getNorth(),
    });
  }, [onBoundsChange]);

  const [initialViewState] = useState(() => computeInitialViewState(points));

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const map = mapRef.current;
      if (!map) return;
      setContextMenu(null);

      const candidateLayers = [
        "place-dot-circle-unvisited", "place-dot-circle-visited", "place-circle-fill",
        "uv-fill", "photo-circles", "location-points",
      ].filter((id) => !!map.getLayer(id));

      const features = candidateLayers.length > 0
        ? map.queryRenderedFeatures(event.point, { layers: candidateLayers })
        : [];

      setPopup(null);
      if (features.length === 0) return;

      const f = features[0];
      const layerId = f.layer.id;

      if (layerId === "place-dot-circle-unvisited" || layerId === "place-dot-circle-visited" || layerId === "place-circle-fill") {
        const place = places.find((p) => p.id === (f.properties?.placeId as number | undefined));
        if (place) onPlaceClick?.(place);
        return;
      }
      if (layerId === "uv-fill") {
        const uv = unknownVisits.find((u) => u.id === (f.properties as { uvId: number }).uvId);
        if (uv) setPopup({ kind: "unknownVisit", uv, lat: uv.lat, lon: uv.lon });
        return;
      }
      if (layerId === "photo-circles") {
        const photo = photos.find((p) => p.id === (f.properties?.photoId as string | undefined));
        if (photo) setPopup({ kind: "photo", photo, lat: photo.lat!, lon: photo.lon! });
        return;
      }
      if (layerId === "location-points") {
        setPopup({ kind: "point", point: f.properties as never, lat: event.lngLat.lat, lon: event.lngLat.lng });
      }
    },
    [places, unknownVisits, photos, onPlaceClick]
  );

  const handleContextMenu = useCallback((event: MapLayerMouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.point.x, y: event.point.y, lat: event.lngLat.lat, lon: event.lngLat.lng });
  }, []);

  const handleMouseMove = useCallback((event: MapLayerMouseEvent) => {
    const map = mapRef.current;
    if (!map) return;
    const candidateLayers = [
      "place-dot-circle-unvisited", "place-dot-circle-visited", "place-circle-fill",
      "uv-fill", "photo-circles", "location-points",
    ].filter((id) => !!map.getLayer(id));

    const features = candidateLayers.length > 0
      ? map.queryRenderedFeatures(event.point, { layers: candidateLayers })
      : [];

    map.getCanvas().style.cursor = features.length > 0 ? "pointer" : "";
    const placeFeature = features.find(
      (f) => f.layer.id === "place-dot-circle-unvisited" || f.layer.id === "place-dot-circle-visited" || f.layer.id === "place-circle-fill"
    );
    const newHoveredId = (placeFeature?.properties?.placeId as number | undefined) ?? null;
    setHoveredPlace((prev) => {
      if (newHoveredId === null) return null;
      if (prev?.id === newHoveredId && prev.x === event.point.x && prev.y === event.point.y) return prev;
      return { id: newHoveredId, x: event.point.x, y: event.point.y };
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = "";
    setHoveredPlace(null);
  }, []);

  const handleMapLoad = useCallback(() => {
    setIsMapLoaded(true);
    const map = mapRef.current;
    if (!map) return;
    // Report initial bounds so MapWrapper can start loading places
    reportBounds();
    if (map.hasImage("arrow-direction")) return;
    const size = 12;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.moveTo(0, 4); ctx.lineTo(6, 4); ctx.lineTo(6, 1);
    ctx.lineTo(12, 6); ctx.lineTo(6, 11); ctx.lineTo(6, 8); ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    const data = ctx.getImageData(0, 0, size, size).data;
    map.addImage("arrow-direction", { width: size, height: size, data }, { sdf: true });
  }, [reportBounds]);

  const mapStyle = isDarkTheme
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

  const playTimestampFmt = points.length >= 2 &&
    new Date(points[0].tst * 1000).toDateString() !== new Date(points[points.length - 1].tst * 1000).toDateString()
    ? "MMM d, HH:mm"
    : "HH:mm";

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={initialViewState}
        onLoad={handleMapLoad}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMoveEnd={reportBounds}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <FlyToHandler mapRef={mapRef} />

        <MapLayers
          layerSettings={layerSettings}
          isDarkTheme={isDarkTheme}
          pathGeoJSON={geoJSON.pathGeoJSON}
          heatGeoJSON={geoJSON.heatGeoJSON}
          pointsGeoJSON={geoJSON.pointsGeoJSON}
          placeCirclesGeoJSON={geoJSON.placeCirclesGeoJSON}
          placeDotsGeoJSON={geoJSON.placeDotsGeoJSON}
          unknownVisitsGeoJSON={geoJSON.unknownVisitsGeoJSON}
          photosGeoJSON={geoJSON.photosGeoJSON}
          pointCount={points.length}
        />

        {/* Drag handles when Meta key held */}
        {isCtrlPressed && !layerSettings.hidePlaces && places.map((place) => (
          <Marker
            key={`drag-${place.id}`}
            latitude={place.lat}
            longitude={place.lon}
            draggable
            onDragEnd={(e) => onPlaceMoveRequest?.(place, e.lngLat.lat, e.lngLat.lng)}
          >
            <div className="h-4 w-4 rounded-full border-2 border-blue-700 bg-blue-500 opacity-80 shadow" style={{ cursor: "grab" }} />
          </Marker>
        ))}

        <MapPopups
          popup={popup}
          onClosePopup={() => setPopup(null)}
          unknownVisitPopupPhotos={unknownVisitPopupPhotos}
          onPhotoClick={onPhotoClick}
          onUnknownVisitCreatePlace={onUnknownVisitCreatePlace}
          allPhotos={photos}
          playPos={playPos}
          playTimestamp={playTimestamp}
          playTimestampFmt={playTimestampFmt}
        />
      </Map>

      <div className="pointer-events-none absolute top-4 right-4 z-900 flex items-start gap-2">
        <PointsLegend
          deviceColors={geoJSON.deviceColors}
          hidePoints={layerSettings.hidePoints}
        />
        <LayerToggleColumn layerSettings={layerSettings} />
      </div>

      {/* Place hover tooltip */}
      {hoveredPlace && hoveredPlaceData && (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-gray-900/90 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{ left: hoveredPlace.x + 12, top: hoveredPlace.y - 8 }}
        >
          <p className="font-semibold leading-tight">{hoveredPlaceData.name}</p>
          <p className="mt-0.5 text-gray-300">
            {hoveredPlaceData.lastVisitAt
              ? formatDistanceToNow(new Date(hoveredPlaceData.lastVisitAt), { addSuffix: true })
              : "No visits yet"}
          </p>
        </div>
      )}

      <MapControls
        mapRef={mapRef}
        points={points}
        pointsEnvelope={pointsEnvelope}
        isPlaying={isPlaying}
        startPlay={startPlay}
        stopPlay={stopPlay}
        playProgress={playProgress}
        playTimestamp={playTimestamp}
        playTimestampFmt={playTimestampFmt}
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        onCreateVisit={onCreateVisit}
        onMapClick={onMapClick}
      />
    </div>
  );
}
