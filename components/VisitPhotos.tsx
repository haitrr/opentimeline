"use client";

import { useEffect, useRef, useState } from "react";
import type { ImmichPhoto } from "@/lib/immich";
import PhotoModal from "@/components/PhotoModal";

const MAX_VISIBLE = 5;

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
  const [showAll, setShowAll] = useState(false);
  const start = new Date(arrivalAt).getTime();
  const end = new Date(departureAt).getTime();
  const matching = photos.filter((p) => {
    const t = new Date(p.takenAt).getTime();
    return t >= start && t <= end;
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
            className="relative max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">{matching.length} photos</span>
              <button
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                onClick={() => setShowAll(false)}
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
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
