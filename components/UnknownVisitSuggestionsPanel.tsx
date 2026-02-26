"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import type { ImmichPhoto } from "@/lib/immich";
import LazyVisitPhotos from "@/components/VisitPhotos";

type UnknownVisit = {
  id: number;
  lat: number;
  lon: number;
  arrivalAt: string;
  departureAt: string;
  pointCount: number;
  status: string;
};

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function UnknownVisitSuggestionsPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<UnknownVisit | null>(null);
  const [editing, setEditing] = useState<{ id: number; arrivalAt: string; departureAt: string } | null>(null);

  const { data: suggestions = [] } = useQuery<UnknownVisit[]>({
    queryKey: ["unknown-visits", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/unknown-visits?status=suggested");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const photoRange = useMemo(() => {
    if (suggestions.length === 0) return null;
    const starts = suggestions.map((s) => new Date(s.arrivalAt).getTime());
    const ends = suggestions.map((s) => new Date(s.departureAt).getTime());
    return {
      start: new Date(Math.min(...starts)).toISOString(),
      end: new Date(Math.max(...ends)).toISOString(),
    };
  }, [suggestions]);

  const { data: photos = [] } = useQuery<ImmichPhoto[]>({
    queryKey: ["immich", "unknown-suggestions", photoRange?.start, photoRange?.end],
    queryFn: async () => {
      if (!photoRange) return [];
      const params = new URLSearchParams({ start: photoRange.start, end: photoRange.end });
      const res = await fetch(`/api/immich?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!photoRange,
  });

  async function handleReject(id: number) {
    const res = await fetch(`/api/unknown-visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    if (res.ok) queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/unknown-visits/${id}`, { method: "DELETE" });
    if (res.ok) queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
  }

  async function handleEditSave(id: number) {
    if (!editing) return;
    const res = await fetch(`/api/unknown-visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arrivalAt: new Date(editing.arrivalAt).toISOString(),
        departureAt: new Date(editing.departureAt).toISOString(),
      }),
    });
    if (res.ok) {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    }
  }

  async function handlePlaceCreated(visit: UnknownVisit) {
    await fetch(`/api/unknown-visits/${visit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    setConfirming(null);
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
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
          <div className="max-h-80 overflow-y-auto px-4 pb-3">
            {suggestions.length === 0 ? (
              <p className="text-xs text-gray-400">No unknown place visits detected.</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li
                    key={s.id}
                    className="cursor-pointer rounded border border-amber-100 bg-amber-50 p-2 hover:bg-amber-100"
                    onClick={() => {
                      router.push(`/timeline/${format(new Date(s.arrivalAt), "yyyy-MM-dd")}`);
                      window.dispatchEvent(new CustomEvent("opentimeline:fly-to", { detail: { lat: s.lat, lon: s.lon } }));
                    }}
                  >
                    <p className="text-xs font-medium text-gray-700">
                      {s.lat.toFixed(5)}, {s.lon.toFixed(5)}
                    </p>
                    {editing?.id === s.id ? (
                      <div className="mt-1 space-y-1">
                        <div>
                          <label className="text-xs text-gray-500">Arrival</label>
                          <input
                            type="datetime-local"
                            value={editing.arrivalAt}
                            onChange={(e) => setEditing({ ...editing, arrivalAt: e.target.value })}
                            className="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Departure</label>
                          <input
                            type="datetime-local"
                            value={editing.departureAt}
                            onChange={(e) => setEditing({ ...editing, departureAt: e.target.value })}
                            className="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1 text-xs"
                          />
                        </div>
                        <div className="flex gap-1.5 pt-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditSave(s.id); }}
                            className="flex-1 rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                          >
                            Save
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditing(null); }}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500">
                          {format(new Date(s.arrivalAt), "MMM d, HH:mm")} –{" "}
                          {format(new Date(s.departureAt), "HH:mm")}
                        </p>
                        <p className="text-xs text-gray-400">{s.pointCount} points</p>
                        <LazyVisitPhotos photos={photos} arrivalAt={s.arrivalAt} departureAt={s.departureAt} />
                        <div className="mt-1.5 flex gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirming(s); }}
                            className="flex-1 rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                          >
                            Create Place
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditing({ id: s.id, arrivalAt: toDatetimeLocal(s.arrivalAt), departureAt: toDatetimeLocal(s.departureAt) }); }}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleReject(s.id); }}
                            className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                          >
                            Dismiss
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
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
          onCreated={() => handlePlaceCreated(confirming)}
        />
      )}
    </>
  );
}
