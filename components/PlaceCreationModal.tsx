"use client";

import { useState } from "react";
import type { PlaceData } from "@/lib/detectVisits";

type Props = {
  lat: number;
  lon: number;
  onClose: () => void;
  onCreated: (place: PlaceData) => void;
};

export default function PlaceCreationModal({ lat, lon, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [radius, setRadius] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), lat, lon, radius }),
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

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Create Place</h2>
        <p className="mb-4 text-xs text-gray-500">
          {lat.toFixed(5)}, {lon.toFixed(5)}
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Home, Work, Gym"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              Radius (meters)
            </label>
            <input
              type="number"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              min={10}
              max={5000}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={loading || !name.trim()}
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
