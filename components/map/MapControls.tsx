"use client";

import React from "react";
import { format } from "date-fns";
import type { MapRef } from "react-map-gl/maplibre";
import { FIT_BOUNDS_PADDING, FIT_BOUNDS_MAX_ZOOM, type MapBounds } from "@/components/map/mapConstants";
import type { SerializedPoint } from "@/lib/groupByHour";

type ContextMenu = { x: number; y: number; lat: number; lon: number } | null;

type Props = {
  mapRef: React.RefObject<MapRef | null>;
  points: SerializedPoint[];
  pointsEnvelope?: MapBounds | null;
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
  pointsEnvelope = null,
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
      {(pointsEnvelope || points.length > 0) && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-900 flex gap-2">
          <button
            type="button"
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              if (pointsEnvelope) {
                map.fitBounds(
                  [[pointsEnvelope.minLon, pointsEnvelope.minLat], [pointsEnvelope.maxLon, pointsEnvelope.maxLat]],
                  { padding: FIT_BOUNDS_PADDING, duration: 800, maxZoom: FIT_BOUNDS_MAX_ZOOM }
                );
                return;
              }
              if (points.length === 0) return;
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M4.5 2.25a.75.75 0 000 1.5v12a.75.75 0 000 1.5h1.5a.75.75 0 000-1.5v-12a.75.75 0 000-1.5h-1.5zm9.75 0a.75.75 0 000 1.5v12a.75.75 0 000 1.5H15.75a.75.75 0 000-1.5v-12a.75.75 0 000-1.5h-1.5z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
            )}
          </button>
        </div>
      )}

    </>
  );
}
