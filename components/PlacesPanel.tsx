"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
    <Collapsible open={open} onOpenChange={setOpen} className="border-t">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted">
        <span>Places</span>
        <span>{open ? "▲" : "▼"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-3">
          {places.length === 0 ? (
            <p className="text-xs text-muted-foreground">
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
                <ScrollArea className="max-h-[40vh]">
                  <ul className="space-y-1">
                    {filtered.map((p) => (
                      <li
                        key={p.id}
                        className="cursor-pointer rounded px-2 py-1.5 transition-colors hover:bg-muted"
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
      </CollapsibleContent>
    </Collapsible>
  );
}
