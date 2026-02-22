"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { ImmichPhoto } from "@/lib/immich";

type Props = {
  photos: ImmichPhoto[];
  initialIndex: number;
  onClose: () => void;
};

export default function PhotoModal({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [loadedPhotoId, setLoadedPhotoId] = useState<string | null>(null);
  const photo = photos[index];
  const isLoading = loadedPhotoId !== photo?.id;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(photos.length - 1, i + 1));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, photos.length]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-2000 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-[calc(90vh-48px)] w-[90vw] rounded-t-lg bg-black/60">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-white/70">
              Loading photo...
            </div>
          )}
          <img
            key={photo.id}
            src={`/api/immich/thumbnail?id=${photo.id}&size=preview`}
            alt=""
            onLoad={() => setLoadedPhotoId(photo.id)}
            onError={() => setLoadedPhotoId(photo.id)}
            className={`h-full w-full object-contain shadow-2xl ${isLoading ? "invisible" : "visible"}`}
          />
        </div>
        <div className="flex items-center justify-between rounded-b-lg bg-black/70 px-3 py-2">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="text-2xl leading-none px-2 text-white/70 hover:text-white disabled:opacity-25 transition-opacity"
          >
            ‹
          </button>
          <div className="text-center">
            <p className="text-sm text-white">
              {format(new Date(photo.takenAt), "MMM d, yyyy HH:mm")}
            </p>
            {photos.length > 1 && (
              <p className="text-xs text-white/50">{index + 1} / {photos.length}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIndex((i) => Math.min(photos.length - 1, i + 1))}
              disabled={index === photos.length - 1}
              className="text-2xl leading-none px-2 text-white/70 hover:text-white disabled:opacity-25 transition-opacity"
            >
              ›
            </button>
            <button
              onClick={onClose}
              className="ml-1 px-2 text-white/60 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
