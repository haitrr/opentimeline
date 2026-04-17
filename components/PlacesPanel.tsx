"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type Place = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  confirmedVisits: number;
};

export default function PlacesPanel() {
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
    <div className="flex h-full flex-col px-4 py-3">
      {places.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Click anywhere on the map to add a place.
        </p>
      ) : (
        <>
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places…"
            className="mb-2 h-8 text-xs"
          />
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">No places match.</p>
          ) : (
            <ScrollArea className="flex-1">
              <ul className="space-y-0.5">
                {filtered.map((p) => (
                  <li
                    key={p.id}
                    className="cursor-pointer rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("opentimeline:fly-to", {
                          detail: { lat: p.lat, lon: p.lon },
                        })
                      )
                    }
                  >
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.radius}m · {p.confirmedVisits} visit
                      {p.confirmedVisits !== 1 ? "s" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </>
      )}
    </div>
  );
}
