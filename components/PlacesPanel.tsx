"use client";

import { useEffect, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
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
const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

function readSort(): PlacesSort {
  if (typeof window === "undefined") return "recent";
  const saved = window.localStorage.getItem(SORT_KEY);
  if (saved === "recent" || saved === "visits" || saved === "name") return saved;
  return "recent";
}

type PlacesPage = {
  places: PlacePanelItem[];
  nextOffset: number | null;
};

export default function PlacesPanel() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<PlacesSort>(() => readSort());
  const [editingPlace, setEditingPlace] = useState<PlacePanelItem | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SORT_KEY, sort);
    }
  }, [sort]);

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedQuery(query.trim()),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery<PlacesPage>({
      queryKey: ["places", "paged", debouncedQuery, sort],
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextOffset,
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(pageParam));
        params.set("sort", sort);
        if (debouncedQuery) params.set("q", debouncedQuery);
        const res = await fetch(`/api/places?${params}`);
        if (!res.ok) return { places: [], nextOffset: null };
        return res.json();
      },
    });

  const places = data?.pages.flatMap((p) => p.places) ?? [];
  const hasQuery = debouncedQuery.length > 0;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root, rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, places.length]);

  async function handleDelete(place: PlacePanelItem) {
    try {
      const res = await fetch(`/api/places/${place.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete place");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["places"] });
      queryClient.invalidateQueries({ queryKey: ["visits"] });
    } catch {
      toast.error("Failed to delete place");
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-col gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-3 w-16" />
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

  if (places.length === 0 && !hasQuery) {
    return <PlacesEmptyState />;
  }

  return (
    <div className="flex h-full flex-col">
      <PlacesToolbar
        query={query}
        onQueryChange={setQuery}
        sort={sort}
        onSortChange={setSort}
        count={places.length}
      />
      {places.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <p className="text-xs text-muted-foreground">
            No places match &quot;{debouncedQuery}&quot;
          </p>
          <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <ul className="space-y-0.5 p-2">
            {places.map((p) => (
              <li key={p.id}>
                <PlaceListItem
                  place={p}
                  onEdit={setEditingPlace}
                  onDelete={handleDelete}
                />
              </li>
            ))}
          </ul>
          <div ref={sentinelRef} aria-hidden="true" className="h-4" />
          {isFetchingNextPage && (
            <div className="space-y-1 px-2 pb-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-start gap-2.5 p-2">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
