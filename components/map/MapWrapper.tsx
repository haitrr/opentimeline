"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SerializedPoint } from "@/lib/groupByHour";
import type { PlaceData } from "@/lib/detectVisits";
import type { ImmichPhoto } from "@/lib/immich";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import PlaceDetailModal from "@/components/PlaceDetailModal";
import PhotoModal from "@/components/PhotoModal";

const LeafletMap = dynamic(() => import("@/components/map/LeafletMap"), {
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
  points: SerializedPoint[];
  rangeStart?: string;
  rangeEnd?: string;
};

export type UnknownVisitData = {
  id: number;
  lat: number;
  lon: number;
  arrivalAt: string;
  departureAt: string;
  pointCount: number;
};

export default function MapWrapper({ points, rangeStart, rangeEnd }: Props) {
  const queryClient = useQueryClient();
  const [photoModal, setPhotoModal] = useState<{ list: ImmichPhoto[]; index: number } | null>(null);
  const [modalCoords, setModalCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceData | null>(null);
  const [pendingUnknownVisit, setPendingUnknownVisit] = useState<UnknownVisitData | null>(null);

  const { data: places = [] } = useQuery<PlaceData[]>({
    queryKey: ["places", rangeStart, rangeEnd],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (rangeStart && rangeEnd) {
        params.set("start", rangeStart);
        params.set("end", rangeEnd);
      }
      const url = params.toString() ? `/api/places?${params}` : "/api/places";
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
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

  function handleUnknownVisitCreatePlace(uv: UnknownVisitData) {
    setPendingUnknownVisit(uv);
    setSelectedPlace(null);
    setModalCoords({ lat: uv.lat, lon: uv.lon });
  }

  return (
    <div className="h-full w-full">
      <LeafletMap
        points={points}
        places={places}
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
        onPlaceClick={handlePlaceClick}
        onUnknownVisitCreatePlace={handleUnknownVisitCreatePlace}
        onPhotoClick={(photo) => {
          const idx = photos.findIndex((p) => p.id === photo.id);
          setPhotoModal({ list: photos, index: idx >= 0 ? idx : 0 });
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
