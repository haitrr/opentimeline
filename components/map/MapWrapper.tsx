"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SerializedPoint } from "@/lib/groupByHour";
import type { PlaceData } from "@/lib/detectVisits";
import type { ImmichPhoto } from "@/lib/immich";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import { fetchVisitCentroid } from "@/lib/visitCentroid";
import PlaceDetailModal from "@/components/PlaceDetailModal";
import PhotoModal from "@/components/PhotoModal";
import CreateVisitModal from "@/components/CreateVisitModal";
import { useLayerSettings } from "@/components/map/hooks/useLayerSettings";
import type { MapBounds } from "@/components/map/mapConstants";

const MapLibreMap = dynamic(() => import("@/components/map/MapLibreMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-400 border-t-transparent" />
        <p className="text-sm text-gray-500">Loading map…</p>
      </div>
    </div>
  ),
});

type Props = {
  rangeStart?: string;
  rangeEnd?: string;
  shouldAutoFit?: boolean;
};

type LocationsResponse = {
  points: SerializedPoint[];
  decimated: boolean;
  boundsIgnored: boolean;
  total: number;
};

const EMPTY_POINTS: SerializedPoint[] = [];

export type UnknownVisitData = {
  id: number;
  lat: number;
  lon: number;
  arrivalAt: string;
  departureAt: string;
  pointCount: number;
};

export default function MapWrapper({ rangeStart, rangeEnd, shouldAutoFit = false }: Props) {
  const queryClient = useQueryClient();
  const layerSettings = useLayerSettings();
  const [photoModal, setPhotoModal] = useState<{ list: ImmichPhoto[]; index: number } | null>(null);
  const [modalCoords, setModalCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceData | null>(null);
  const [pendingUnknownVisit, setPendingUnknownVisit] = useState<UnknownVisitData | null>(null);
  const [pendingPlaceMove, setPendingPlaceMove] = useState<{ place: PlaceData; lat: number; lon: number } | null>(null);
  const [createVisitCoords, setCreateVisitCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [updatingPlaceMove, setUpdatingPlaceMove] = useState(false);
  const [placeMoveError, setPlaceMoveError] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);
  const boundsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsIgnoredRef = useRef(false);

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current);
    boundsDebounceRef.current = setTimeout(() => {
      setMapBounds((prev) => {
        // When the server returned the full time-range unbounded, any bounds change
        // would refetch identical data — skip it to avoid a visible re-render.
        if (prev !== null && boundsIgnoredRef.current) return prev;
        const w = bounds.maxLon - bounds.minLon;
        const h = bounds.maxLat - bounds.minLat;
        const cellW = Math.max(w / 2, 0.005);
        const cellH = Math.max(h / 2, 0.005);
        return {
          minLon: Math.floor(bounds.minLon / cellW) * cellW - cellW,
          maxLon: Math.ceil(bounds.maxLon / cellW) * cellW + cellW,
          minLat: Math.floor(bounds.minLat / cellH) * cellH - cellH,
          maxLat: Math.ceil(bounds.maxLat / cellH) * cellH + cellH,
        };
      });
    }, 100);
  }, []);

  const locationsEnabled =
    mapBounds !== null && Boolean(rangeStart) && Boolean(rangeEnd);

  const { data: locationsData } = useQuery<LocationsResponse>({
    queryKey: ["locations", rangeStart, rangeEnd, mapBounds],
    enabled: locationsEnabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        start: rangeStart!,
        end: rangeEnd!,
        minLat: String(mapBounds!.minLat),
        maxLat: String(mapBounds!.maxLat),
        minLon: String(mapBounds!.minLon),
        maxLon: String(mapBounds!.maxLon),
        skipBoundsIfSmall: "true",
      });
      const res = await fetch(`/api/locations?${params}`);
      if (!res.ok) throw new Error(`locations ${res.status}`);
      return res.json();
    },
  });

  const points = locationsData?.points ?? EMPTY_POINTS;
  boundsIgnoredRef.current = locationsData?.boundsIgnored ?? false;

  const { data: pointsEnvelope = null } = useQuery<MapBounds | null>({
    queryKey: ["locations-bounds", rangeStart, rangeEnd],
    enabled: Boolean(rangeStart) && Boolean(rangeEnd),
    queryFn: async () => {
      const params = new URLSearchParams({ start: rangeStart!, end: rangeEnd! });
      const res = await fetch(`/api/locations/bounds?${params}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: places = [] } = useQuery<PlaceData[]>({
    queryKey: ["places", rangeStart, rangeEnd, mapBounds],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (rangeStart && rangeEnd) {
        params.set("start", rangeStart);
        params.set("end", rangeEnd);
      }
      if (mapBounds) {
        params.set("minLat", String(mapBounds.minLat));
        params.set("maxLat", String(mapBounds.maxLat));
        params.set("minLon", String(mapBounds.minLon));
        params.set("maxLon", String(mapBounds.maxLon));
      }
      const url = params.toString() ? `/api/places?${params}` : "/api/places";
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: layerSettings.settingsLoaded && mapBounds !== null,
  });

  const { data: unknownVisits = [] } = useQuery<UnknownVisitData[]>({
    queryKey: ["unknown-visits", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/unknown-visits?status=suggested");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: photos = [] } = useQuery<ImmichPhoto[]>({
    queryKey: ["immich", rangeStart, rangeEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ start: rangeStart!, end: rangeEnd! });
      const res = await fetch(`/api/immich?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(rangeStart && rangeEnd),
  });

  function handleMapClick(lat: number, lon: number) {
    setSelectedPlace(null);
    setModalCoords({ lat, lon });
  }

  function handlePlaceClick(place: PlaceData) {
    setModalCoords(null);
    setSelectedPlace(place);
  }

  function handlePlaceMoveRequest(place: PlaceData, lat: number, lon: number) {
    setSelectedPlace(null);
    setModalCoords(null);
    setPlaceMoveError(null);
    setPendingPlaceMove({ place, lat, lon });
  }

  async function handleConfirmPlaceMove() {
    if (!pendingPlaceMove) return;

    setUpdatingPlaceMove(true);
    setPlaceMoveError(null);
    try {
      const res = await fetch(`/api/places/${pendingPlaceMove.place.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pendingPlaceMove.lat, lon: pendingPlaceMove.lon }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setPlaceMoveError(data?.error ?? "Failed to update place location");
        return;
      }

      setPendingPlaceMove(null);
      queryClient.invalidateQueries({ queryKey: ["places"] });
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    } catch {
      setPlaceMoveError("Network error");
    } finally {
      setUpdatingPlaceMove(false);
    }
  }

  async function handlePlaceCreated(_place: PlaceData) {
    setModalCoords(null);
    if (pendingUnknownVisit) {
      await fetch(`/api/unknown-visits/${pendingUnknownVisit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      setPendingUnknownVisit(null);
    }
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  function handleCreateVisit(lat: number, lon: number) {
    setCreateVisitCoords({ lat, lon });
  }

  function handleVisitCreated() {
    setCreateVisitCoords(null);
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  async function handleUnknownVisitCreatePlace(uv: UnknownVisitData) {
    const centroid = await fetchVisitCentroid(uv.arrivalAt, uv.departureAt, uv);
    setPendingUnknownVisit(uv);
    setSelectedPlace(null);
    setModalCoords(centroid);
  }

  return (
    <div className="h-full w-full">
      <MapLibreMap
        points={points}
        pointsEnvelope={pointsEnvelope}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        rangeKey={`${rangeStart ?? ""}__${rangeEnd ?? ""}`}
        shouldAutoFit={shouldAutoFit}
        places={places}
        layerSettings={layerSettings}
        onBoundsChange={handleBoundsChange}
        unknownVisits={
          rangeStart && rangeEnd
            ? unknownVisits.filter(
                (uv) =>
                  new Date(uv.arrivalAt) <= new Date(rangeEnd) &&
                  new Date(uv.departureAt) >= new Date(rangeStart)
              )
            : unknownVisits
        }
        photos={photos}
        onMapClick={handleMapClick}
        onCreateVisit={handleCreateVisit}
        onPlaceClick={handlePlaceClick}
        onPlaceMoveRequest={handlePlaceMoveRequest}
        onUnknownVisitCreatePlace={handleUnknownVisitCreatePlace}
        onPhotoClick={(photo: ImmichPhoto, list?: ImmichPhoto[]) => {
          const photoList = list && list.length > 0 ? list : photos;
          const idx = photoList.findIndex((p) => p.id === photo.id);
          setPhotoModal({ list: photoList, index: idx >= 0 ? idx : 0 });
        }}
      />

      {modalCoords && (
        <PlaceCreationModal
          lat={modalCoords.lat}
          lon={modalCoords.lon}
          onClose={() => setModalCoords(null)}
          onCreated={handlePlaceCreated}
        />
      )}
      {selectedPlace && (
        <PlaceDetailModal
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
      )}
      {pendingPlaceMove && (
        <div className="fixed inset-0 z-900 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900">Update place location?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Move <span className="font-medium text-gray-800">{pendingPlaceMove.place.name}</span> to this location?
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {pendingPlaceMove.lat.toFixed(5)}, {pendingPlaceMove.lon.toFixed(5)}
            </p>
            {placeMoveError && <p className="mt-2 text-xs text-red-600">{placeMoveError}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (updatingPlaceMove) return;
                  setPendingPlaceMove(null);
                  setPlaceMoveError(null);
                }}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={updatingPlaceMove}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPlaceMove}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={updatingPlaceMove}
              >
                {updatingPlaceMove ? "Updating…" : "Update location"}
              </button>
            </div>
          </div>
        </div>
      )}
      {createVisitCoords && (
        <CreateVisitModal
          lat={createVisitCoords.lat}
          lon={createVisitCoords.lon}
          places={places}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onClose={() => setCreateVisitCoords(null)}
          onCreated={handleVisitCreated}
        />
      )}
      {photoModal && (
        <PhotoModal
          photos={photoModal.list}
          initialIndex={photoModal.index}
          onClose={() => setPhotoModal(null)}
        />
      )}
    </div>
  );
}
