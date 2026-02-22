"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import type { PlaceData } from "@/lib/detectVisits";

type UnknownVisit = {
  id: number;
  lat: number;
  lon: number;
  arrivalAt: string;
  departureAt: string;
  pointCount: number;
  status: string;
};

export default function UnknownVisitSuggestionsPanel() {
  const [suggestions, setSuggestions] = useState<UnknownVisit[]>([]);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<UnknownVisit | null>(null);

  const fetchSuggestions = useCallback(async () => {
    const res = await fetch("/api/unknown-visits?status=suggested");
    if (res.ok) setSuggestions(await res.json());
  }, []);

  useEffect(() => {
    fetchSuggestions();
    window.addEventListener("opentimeline:unknown-visits-detected", fetchSuggestions);
    return () => {
      window.removeEventListener("opentimeline:unknown-visits-detected", fetchSuggestions);
    };
  }, [fetchSuggestions]);

  async function handleReject(id: number) {
    const res = await fetch(`/api/unknown-visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    if (res.ok) fetchSuggestions();
  }

  async function handlePlaceCreated(visit: UnknownVisit, _place: PlaceData) {
    // Mark the unknown visit as confirmed now that a place exists
    await fetch(`/api/unknown-visits/${visit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    setConfirming(null);
    fetchSuggestions();
    window.dispatchEvent(new CustomEvent("opentimeline:place-created"));
  }

  return (
    <>
      <div className="border-t border-gray-200">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            Unknown Places
            {suggestions.length > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-medium text-white leading-none">
                {suggestions.length}
              </span>
            )}
          </span>
          <span className="text-gray-400">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <div className="px-4 pb-3">
            {suggestions.length === 0 ? (
              <p className="text-xs text-gray-400">No unknown place visits detected.</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li key={s.id} className="rounded border border-amber-100 bg-amber-50 p-2">
                    <p className="text-xs font-medium text-gray-700">
                      {s.lat.toFixed(5)}, {s.lon.toFixed(5)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(s.arrivalAt), "MMM d, HH:mm")} –{" "}
                      {format(new Date(s.departureAt), "HH:mm")}
                    </p>
                    <p className="text-xs text-gray-400">{s.pointCount} points</p>
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        onClick={() => setConfirming(s)}
                        className="flex-1 rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                      >
                        Create Place
                      </button>
                      <button
                        onClick={() => handleReject(s.id)}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {confirming && (
        <PlaceCreationModal
          lat={confirming.lat}
          lon={confirming.lon}
          onClose={() => setConfirming(null)}
          onCreated={(place) => handlePlaceCreated(confirming, place)}
        />
      )}
    </>
  );
}
