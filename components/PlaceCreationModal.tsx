"use client";

import { useEffect, useState } from "react";
import type { PlaceData } from "@/lib/detectVisits";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type Props = {
  lat: number;
  lon: number;
  supersedesVisitId?: number;
  onClose: () => void;
  onCreated: (place: PlaceData) => void;
};

function dispatchPreview(detail: { lat: number; lon: number; radius: number } | null) {
  window.dispatchEvent(new CustomEvent("opentimeline:place-preview", { detail }));
}

export default function PlaceCreationModal({ lat, lon, supersedesVisitId, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [radius, setRadius] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dispatchPreview({ lat, lon, radius });
    return () => dispatchPreview(null);
  }, [lat, lon, radius]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), lat, lon, radius, supersedesVisitId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create place");
        return;
      }
      const { place } = await res.json();
      onCreated(place);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    dispatchPreview(null);
    onClose();
  }

  return (
    <>
      {/* Backdrop — covers only mobile or narrow viewports */}
      <div
        className="fixed inset-0 z-40 bg-black/30 md:hidden"
        onClick={handleClose}
      />

      <div className="fixed bottom-4 left-4 z-50 w-80 rounded-xl border bg-background shadow-xl md:bottom-6 md:left-6">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Create Place</p>
            <p className="text-xs text-muted-foreground">
              {lat.toFixed(5)}, {lon.toFixed(5)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="place-name">Name</Label>
            <Input
              id="place-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Home, Work, Gym"
              autoFocus
              required
              className="text-base md:text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Radius</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{radius} m</span>
            </div>
            <Slider
              min={10}
              max={1000}
              value={[radius]}
              onValueChange={(v) => { const val = Array.isArray(v) ? v[0] : v; if (typeof val === "number") setRadius(val); }}
              aria-label="Place radius"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>10 m</span>
              <span>1 km</span>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading || !name.trim()}>
              {loading ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
