"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

type Place = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  confirmedVisits: number;
};

export default function PlacesPanel() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: places = [] } = useQuery<Place[]>({
    queryKey: ["places"],
    queryFn: async () => {
      const res = await fetch("/api/places");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filtered = places.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

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
        <div className="px-4 pb-3 max-h-[40vh] overflow-y-auto">
          {places.length === 0 ? (
            <p className="text-xs text-gray-400">
              Click anywhere on the map to add a place.
            </p>
          ) : (
            <>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search places…"
                className="mb-2 w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 outline-none focus:border-gray-400"
              />
              {filtered.length === 0 ? (
                <p className="text-xs text-gray-400">No places match.</p>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((p) => (
                    <li
                      key={p.id}
                      className="cursor-pointer rounded px-2 py-1.5 hover:bg-gray-50"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("opentimeline:fly-to", {
                            detail: { lat: p.lat, lon: p.lon },
                          })
                        )
                      }
                    >
                      <p className="truncate text-sm font-medium text-gray-800">
                        {p.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.radius}m · {p.confirmedVisits} visit
                        {p.confirmedVisits !== 1 ? "s" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
