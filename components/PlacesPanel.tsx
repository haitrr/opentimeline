"use client";

import { useCallback, useEffect, useState } from "react";

type Place = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  confirmedVisits: number;
};

export default function PlacesPanel() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);

  const fetchPlaces = useCallback(async () => {
    const res = await fetch("/api/places");
    if (res.ok) setPlaces(await res.json());
  }, []);

  useEffect(() => {
    fetchPlaces();
    window.addEventListener("opentimeline:place-created", fetchPlaces);
    window.addEventListener("opentimeline:visits-updated", fetchPlaces);
    return () => {
      window.removeEventListener("opentimeline:place-created", fetchPlaces);
      window.removeEventListener("opentimeline:visits-updated", fetchPlaces);
    };
  }, [fetchPlaces]);

  async function handleDelete(id: number) {
    const res = await fetch(`/api/places/${id}`, { method: "DELETE" });
    if (res.ok) fetchPlaces();
  }

  return (
    <div className="border-t border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50"
      >
        <span>Places</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3">
          {places.length === 0 ? (
            <p className="text-xs text-gray-400">
              Click anywhere on the map to add a place.
            </p>
          ) : (
            <ul className="space-y-1">
              {places.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {p.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.radius}m · {p.confirmedVisits} visit
                      {p.confirmedVisits !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="ml-2 shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
                    title="Delete place"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
