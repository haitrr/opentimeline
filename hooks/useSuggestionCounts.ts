"use client";

import { useQuery } from "@tanstack/react-query";

type Visit = { id: number };
type UnknownVisit = { id: number };

export function useSuggestionCounts(): { suggestions: number; unknown: number } {
  const { data: visits = [] } = useQuery<Visit[]>({
    queryKey: ["visits", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/visits?status=suggested");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: unknownVisits = [] } = useQuery<UnknownVisit[]>({
    queryKey: ["unknown-visits", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/unknown-visits?status=suggested");
      if (!res.ok) return [];
      return res.json();
    },
  });

  return { suggestions: visits.length, unknown: unknownVisits.length };
}
