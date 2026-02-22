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
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [unknownVisits, setUnknownVisits] = useState<UnknownVisitData[]>([]);
  const [modalCoords, setModalCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceData | null>(null);
  const [pendingUnknownVisit, setPendingUnknownVisit] = useState<UnknownVisitData | null>(null);

  const fetchPlaces = useCallback(async () => {
    const res = await fetch("/api/places");
    if (res.ok) setPlaces(await res.json());
  }, []);

  const fetchUnknownVisits = useCallback(async () => {
    const res = await fetch("/api/unknown-visits?status=suggested");
    if (res.ok) setUnknownVisits(await res.json());
  }, []);

  useEffect(() => {
    fetchPlaces();
    fetchUnknownVisits();
    window.addEventListener("opentimeline:unknown-visits-detected", fetchUnknownVisits);
    return () => {
      window.removeEventListener("opentimeline:unknown-visits-detected", fetchUnknownVisits);
    };
  }, [fetchPlaces, fetchUnknownVisits]);

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
      fetchUnknownVisits();
    }
    fetchPlaces();
    window.dispatchEvent(new CustomEvent("opentimeline:place-created"));
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
        onMapClick={handleMapClick}
        onPlaceClick={handlePlaceClick}
        onUnknownVisitCreatePlace={handleUnknownVisitCreatePlace}
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
