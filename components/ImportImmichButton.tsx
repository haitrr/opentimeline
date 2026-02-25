"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ImmichPhoto } from "@/lib/immich";

type Props = {
  rangeStart?: string;
  rangeEnd?: string;
};

type Status = "idle" | "fetching" | "confirming" | "importing" | "done" | "error";

export default function ImportImmichButton({ rangeStart, rangeEnd }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<ImmichPhoto[]>([]);
  const queryClient = useQueryClient();

  const disabled = !rangeStart || !rangeEnd;

  async function handleFetch() {
    if (disabled) return;
    setStatus("fetching");
    setMessage(null);

    try {
      const res = await fetch(
        `/api/immich?start=${encodeURIComponent(rangeStart)}&end=${encodeURIComponent(rangeEnd)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const photos: ImmichPhoto[] = await res.json();
      const withLocation = photos.filter((p) => p.lat !== null && p.lon !== null);

      if (photos.length === 0) {
        setStatus("error");
        setMessage("No photos found in this time range");
        return;
      }

      if (withLocation.length === 0) {
        setStatus("error");
        setMessage(`Found ${photos.length} photo${photos.length === 1 ? "" : "s"} but none have GPS data`);
        return;
      }

      setPendingPhotos(withLocation);
      setStatus("confirming");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to fetch photos");
    }
  }

  async function handleImport() {
    setStatus("importing");
    const trigger = `immich-import-${Date.now()}`;
    const points = pendingPhotos.map((p) => ({
      lat: p.lat!,
      lon: p.lon!,
      tst: Math.floor(new Date(p.takenAt).getTime() / 1000),
      recordedAt: p.takenAt,
      alt: null,
      vel: null,
      cog: null,
    }));

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points, trigger }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      const { imported } = await res.json();
      setStatus("done");
      setMessage(
        imported === 0
          ? "All points already imported"
          : `Imported ${imported} point${imported === 1 ? "" : "s"}`
      );
      if (imported > 0) {
        queryClient.invalidateQueries({ queryKey: ["locations"] });
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Import failed");
    }
  }

  function handleCancel() {
    setPendingPhotos([]);
    setStatus("idle");
    setMessage(null);
  }

  if (status === "confirming") {
    return (
      <div className="flex flex-col gap-1.5 rounded border border-blue-200 bg-blue-50 p-2">
        <p className="text-xs text-blue-800">
          Import {pendingPhotos.length} photo{pendingPhotos.length === 1 ? "" : "s"} with location data as points?
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleImport}
            className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
          >
            Import
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleFetch}
        disabled={disabled || status === "fetching" || status === "importing"}
        title={disabled ? "Select a time range first" : undefined}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
          <path fillRule="evenodd" d="M1 8a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 8.07 3h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 16.07 6H17a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8Zm13.5 3a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
        </svg>
        {status === "fetching" ? "Fetching…" : status === "importing" ? "Importing…" : "Import from Immich"}
      </button>
      {message && (
        <p className={`text-xs ${status === "error" ? "text-red-500" : "text-green-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
