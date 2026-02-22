"use client";

import { useEffect, useState } from "react";
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
      <div className="mt-1.5 flex gap-1 overflow-x-auto pb-0.5">
        {matching.map((p, i) => (
          <button key={p.id} onClick={(e) => { e.stopPropagation(); setPhotoModal({ list: matching, index: i }); }}>
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

export default function TimelineSidebar({
  rangeStart,
  rangeEnd,
}: {
  rangeStart?: string;
  rangeEnd?: string;
}) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingPlace, setCreatingPlace] = useState<UnknownVisit | null>(null);
  const [photos, setPhotos] = useState<ImmichPhoto[]>([]);

  function buildParams(extra?: Record<string, string>) {
    const p = new URLSearchParams(extra);
    if (rangeStart) p.set("start", rangeStart);
    if (rangeEnd) p.set("end", rangeEnd);
    return p;
  }

  async function loadPhotos() {
    if (!rangeStart || !rangeEnd) return;
    const params = new URLSearchParams({ start: rangeStart, end: rangeEnd });
    const res = await fetch(`/api/immich?${params}`);
    if (res.ok) setPhotos(await res.json());
  }

  async function load() {
    const [visitsRes, unknownRes] = await Promise.all([
      fetch(`/api/visits?${buildParams()}`),
      fetch(`/api/unknown-visits?${buildParams({ status: "suggested" })}`),
    ]);

    const known: KnownVisit[] = visitsRes.ok
      ? (await visitsRes.json()).map((v: Omit<KnownVisit, "kind">) => ({
          kind: "known" as const,
          ...v,
        }))
      : [];

    const unknown: UnknownVisit[] = unknownRes.ok
      ? (await unknownRes.json()).map((u: Omit<UnknownVisit, "kind">) => ({
          kind: "unknown" as const,
          ...u,
        }))
      : [];

    const merged = [...known, ...unknown].sort(
      (a, b) => new Date(a.arrivalAt).getTime() - new Date(b.arrivalAt).getTime()
    );

    setItems(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
    loadPhotos();
    const events = [
      "opentimeline:visits-updated",
      "opentimeline:place-created",
      "opentimeline:unknown-visits-detected",
    ];
    events.forEach((e) => window.addEventListener(e, load));
    return () => events.forEach((e) => window.removeEventListener(e, load));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd]);

  async function confirmVisit(id: number) {
    await fetch(`/api/visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    window.dispatchEvent(new CustomEvent("opentimeline:visits-updated"));
    load();
  }

  async function rejectVisit(id: number) {
    await fetch(`/api/visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    window.dispatchEvent(new CustomEvent("opentimeline:visits-updated"));
    load();
  }

  async function dismissUnknown(id: number) {
    await fetch(`/api/unknown-visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    load();
  }

  async function handlePlaceCreated(visit: UnknownVisit) {
    await fetch(`/api/unknown-visits/${visit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    setCreatingPlace(null);
    window.dispatchEvent(new CustomEvent("opentimeline:place-created"));
    load();
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
                      <p className="truncate text-sm font-medium text-gray-900">
                        {item.place.name}
                      </p>
                    ) : (
                      <p className="truncate text-xs font-medium text-gray-500">
                        {item.lat.toFixed(4)}, {item.lon.toFixed(4)}
                      </p>
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
    </>
  );
}
