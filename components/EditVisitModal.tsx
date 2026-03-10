"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PlaceData } from "@/lib/detectVisits";
import type { Visit } from "@/components/VisitCard";
import { toDateTimeLocalValue } from "@/lib/placeDetailUtils";

type NearbyPlaceOption = {
  id: number;
  name: string;
  distanceM: number;
};

type Props = {
  visit: Visit;
  placeInfo: PlaceData;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditVisitModal({ visit, placeInfo, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [editArrivalAt, setEditArrivalAt] = useState(toDateTimeLocalValue(visit.arrivalAt));
  const [editDepartureAt, setEditDepartureAt] = useState(toDateTimeLocalValue(visit.departureAt));
  const [editPlaceId, setEditPlaceId] = useState<number | null>(placeInfo.id);
  const [editStatus, setEditStatus] = useState(visit.status);
  const [editVisitError, setEditVisitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlaceOption[]>([]);
  const [loadingNearbyPlaces, setLoadingNearbyPlaces] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoadingNearbyPlaces(true);
      try {
        const res = await fetch(`/api/visits/${visit.id}/nearby-places`);
        if (res.ok) {
          const data = await res.json();
          setNearbyPlaces(Array.isArray(data.places) ? data.places : []);
        }
      } catch {
        // ignore
      } finally {
        setLoadingNearbyPlaces(false);
      }
    })();
  }, [visit.id]);

  const placeOptions = useMemo(() => {
    const others = nearbyPlaces.filter((p) => p.id !== placeInfo.id);
    return [{ id: placeInfo.id, name: placeInfo.name, distanceM: 0 }, ...others];
  }, [nearbyPlaces, placeInfo.id, placeInfo.name]);

  async function handleSave() {
    const arrivalDate = new Date(editArrivalAt);
    const departureDate = new Date(editDepartureAt);
    if (Number.isNaN(arrivalDate.getTime()) || Number.isNaN(departureDate.getTime())) {
      setEditVisitError("Arrival and departure time are required");
      return;
    }
    if (departureDate.getTime() <= arrivalDate.getTime()) {
      setEditVisitError("Departure time must be after arrival time");
      return;
    }
    if (editPlaceId == null) {
      setEditVisitError("Please select a place");
      return;
    }
    setSaving(true);
    setEditVisitError(null);
    try {
      const res = await fetch(`/api/visits/${visit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: editPlaceId,
          arrivalAt: arrivalDate.toISOString(),
          departureAt: departureDate.toISOString(),
          status: editStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditVisitError(data.error ?? "Failed to update visit");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
      onSaved();
    } catch {
      setEditVisitError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this visit? This action cannot be undone.")) return;
    setSaving(true);
    setEditVisitError(null);
    try {
      const res = await fetch(`/api/visits/${visit.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setEditVisitError(data.error ?? "Failed to delete visit");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
      onSaved();
    } catch {
      setEditVisitError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-1001 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-hidden rounded-lg bg-white shadow-xl sm:max-w-md">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Edit Visit</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" disabled={saving}>
            ✕
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Arrival</label>
            <input
              type="datetime-local"
              value={editArrivalAt}
              onChange={(e) => setEditArrivalAt(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Departure</label>
            <input
              type="datetime-local"
              value={editDepartureAt}
              onChange={(e) => setEditDepartureAt(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              disabled={saving}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Place</label>
            <select
              value={editPlaceId != null ? String(editPlaceId) : ""}
              onChange={(e) => setEditPlaceId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              disabled={saving || loadingNearbyPlaces}
            >
              {placeOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === placeInfo.id ? `${p.name} (current)` : `${p.name} (${p.distanceM}m)`}
                </option>
              ))}
            </select>
            {loadingNearbyPlaces && <p className="mt-1 text-xs text-gray-400">Loading nearby places…</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              disabled={saving}
            >
              <option value="suggested">Suggested</option>
              <option value="confirmed">Confirmed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {editVisitError && <p className="text-xs text-red-600">{editVisitError}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-3">
          <button
            onClick={handleDelete}
            className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            disabled={saving}
          >
            Delete
          </button>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <button
              onClick={onClose}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={saving || !editArrivalAt || !editDepartureAt || editPlaceId == null}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
