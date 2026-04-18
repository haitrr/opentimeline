"use client";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PlaceListItem, {
  type PlacePanelItem,
} from "@/components/places/PlaceListItem";
import PlacesToolbar, {
  type PlacesSort,
} from "@/components/places/PlacesToolbar";
import PlacesEmptyState from "@/components/places/PlacesEmptyState";
import PlaceDetailModal from "@/components/PlaceDetailModal";

const SORT_KEY = "places.sort";

function readSort(): PlacesSort {
  if (typeof window === "undefined") return "recent";
  const saved = window.localStorage.getItem(SORT_KEY);
  if (saved === "recent" || saved === "visits" || saved === "name") return saved;
  return "recent";
}

function sortPlaces(list: PlacePanelItem[], sort: PlacesSort): PlacePanelItem[] {
  const copy = [...list];
  if (sort === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "visits") {
    copy.sort((a, b) => b.confirmedVisits - a.confirmedVisits);
  } else {
    copy.sort((a, b) => {
      const ta = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : -Infinity;
      const tb = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : -Infinity;
      return tb - ta;
    });
  }
  return copy;
}

export default function PlacesPanel() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PlacesSort>(() => readSort());
  const [editingPlace, setEditingPlace] = useState<PlacePanelItem | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SORT_KEY, sort);
    }
  }, [sort]);

  const { data: places = [], isLoading } = useQuery<PlacePanelItem[]>({
    queryKey: ["places"],
    queryFn: async () => {
      const res = await fetch("/api/places");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? places.filter((p) => p.name.toLowerCase().includes(q))
      : places;
    return sortPlaces(base, sort);
  }, [places, query, sort]);

  async function handleDelete(place: PlacePanelItem) {
    const res = await fetch(`/api/places/${place.id}`, { method: "DELETE" });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["places"] });
      queryClient.invalidateQueries({ queryKey: ["visits"] });
    }
  }

  if (isLoading && places.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-col gap-2 border-b px-3 py-2">
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="space-y-1 p-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-2.5 p-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (places.length === 0) {
    return <PlacesEmptyState />;
  }

  return (
    <div className="flex h-full flex-col">
      <PlacesToolbar
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        count={filtered.length}
      />
      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <p className="text-xs text-muted-foreground">
            No places match &quot;{query}&quot;
          </p>
          <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <ul className="space-y-0.5 p-2">
            {filtered.map((p) => (
              <li key={p.id}>
                <PlaceListItem
                  place={p}
                  onEdit={setEditingPlace}
                  onDelete={handleDelete}
                />
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}

      {editingPlace && (
        <PlaceDetailModal
          place={{
            ...editingPlace,
            lastVisitAt: editingPlace.lastVisitAt ?? undefined,
          }}
          onClose={() => setEditingPlace(null)}
        />
      )}
    </div>
  );
}
