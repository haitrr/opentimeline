"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import PhotoModal from "@/components/PhotoModal";
import type { ImmichPhoto } from "@/lib/immich";

type KnownVisit = {
  kind: "known";
  id: number;
  arrivalAt: string;
  departureAt: string;
  status: string;
  place: { id: number; name: string; lat: number; lon: number };
};

type UnknownVisit = {
  kind: "unknown";
  id: number;
  arrivalAt: string;
  departureAt: string;
  status: string;
  lat: number;
  lon: number;
  pointCount: number;
};

type TimelineItem = KnownVisit | UnknownVisit;

type NearbyPlaceOption = {
  id: number;
  name: string;
  distanceM: number;
};

function VisitPhotos({
  photos,
  arrivalAt,
  departureAt,
}: {
  photos: ImmichPhoto[];
  arrivalAt: string;
  departureAt: string;
}) {
  const [photoModal, setPhotoModal] = useState<{ list: ImmichPhoto[]; index: number } | null>(null);
  const start = new Date(arrivalAt).getTime();
  const end = new Date(departureAt).getTime();
  const matching = photos.filter((p) => {
    const t = new Date(p.takenAt).getTime();
    return t >= start && t <= end;
  });
  if (matching.length === 0) return null;
  return (
    <>
      <div className="mt-1.5 flex flex-nowrap gap-1 overflow-x-auto pb-0.5 pr-0.5">
        {matching.map((p, i) => (
          <button
            key={p.id}
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setPhotoModal({ list: matching, index: i });
            }}
          >
            <img
              src={`/api/immich/thumbnail?id=${p.id}`}
              alt=""
              className="h-12 w-16 shrink-0 rounded object-cover hover:opacity-80 transition-opacity"
            />
          </button>
        ))}
      </div>
      {photoModal && (
        <PhotoModal
          photos={photoModal.list}
          initialIndex={photoModal.index}
          onClose={() => setPhotoModal(null)}
        />
      )}
    </>
  );
}

function durationLabel(arrival: string, departure: string): string {
  const mins = Math.round(
    (new Date(departure).getTime() - new Date(arrival).getTime()) / 60000
  );
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export default function TimelineSidebar({
  rangeStart,
  rangeEnd,
}: {
  rangeStart?: string;
  rangeEnd?: string;
}) {
  const queryClient = useQueryClient();
  const [creatingPlace, setCreatingPlace] = useState<UnknownVisit | null>(null);
  const [creatingPlaceForVisit, setCreatingPlaceForVisit] = useState<KnownVisit | null>(null);
  const [editingVisit, setEditingVisit] = useState<KnownVisit | null>(null);
  const [editArrivalAt, setEditArrivalAt] = useState("");
  const [editDepartureAt, setEditDepartureAt] = useState("");
  const [editPlaceId, setEditPlaceId] = useState<number | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlaceOption[]>([]);
  const [loadingNearbyPlaces, setLoadingNearbyPlaces] = useState(false);
  const [editStatus, setEditStatus] = useState("suggested");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [editingUnknown, setEditingUnknown] = useState<UnknownVisit | null>(null);
  const [editUnknownArrivalAt, setEditUnknownArrivalAt] = useState("");
  const [editUnknownDepartureAt, setEditUnknownDepartureAt] = useState("");
  const [editUnknownError, setEditUnknownError] = useState<string | null>(null);
  const [savingUnknownEdit, setSavingUnknownEdit] = useState(false);

  const { data: knownVisits = [], isLoading: loadingVisits } = useQuery({
    queryKey: ["visits", rangeStart, rangeEnd],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (rangeStart) params.set("start", rangeStart);
      if (rangeEnd) params.set("end", rangeEnd);
      const res = await fetch(`/api/visits?${params}`);
      if (!res.ok) return [];
      return (await res.json())
        .filter((v: Omit<KnownVisit, "kind">) =>
          ["suggested", "confirmed"].includes(v.status)
        )
        .map((v: Omit<KnownVisit, "kind">) => ({ kind: "known" as const, ...v }));
    },
  });

  const { data: unknownVisitItems = [], isLoading: loadingUnknown } = useQuery({
    queryKey: ["unknown-visits", "suggested", rangeStart, rangeEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ status: "suggested" });
      if (rangeStart) params.set("start", rangeStart);
      if (rangeEnd) params.set("end", rangeEnd);
      const res = await fetch(`/api/unknown-visits?${params}`);
      if (!res.ok) return [];
      return (await res.json()).map((u: Omit<UnknownVisit, "kind">) => ({
        kind: "unknown" as const,
        ...u,
      }));
    },
  });

  const { data: photos = [] } = useQuery<ImmichPhoto[]>({
    queryKey: ["immich", rangeStart, rangeEnd],
    queryFn: async () => {
      const params = new URLSearchParams({ start: rangeStart!, end: rangeEnd! });
      const res = await fetch(`/api/immich?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(rangeStart && rangeEnd),
  });

  const items = useMemo<TimelineItem[]>(
    () =>
      [...knownVisits, ...unknownVisitItems].sort(
        (a, b) => new Date(b.arrivalAt).getTime() - new Date(a.arrivalAt).getTime()
      ),
    [knownVisits, unknownVisitItems]
  );

  const loading = loadingVisits || loadingUnknown;

  async function confirmVisit(id: number) {
    await fetch(`/api/visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  async function rejectVisit(id: number) {
    await fetch(`/api/visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  async function dismissUnknown(id: number) {
    await fetch(`/api/unknown-visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
  }

  function openEditUnknown(visit: UnknownVisit) {
    setEditingUnknown(visit);
    setEditUnknownArrivalAt(toDateTimeLocalValue(visit.arrivalAt));
    setEditUnknownDepartureAt(toDateTimeLocalValue(visit.departureAt));
    setEditUnknownError(null);
  }

  function closeEditUnknown() {
    setEditingUnknown(null);
    setEditUnknownArrivalAt("");
    setEditUnknownDepartureAt("");
    setEditUnknownError(null);
    setSavingUnknownEdit(false);
  }

  async function saveUnknownChanges() {
    if (!editingUnknown) return;
    const arrivalDate = new Date(editUnknownArrivalAt);
    const departureDate = new Date(editUnknownDepartureAt);
    if (Number.isNaN(arrivalDate.getTime()) || Number.isNaN(departureDate.getTime())) {
      setEditUnknownError("Arrival and departure time are required");
      return;
    }
    if (departureDate.getTime() <= arrivalDate.getTime()) {
      setEditUnknownError("Departure time must be after arrival time");
      return;
    }
    setSavingUnknownEdit(true);
    setEditUnknownError(null);
    try {
      const res = await fetch(`/api/unknown-visits/${editingUnknown.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arrivalAt: arrivalDate.toISOString(),
          departureAt: departureDate.toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditUnknownError(data.error ?? "Failed to update");
        return;
      }
      closeEditUnknown();
      queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    } catch {
      setEditUnknownError("Network error");
    } finally {
      setSavingUnknownEdit(false);
    }
  }

  async function deleteUnknownVisit() {
    if (!editingUnknown) return;
    const shouldDelete = window.confirm("Delete this unknown visit? This action cannot be undone.");
    if (!shouldDelete) return;
    setSavingUnknownEdit(true);
    setEditUnknownError(null);
    try {
      const res = await fetch(`/api/unknown-visits/${editingUnknown.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setEditUnknownError(data.error ?? "Failed to delete");
        return;
      }
      closeEditUnknown();
      queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    } catch {
      setEditUnknownError("Network error");
    } finally {
      setSavingUnknownEdit(false);
    }
  }

  async function handlePlaceCreated(visit: UnknownVisit) {
    await fetch(`/api/unknown-visits/${visit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    setCreatingPlace(null);
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  async function handlePlaceCreatedForVisit(visit: KnownVisit, placeId: number) {
    await fetch(`/api/visits/${visit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId }),
    });
    setCreatingPlaceForVisit(null);
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  async function loadNearbyPlaces(visitId: number) {
    setLoadingNearbyPlaces(true);
    try {
      const res = await fetch(`/api/visits/${visitId}/nearby-places`);
      if (!res.ok) {
        setNearbyPlaces([]);
        return;
      }
      const data = await res.json();
      setNearbyPlaces(Array.isArray(data.places) ? data.places : []);
    } catch {
      setNearbyPlaces([]);
    } finally {
      setLoadingNearbyPlaces(false);
    }
  }

  function openEditVisit(visit: KnownVisit) {
    setEditingVisit(visit);
    setEditArrivalAt(toDateTimeLocalValue(visit.arrivalAt));
    setEditDepartureAt(toDateTimeLocalValue(visit.departureAt));
    setEditPlaceId(visit.place.id);
    setNearbyPlaces([]);
    setEditStatus(visit.status);
    setEditError(null);
    void loadNearbyPlaces(visit.id);
  }

  function closeEditVisit() {
    setEditingVisit(null);
    setEditArrivalAt("");
    setEditDepartureAt("");
    setEditPlaceId(null);
    setNearbyPlaces([]);
    setLoadingNearbyPlaces(false);
    setEditStatus("suggested");
    setEditError(null);
    setSavingEdit(false);
  }

  async function saveVisitChanges() {
    if (!editingVisit) return;

    const arrivalDate = new Date(editArrivalAt);
    const departureDate = new Date(editDepartureAt);

    if (Number.isNaN(arrivalDate.getTime()) || Number.isNaN(departureDate.getTime())) {
      setEditError("Arrival and departure time are required");
      return;
    }

    if (departureDate.getTime() <= arrivalDate.getTime()) {
      setEditError("Departure time must be after arrival time");
      return;
    }

    if (editPlaceId == null) {
      setEditError("Please select a place");
      return;
    }

    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/visits/${editingVisit.id}`, {
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
        setEditError(data.error ?? "Failed to update visit");
        return;
      }

      closeEditVisit();
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    } catch {
      setEditError("Network error");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteVisit() {
    if (!editingVisit) return;
    const shouldDelete = window.confirm("Delete this visit? This action cannot be undone.");
    if (!shouldDelete) return;

    setSavingEdit(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/visits/${editingVisit.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? "Failed to delete visit");
        return;
      }

      closeEditVisit();
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    } catch {
      setEditError("Network error");
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-xs text-gray-400">Loading…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <p className="text-sm text-gray-400">No visits for this period.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="relative">
          <div className="absolute bottom-2 left-1.5 top-2 w-px bg-gray-200" />
          <ul className="space-y-4">
            {items.map((item) => {
              const isSuggested = item.status === "suggested";
              const isUnknown = item.kind === "unknown";
              const dotColor = isUnknown
                ? "border-amber-400"
                : isSuggested
                  ? "border-amber-400"
                  : "border-blue-500";

              const lat = item.kind === "known" ? item.place.lat : item.lat;
              const lon = item.kind === "known" ? item.place.lon : item.lon;

              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="relative flex items-start gap-3 cursor-pointer"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("opentimeline:fly-to", { detail: { lat, lon } })
                    )
                  }
                >
                  <div
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 bg-white ${dotColor}`}
                  />
                  <div className="min-w-0 flex-1">
                    {item.kind === "known" ? (
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-gray-900">{item.place.name}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void openEditVisit(item);
                          }}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Edit visit"
                          aria-label="Edit visit"
                        >
                          ✎
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-medium text-gray-500">
                          {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditUnknown(item);
                          }}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Edit unknown visit"
                          aria-label="Edit unknown visit"
                        >
                          ✎
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      {format(new Date(item.arrivalAt), "HH:mm")}
                      {" – "}
                      {format(new Date(item.departureAt), "HH:mm")}
                      <span className="ml-1.5 text-gray-400">
                        {durationLabel(item.arrivalAt, item.departureAt)}
                      </span>
                    </p>

                    <VisitPhotos
                      photos={photos}
                      arrivalAt={item.arrivalAt}
                      departureAt={item.departureAt}
                    />

                    {/* Actions for suggested known visit */}
                    {item.kind === "known" && isSuggested && (
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          onClick={() => setCreatingPlaceForVisit(item)}
                          className="flex-1 rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                        >
                          Create Place
                        </button>
                        <button
                          onClick={() => confirmVisit(item.id)}
                          className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => rejectVisit(item.id)}
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Actions for unknown visit suggestion */}
                    {item.kind === "unknown" && (
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          onClick={() => setCreatingPlace(item)}
                          className="flex-1 rounded bg-amber-500 px-2 py-1 text-xs font-medium text-white hover:bg-amber-600"
                        >
                          Create Place
                        </button>
                        <button
                          onClick={() => dismissUnknown(item.id)}
                          className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {creatingPlace && (
        <PlaceCreationModal
          lat={creatingPlace.lat}
          lon={creatingPlace.lon}
          onClose={() => setCreatingPlace(null)}
          onCreated={() => handlePlaceCreated(creatingPlace)}
        />
      )}

      {creatingPlaceForVisit && (
        <PlaceCreationModal
          lat={creatingPlaceForVisit.place.lat}
          lon={creatingPlaceForVisit.place.lon}
          onClose={() => setCreatingPlaceForVisit(null)}
          onCreated={(place) => handlePlaceCreatedForVisit(creatingPlaceForVisit, place.id)}
        />
      )}

      {editingUnknown && (
        <div className="fixed inset-0 z-1000 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full overflow-hidden rounded-lg bg-white shadow-xl sm:max-w-md">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Edit Unknown Visit</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {editingUnknown.lat.toFixed(5)}, {editingUnknown.lon.toFixed(5)}
                </p>
              </div>
              <button
                onClick={closeEditUnknown}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                disabled={savingUnknownEdit}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto px-5 py-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Arrival</label>
                <input
                  type="datetime-local"
                  value={editUnknownArrivalAt}
                  onChange={(e) => setEditUnknownArrivalAt(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  disabled={savingUnknownEdit}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Departure</label>
                <input
                  type="datetime-local"
                  value={editUnknownDepartureAt}
                  onChange={(e) => setEditUnknownDepartureAt(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  disabled={savingUnknownEdit}
                />
              </div>
              {editUnknownError && <p className="text-xs text-red-600">{editUnknownError}</p>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-3">
              <button
                onClick={deleteUnknownVisit}
                className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                disabled={savingUnknownEdit}
              >
                Delete
              </button>
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <button
                  onClick={closeEditUnknown}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  disabled={savingUnknownEdit}
                >
                  Cancel
                </button>
                <button
                  onClick={saveUnknownChanges}
                  className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                  disabled={savingUnknownEdit || !editUnknownArrivalAt || !editUnknownDepartureAt}
                >
                  {savingUnknownEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingVisit && (
        <div className="fixed inset-0 z-1000 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full overflow-hidden rounded-lg bg-white shadow-xl sm:max-w-md">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Edit Visit</h2>
                <p className="mt-0.5 text-xs text-gray-500">{editingVisit.place.name}</p>
              </div>
              <button
                onClick={closeEditVisit}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                disabled={savingEdit}
              >
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
                  disabled={savingEdit}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">Departure</label>
                <input
                  type="datetime-local"
                  value={editDepartureAt}
                  onChange={(e) => setEditDepartureAt(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  disabled={savingEdit}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">Place</label>
                <select
                  value={editPlaceId != null ? String(editPlaceId) : ""}
                  onChange={(e) =>
                    setEditPlaceId(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  disabled={savingEdit || loadingNearbyPlaces}
                >
                  <option value="">Select nearby place</option>
                  {nearbyPlaces.map((place) => (
                    <option key={place.id} value={place.id}>
                      {`${place.name} (${place.distanceM}m)`}
                    </option>
                  ))}
                </select>
                {loadingNearbyPlaces && (
                  <p className="mt-1 text-xs text-gray-400">Loading nearby places…</p>
                )}
                {!loadingNearbyPlaces && nearbyPlaces.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">No places found within 100m.</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  disabled={savingEdit}
                >
                  <option value="suggested">Suggested</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {editError && <p className="text-xs text-red-600">{editError}</p>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-3">
              <button
                onClick={deleteVisit}
                className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                disabled={savingEdit}
              >
                Delete
              </button>
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <button
                  onClick={closeEditVisit}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  onClick={saveVisitChanges}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={savingEdit || !editArrivalAt || !editDepartureAt || editPlaceId == null}
                >
                  {savingEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
