"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { SerializedPoint } from "@/lib/groupByHour";
import type { PlaceData } from "@/lib/detectVisits";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import PlaceDetailModal from "@/components/PlaceDetailModal";

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
};

export default function MapWrapper({ points }: Props) {
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [modalCoords, setModalCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceData | null>(null);

  const fetchPlaces = useCallback(async () => {
    const res = await fetch("/api/places");
    if (res.ok) setPlaces(await res.json());
  }, []);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  function handleMapClick(lat: number, lon: number) {
    setSelectedPlace(null);
    setModalCoords({ lat, lon });
  }

  function handlePlaceClick(place: PlaceData) {
    setModalCoords(null);
    setSelectedPlace(place);
  }

  function handlePlaceCreated(_place: PlaceData) {
    setModalCoords(null);
    fetchPlaces();
    window.dispatchEvent(new CustomEvent("opentimeline:place-created"));
  }

  return (
    <div className="h-full w-full">
      <LeafletMap
        points={points}
        places={places}
        onMapClick={handleMapClick}
        onPlaceClick={handlePlaceClick}
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
    </div>
  );
}
