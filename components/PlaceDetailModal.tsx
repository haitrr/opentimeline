"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { format, differenceInMinutes } from "date-fns";
import { useRouter } from "next/navigation";
import type { PlaceData } from "@/lib/detectVisits";
import type { ImmichPhoto } from "@/lib/immich";
import PhotoModal from "@/components/PhotoModal";

type Visit = {
  id: number;
  arrivalAt: string;
  departureAt: string;
  status: string;
};

type Props = {
  place: PlaceData;
  onClose: () => void;
};

type Filter = "all" | "confirmed";

const MIN_GAP_PX = 10;
const MAX_GAP_PX = 80;
const YEAR_BADGE_MIN_PX = 32; // enough vertical room to show the year badge

function parseTimeMs(value: string): number | null {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Log-scale normalisation of a gap (ms) to pixels. */
function gapToPx(
  gapMs: number,
  minMs: number,
  maxMs: number,
  yearChanges: boolean
): number {
  if (!Number.isFinite(gapMs) || gapMs < 0) {
    return yearChanges ? YEAR_BADGE_MIN_PX : MIN_GAP_PX;
  }

  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) {
    return yearChanges ? Math.max(MIN_GAP_PX, YEAR_BADGE_MIN_PX) : MIN_GAP_PX;
  }

  let px: number;
  if (minMs === maxMs) {
    px = (MIN_GAP_PX + MAX_GAP_PX) / 2;
  } else {
    const t =
      (Math.log(gapMs + 1) - Math.log(minMs + 1)) /
      (Math.log(maxMs + 1) - Math.log(minMs + 1));
    px = MIN_GAP_PX + Math.max(0, Math.min(1, t)) * (MAX_GAP_PX - MIN_GAP_PX);
  }
  const safePx = Number.isFinite(px) ? px : MIN_GAP_PX;
  return yearChanges ? Math.max(safePx, YEAR_BADGE_MIN_PX) : safePx;
}

export default function PlaceDetailModal({ place, onClose }: Props) {
  const router = useRouter();
  const [placeInfo, setPlaceInfo] = useState<PlaceData>(place);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<ImmichPhoto[]>([]);
  const [photoModal, setPhotoModal] = useState<{ list: ImmichPhoto[]; index: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(place.name);
  const [radiusInput, setRadiusInput] = useState(place.radius);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    setPlaceInfo(place);
    setNameInput(place.name);
    setRadiusInput(place.radius);
    setEditing(false);
    setEditError(null);
  }, [place]);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/visits?placeId=${placeInfo.id}`);
    if (res.ok) {
      const loaded: Visit[] = await res.json();
      setVisits(loaded);
      if (loaded.length > 0) {
        const start = loaded.reduce((min, v) => v.arrivalAt < min ? v.arrivalAt : min, loaded[0].arrivalAt);
        const end = loaded.reduce((max, v) => v.departureAt > max ? v.departureAt : max, loaded[0].departureAt);
        const photoRes = await fetch(`/api/immich?start=${start}&end=${end}`);
        if (photoRes.ok) setPhotos(await photoRes.json());
      }
    }
    setLoading(false);
  }, [placeInfo.id]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  async function handleConfirm(visitId: number) {
    const res = await fetch(`/api/visits/${visitId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    if (res.ok) {
      fetchVisits();
      window.dispatchEvent(new CustomEvent("opentimeline:visits-updated"));
    }
  }

  function handleViewDay(arrivalAt: string) {
    const day = format(new Date(arrivalAt), "yyyy-MM-dd");
    router.push(`/timeline/${day}`);
    onClose();
  }

  async function handleSavePlace() {
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setEditError("Name is required");
      return;
    }
    if (!Number.isFinite(radiusInput) || radiusInput <= 0) {
      setEditError("Radius must be a positive number");
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/places/${placeInfo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, radius: radiusInput }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? "Failed to update place");
        return;
      }

      const { place: updated } = await res.json();
      setPlaceInfo(updated);
      setNameInput(updated.name);
      setRadiusInput(updated.radius);
      setEditing(false);
      window.dispatchEvent(new CustomEvent("opentimeline:place-updated"));
      router.refresh();
    } catch {
      setEditError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlace() {
    const confirmed = window.confirm(
      `Delete place \"${placeInfo.name}\"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/places/${placeInfo.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? "Failed to delete place");
        return;
      }

      window.dispatchEvent(new CustomEvent("opentimeline:place-updated"));
      router.refresh();
      onClose();
    } catch {
      setEditError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  const displayed = visits
    .filter((v) =>
      filter === "confirmed" ? v.status === "confirmed" : v.status !== "rejected"
    )
    .sort((a, b) => new Date(b.arrivalAt).getTime() - new Date(a.arrivalAt).getTime());

  // Pre-compute idle-time gaps between consecutive visits (order-agnostic)
  const gapsMs = displayed.slice(0, -1).map((v, i) => {
    const nextVisit = displayed[i + 1];
    if (!nextVisit) return NaN;

    const currentStart = parseTimeMs(v.arrivalAt);
    const currentEnd = parseTimeMs(v.departureAt);
    const nextStart = parseTimeMs(nextVisit.arrivalAt);
    const nextEnd = parseTimeMs(nextVisit.departureAt);

    if (
      currentStart === null ||
      currentEnd === null ||
      nextStart === null ||
      nextEnd === null
    ) {
      return NaN;
    }

    const rawGap =
      currentStart <= nextStart
        ? nextStart - currentEnd
        : currentStart - nextEnd;

    return Math.max(0, rawGap);
  });
  const finiteGaps = gapsMs.filter((gap): gap is number => Number.isFinite(gap) && gap >= 0);
  const minMs = finiteGaps.length ? Math.min(...finiteGaps) : 0;
  const maxMs = finiteGaps.length ? Math.max(...finiteGaps) : 0;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-5">
          <div>
            {editing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Radius (m)</label>
                  <input
                    type="number"
                    value={radiusInput}
                    onChange={(e) => setRadiusInput(Number(e.target.value))}
                    min={1}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-base font-semibold text-gray-900">{placeInfo.name}</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  Radius: {placeInfo.radius}m &middot; {placeInfo.lat.toFixed(5)}, {placeInfo.lon.toFixed(5)}
                </p>
              </>
            )}
            {editError && <p className="mt-1 text-xs text-red-600">{editError}</p>}
          </div>
          <div className="ml-2 flex shrink-0 flex-wrap items-start justify-end gap-1.5 sm:ml-4">
            {editing ? (
              <>
                <button
                  onClick={handleSavePlace}
                  className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={saving || deleting || !nameInput.trim()}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleDeletePlace}
                  className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  disabled={saving || deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setNameInput(placeInfo.name);
                    setRadiusInput(placeInfo.radius);
                    setEditError(null);
                  }}
                  className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  disabled={saving || deleting}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="mt-0.5 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 px-4 py-2 sm:px-5">
          <span className="mr-2 text-xs text-gray-500">Show:</span>
          {(["all", "confirmed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f === "all" ? "All" : "Confirmed only"}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <p className="py-8 text-center text-xs text-gray-400">Loading…</p>
          ) : displayed.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">No visits to show.</p>
          ) : (
            <div className="relative">
              {/* Continuous vertical line */}
              <div className="absolute bottom-0 top-0 w-px bg-gray-200" style={{ left: 15 }} />

              {displayed.map((v, i) => {
                const arrival = new Date(v.arrivalAt);
                const departure = new Date(v.departureAt);
                const durationMin = differenceInMinutes(departure, arrival);
                const isSuggested = v.status === "suggested";
                const isLast = i === displayed.length - 1;

                // Gap spacer between this and the next visit
                const nextV = displayed[i + 1];
                const yearChanges =
                  !isLast &&
                  arrival.getFullYear() !== new Date(nextV.arrivalAt).getFullYear();
                const spacerPx = isLast
                  ? 0
                  : gapToPx(gapsMs[i] ?? NaN, minMs, maxMs, yearChanges);
                const nextYear = yearChanges
                  ? new Date(nextV.arrivalAt).getFullYear()
                  : null;

                return (
                  <Fragment key={v.id}>
                    {/* Visit row */}
                    <div className="relative flex items-start gap-3">
                      {/* Dot */}
                      <div
                        className={`relative z-10 mt-2.75 h-2.75 w-2.75 shrink-0 rounded-full border-2 border-white shadow ${
                          isSuggested ? "bg-amber-400" : "bg-[#1a7bb5]"
                        }`}
                        style={{ marginLeft: 10 }}
                      />
                      {/* Card */}
                      <div className="flex-1 rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800">
                              {format(arrival, "MMM d, yyyy")}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {format(arrival, "HH:mm")} &rarr; {format(departure, "HH:mm")}
                              <span className="ml-1.5 text-gray-400">
                                {formatDuration(durationMin)}
                              </span>
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium leading-none ${
                                isSuggested
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {isSuggested ? "Suggested" : "Confirmed"}
                            </span>
                            {isSuggested && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleConfirm(v.id)}
                                  className="rounded bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-blue-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => handleViewDay(v.arrivalAt)}
                                  className="rounded border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                                >
                                  View Day
                                </button>
                              </div>
                            )}
                            {!isSuggested && (
                              <button
                                onClick={() => handleViewDay(v.arrivalAt)}
                                className="rounded border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                              >
                                View Day
                              </button>
                            )}
                          </div>
                        </div>
                        {(() => {
                          const start = arrival.getTime();
                          const end = departure.getTime();
                          const matching = photos.filter((p) => {
                            const t = new Date(p.takenAt).getTime();
                            return t >= start && t <= end;
                          });
                          if (matching.length === 0) return null;
                          return (
                            <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
                              {matching.map((p, mi) => (
                                <button
                                  key={p.id}
                                  onClick={() => setPhotoModal({ list: matching, index: mi })}
                                  className="shrink-0"
                                >
                                  <img
                                    src={`/api/immich/thumbnail?id=${p.id}`}
                                    alt=""
                                    className="h-12 w-16 rounded object-cover hover:opacity-80 transition-opacity"
                                  />
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Proportional gap — year badge floats in the centre when year rolls over */}
                    {!isLast && (
                      <div
                        className="relative flex items-center justify-center"
                        style={{ height: spacerPx }}
                      >
                        {nextYear !== null && (
                          <span className="relative z-10 rounded-full bg-[#1a7bb5] px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
                            {nextYear}
                          </span>
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {photoModal && (
        <PhotoModal
          photos={photoModal.list}
          initialIndex={photoModal.index}
          onClose={() => setPhotoModal(null)}
        />
      )}
    </div>
  );
}
