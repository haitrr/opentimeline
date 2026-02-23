"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import PlaceCreationModal from "@/components/PlaceCreationModal";

type Visit = {
  id: number;
  arrivalAt: string;
  departureAt: string;
  status: string;
  place: { id: number; name: string; lat: number; lon: number };
};

export default function VisitSuggestionsPanel() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creatingPlaceForVisit, setCreatingPlaceForVisit] = useState<Visit | null>(null);

  const { data: visits = [] } = useQuery<Visit[]>({
    queryKey: ["visits", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/visits?status=suggested");
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function handleAction(id: number, status: "confirmed" | "rejected") {
    const res = await fetch(`/api/visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    }
  }

  async function handlePlaceCreatedForVisit(visitId: number, placeId: number) {
    const res = await fetch(`/api/visits/${visitId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId }),
    });

    if (res.ok) {
      setCreatingPlaceForVisit(null);
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    }
  }

  return (
    <div className="border-t border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50"
      >
        <span className="flex items-center gap-2">
          Visit Suggestions
          {visits.length > 0 && (
            <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-xs font-medium text-white leading-none">
              {visits.length}
            </span>
          )}
        </span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-3">
          {visits.length === 0 ? (
            <p className="text-xs text-gray-400">No pending suggestions.</p>
          ) : (
            <ul className="space-y-2">
              {visits.map((v) => (
                <li key={v.id} className="rounded border border-gray-100 bg-gray-50 p-2">
                  <p className="text-sm font-medium text-gray-800">{v.place.name}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(v.arrivalAt), "MMM d, HH:mm")} –{" "}
                    {format(new Date(v.departureAt), "HH:mm")}
                  </p>
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      onClick={() => setCreatingPlaceForVisit(v)}
                      className="flex-1 rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                    >
                      Create Place
                    </button>
                    <button
                      onClick={() => handleAction(v.id, "confirmed")}
                      className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => handleAction(v.id, "rejected")}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {creatingPlaceForVisit && (
        <PlaceCreationModal
          lat={creatingPlaceForVisit.place.lat}
          lon={creatingPlaceForVisit.place.lon}
          onClose={() => setCreatingPlaceForVisit(null)}
          onCreated={(place) => handlePlaceCreatedForVisit(creatingPlaceForVisit.id, place.id)}
        />
      )}
    </div>
  );
}
