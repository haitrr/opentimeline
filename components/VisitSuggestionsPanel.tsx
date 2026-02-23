"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";

type Visit = {
  id: number;
  arrivalAt: string;
  departureAt: string;
  status: string;
  place: { id: number; name: string };
};

export default function VisitSuggestionsPanel() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [open, setOpen] = useState(false);

  const fetchVisits = useCallback(async () => {
    const res = await fetch("/api/visits?status=suggested");
    if (res.ok) setVisits(await res.json());
  }, []);

  useEffect(() => {
    fetchVisits();
    window.addEventListener("opentimeline:place-created", fetchVisits);
    window.addEventListener("opentimeline:visits-updated", fetchVisits);
    return () => {
      window.removeEventListener("opentimeline:place-created", fetchVisits);
      window.removeEventListener("opentimeline:visits-updated", fetchVisits);
    };
  }, [fetchVisits]);

  async function handleAction(id: number, status: "confirmed" | "rejected") {
    const res = await fetch(`/api/visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      fetchVisits();
      window.dispatchEvent(new CustomEvent("opentimeline:visits-updated"));
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
    </div>
  );
}
