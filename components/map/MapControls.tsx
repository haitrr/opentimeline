"use client";

import React from "react";
import { format } from "date-fns";
import type { MapRef } from "react-map-gl/maplibre";
import type { LayerSettings } from "@/components/map/hooks/useLayerSettings";
import { DEFAULT_MAP_LAYER_SETTINGS, FIT_BOUNDS_PADDING, FIT_BOUNDS_MAX_ZOOM, MAP_LAYER_SETTINGS_KEY } from "@/components/map/mapConstants";
import type { SerializedPoint } from "@/lib/groupByHour";

type ContextMenu = { x: number; y: number; lat: number; lon: number } | null;

type Props = {
  mapRef: React.RefObject<MapRef | null>;
  points: SerializedPoint[];
  layerSettings: LayerSettings;
  layersMenuOpen: boolean;
  setLayersMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  isPlaying: boolean;
  startPlay: () => void;
  stopPlay: () => void;
  playProgress: number;
  playTimestamp: number | null;
  playTimestampFmt: string;
  contextMenu: ContextMenu;
  setContextMenu: (menu: ContextMenu) => void;
  onCreateVisit?: (lat: number, lon: number) => void;
  onMapClick?: (lat: number, lon: number) => void;
};

export default function MapControls({
  mapRef,
  points,
  layerSettings,
  layersMenuOpen,
  setLayersMenuOpen,
  isPlaying,
  startPlay,
  stopPlay,
  playProgress,
  playTimestamp,
  playTimestampFmt,
  contextMenu,
  setContextMenu,
  onCreateVisit,
  onMapClick,
}: Props) {
  const {
    showHeatmap, setShowHeatmap,
    showLine, setShowLine,
    showVisitedPlaces, setShowVisitedPlaces,
    hidePoints, setHidePoints,
    hidePlaces, setHidePlaces,
    hidePhotos, setHidePhotos,
  } = layerSettings;

  return (
    <>
      {/* Right-click context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-999" onClick={() => setContextMenu(null)} />
          <div
            className="absolute z-1000 min-w-35 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {onCreateVisit && (
              <button
                type="button"
                onClick={() => {
                  onCreateVisit(contextMenu.lat, contextMenu.lon);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                Create visit here
              </button>
            )}
            {onMapClick && (
              <button
                type="button"
                onClick={() => {
                  onMapClick(contextMenu.lat, contextMenu.lon);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                Create place here
              </button>
            )}
          </div>
        </>
      )}

      {/* Journey playback progress bar */}
      {isPlaying && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-900 -translate-x-1/2">
          <div className="flex min-w-52 flex-col gap-1.5 rounded-xl border border-white/30 bg-black/60 px-4 py-2.5 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs font-medium text-white">
              <span>{playTimestamp != null ? format(new Date(playTimestamp * 1000), playTimestampFmt) : ""}</span>
              <span className="text-white/50">{Math.round(playProgress * 100)}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${playProgress * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Fit all points + Play journey buttons */}
      {points.length > 0 && (
        <div className="pointer-events-none absolute bottom-4 left-16 z-900 flex gap-2">
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
          <button
            type="button"
            onClick={isPlaying ? stopPlay : startPlay}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white p-2.5 text-gray-600 shadow-md hover:bg-gray-50 hover:text-gray-800"
            aria-label={isPlaying ? "Stop journey" : "Play journey"}
            title={isPlaying ? "Stop journey" : "Play journey"}
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M4.5 2.25a.75.75 0 000 1.5v12a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5v-12a.75.75 0 000-1.5h-1.5zm9.75 0a.75.75 0 000 1.5v12a.75.75 0 000 1.5H15.75a.75.75 0 000-1.5v-12a.75.75 0 000-1.5h-1.5z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            )}
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
            {([
              { label: "Heatmap", checked: showHeatmap, onChange: (v: boolean) => setShowHeatmap(v) },
              { label: "Path line", checked: showLine, onChange: (v: boolean) => setShowLine(v) },
              { label: "Visited places", checked: showVisitedPlaces, onChange: (v: boolean) => setShowVisitedPlaces(v) },
              { label: "Points", checked: !hidePoints, onChange: (v: boolean) => setHidePoints(!v) },
              { label: "Places", checked: !hidePlaces, onChange: (v: boolean) => setHidePlaces(!v) },
              { label: "Photos", checked: !hidePhotos, onChange: (v: boolean) => setHidePhotos(!v) },
            ] as const).map(({ label, checked, onChange }, idx) => (
              <label key={label} className={`${idx > 0 ? "mt-1 " : ""}flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100`}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onChange(e.target.checked)}
                  className="h-4 w-4"
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => {
                setShowHeatmap(DEFAULT_MAP_LAYER_SETTINGS.showHeatmap);
                setShowLine(DEFAULT_MAP_LAYER_SETTINGS.showLine);
                setShowVisitedPlaces(DEFAULT_MAP_LAYER_SETTINGS.showVisitedPlaces);
                setHidePoints(DEFAULT_MAP_LAYER_SETTINGS.hidePoints);
                setHidePlaces(DEFAULT_MAP_LAYER_SETTINGS.hidePlaces);
                setHidePhotos(DEFAULT_MAP_LAYER_SETTINGS.hidePhotos);
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path
              fillRule="evenodd"
              d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.223 1.164a6.98 6.98 0 0 1 1.48.85l1.08-.54a1 1 0 0 1 1.232.236l1.668 1.668a1 1 0 0 1 .236 1.232l-.54 1.08c.332.46.616.958.85 1.48l1.164.223a1 1 0 0 1 .804.98v2.36a1 1 0 0 1-.804.98l-1.164.223a6.98 6.98 0 0 1-.85 1.48l.54 1.08a1 1 0 0 1-.236 1.232l-1.668 1.668a1 1 0 0 1-1.232.236l-1.08-.54a6.98 6.98 0 0 1-1.48.85l-.223 1.164a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.223-1.164a6.98 6.98 0 0 1-1.48-.85l-1.08.54a1 1 0 0 1-1.232-.236L2.157 16.61a1 1 0 0 1-.236-1.232l.54-1.08a6.98 6.98 0 0 1-.85-1.48l-1.164-.223A1 1 0 0 1 .643 11.615v-2.36a1 1 0 0 1 .804-.98l1.164-.223a6.98 6.98 0 0 1 .85-1.48l-.54-1.08a1 1 0 0 1 .236-1.232L4.825 2.592a1 1 0 0 1 1.232-.236l1.08.54c.46-.332.958-.616 1.48-.85l.223-1.164ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </>
  );
}
