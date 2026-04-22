"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConflictRange } from "@/lib/conflict-detection";
import type { StationarySuggestion } from "@/lib/stationary-detection";

export type SerializedDeviceFilter = {
  id: string;
  fromTime: string;
  toTime: string;
  deviceIds: string[];
  label: string | null;
  createdAt: string;
};

type FilterPayload = { fromTime: string; toTime: string; deviceIds: string[]; label?: string };

type DeviceFilterContextValue = {
  filters: SerializedDeviceFilter[];
  conflicts: ConflictRange[];
  setConflicts: (conflicts: ConflictRange[]) => void;
  stationarySuggestions: StationarySuggestion[];
  setStationarySuggestions: (suggestions: StationarySuggestion[]) => void;
  createFilter: (filter: FilterPayload) => Promise<void>;
  updateFilter: (id: string, filter: FilterPayload) => Promise<void>;
  deleteFilter: (id: string) => Promise<void>;
};

const DeviceFilterContext = createContext<DeviceFilterContextValue | null>(null);

export function DeviceFilterProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [conflicts, setConflicts] = useState<ConflictRange[]>([]);
  const [stationarySuggestions, setStationarySuggestions] = useState<StationarySuggestion[]>([]);

  const { data: filters = [] } = useQuery<SerializedDeviceFilter[]>({
    queryKey: ["device-filters"],
    queryFn: async () => {
      const res = await fetch("/api/device-filters");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createFilter = useCallback(
    async (filter: { fromTime: string; toTime: string; deviceIds: string[]; label?: string }) => {
      await fetch("/api/device-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filter),
      });
      queryClient.invalidateQueries({ queryKey: ["device-filters"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations-bounds"] });
    },
    [queryClient]
  );

  const updateFilter = useCallback(
    async (id: string, filter: FilterPayload) => {
      await fetch(`/api/device-filters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filter),
      });
      queryClient.invalidateQueries({ queryKey: ["device-filters"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations-bounds"] });
    },
    [queryClient]
  );

  const deleteFilter = useCallback(
    async (id: string) => {
      await fetch(`/api/device-filters/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["device-filters"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations-bounds"] });
    },
    [queryClient]
  );

  return (
    <DeviceFilterContext.Provider
      value={{ filters, conflicts, setConflicts, stationarySuggestions, setStationarySuggestions, createFilter, updateFilter, deleteFilter }}
    >
      {children}
    </DeviceFilterContext.Provider>
  );
}

export function useDeviceFilters() {
  const ctx = useContext(DeviceFilterContext);
  if (!ctx) throw new Error("useDeviceFilters must be inside DeviceFilterProvider");
  return ctx;
}
