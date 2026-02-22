"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { format, differenceInMinutes } from "date-fns";
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
  let px: number;
  if (minMs === maxMs) {
    px = (MIN_GAP_PX + MAX_GAP_PX) / 2;
  } else {
    const t =
      (Math.log(gapMs + 1) - Math.log(minMs + 1)) /
      (Math.log(maxMs + 1) - Math.log(minMs + 1));
    px = MIN_GAP_PX + Math.max(0, Math.min(1, t)) * (MAX_GAP_PX - MIN_GAP_PX);
  }
  return yearChanges ? Math.max(px, YEAR_BADGE_MIN_PX) : px;
}

export default function PlaceDetailModal({ place, onClose }: Props) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<ImmichPhoto[]>([]);
  const [photoModal, setPhotoModal] = useState<{ list: ImmichPhoto[]; index: number } | null>(null);

  const fetchVisits = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/visits?placeId=${place.id}`);
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
  }, [place.id]);

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

  const displayed = visits.filter((v) =>
    filter === "confirmed" ? v.status === "confirmed" : v.status !== "rejected"
  );

  // Pre-compute ms gaps between consecutive visits (descending order)
  const gapsMs = displayed.slice(0, -1).map((v, i) =>
    new Date(v.arrivalAt).getTime() - new Date(displayed[i + 1].arrivalAt).getTime()
  );
  const minMs = gapsMs.length ? Math.min(...gapsMs) : 0;
  const maxMs = gapsMs.length ? Math.max(...gapsMs) : 0;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40">
      <div
        className="flex w-120 flex-col rounded-lg bg-white shadow-xl"
        style={{ maxHeight: "82vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{place.name}</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Radius: {place.radius}m &middot; {place.lat.toFixed(5)}, {place.lon.toFixed(5)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 mt-0.5 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1 border-b border-gray-100 px-5 py-2">
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
        <div className="flex-1 overflow-y-auto px-5 py-4">
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
                  : gapToPx(gapsMs[i], minMs, maxMs, yearChanges);
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
                              <button
                                onClick={() => handleConfirm(v.id)}
                                className="rounded bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-blue-700"
                              >
                                Confirm
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
