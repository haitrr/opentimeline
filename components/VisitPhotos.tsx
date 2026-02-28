"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ImmichPhoto } from "@/lib/immich";
import { haversineKm } from "@/lib/geo";
import PhotoModal from "@/components/PhotoModal";

const MAX_VISIBLE = 5;
const LOCATION_RADIUS_KM = 0.5;

export function VisitPhotos({
  photos,
  arrivalAt,
  departureAt,
  lat,
  lon,
}: {
  photos: ImmichPhoto[];
  arrivalAt: string;
  departureAt: string;
  lat?: number;
  lon?: number;
}) {
  const [photoModal, setPhotoModal] = useState<{ list: ImmichPhoto[]; index: number } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const start = new Date(arrivalAt).getTime();
  const end = new Date(departureAt).getTime();
  const matching = photos.filter((p) => {
    const t = new Date(p.takenAt).getTime();
    if (t < start || t > end) return false;
    if (lat != null && lon != null && p.lat != null && p.lon != null) {
      return haversineKm(p.lat, p.lon, lat, lon) <= LOCATION_RADIUS_KM;
    }
    return true;
  });
  if (matching.length === 0) return null;

  const visible = matching.slice(0, MAX_VISIBLE);
  const overflow = matching.length - MAX_VISIBLE;

  return (
    <>
      <div className="mt-1.5 flex flex-nowrap gap-1 pb-0.5 pr-0.5">
        {visible.map((p, i) => (
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
              loading="lazy"
              className="h-12 w-16 shrink-0 rounded object-cover hover:opacity-80 transition-opacity"
            />
          </button>
        ))}
        {overflow > 0 && (
          <button
            className="flex h-12 w-16 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setShowAll(true);
            }}
          >
            +{overflow}
          </button>
        )}
      </div>

      {showAll && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowAll(false)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
              <span className="text-sm font-semibold text-gray-700">{matching.length} photos</span>
              <button
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                onClick={() => setShowAll(false)}
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {matching.map((p, i) => (
                  <button
                    key={p.id}
                    className="aspect-square overflow-hidden rounded"
                    onClick={() => {
                      setShowAll(false);
                      setPhotoModal({ list: matching, index: i });
                    }}
                  >
                    <img
                      src={`/api/immich/thumbnail?id=${p.id}`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover hover:opacity-80 transition-opacity"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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

export function FetchVisitPhotos({ arrivalAt, departureAt, lat, lon }: { arrivalAt: string; departureAt: string; lat?: number; lon?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { rootMargin: "100px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  const { data: photos = [] } = useQuery<ImmichPhoto[]>({
    queryKey: ["immich", arrivalAt, departureAt],
    queryFn: async () => {
      const res = await fetch(`/api/immich?start=${arrivalAt}&end=${departureAt}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: Infinity,
    enabled: inView,
  });

  return (
    <div ref={ref}>
      {inView && <VisitPhotos photos={photos} arrivalAt={arrivalAt} departureAt={departureAt} lat={lat} lon={lon} />}
    </div>
  );
}

export default function LazyVisitPhotos(props: {
  photos: ImmichPhoto[];
  arrivalAt: string;
  departureAt: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { rootMargin: "300px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  return (
    <div ref={ref}>
      {inView && <VisitPhotos {...props} />}
    </div>
  );
}
