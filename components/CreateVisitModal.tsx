"use client";

import { useState, useMemo, useEffect } from "react";
import { format, differenceInMinutes } from "date-fns";
import type { SerializedPoint } from "@/lib/groupByHour";
import type { PlaceData } from "@/lib/detectVisits";
import { haversineKm } from "@/lib/geo";

const DEFAULT_SCAN_RADIUS_M = 50;
const MAX_GAP_MINUTES = 15;

type DetectedPeriod = {
  arrivalAt: Date;
  departureAt: Date;
  pointCount: number;
};

function detectPeriods(
  points: SerializedPoint[],
  lat: number,
  lon: number,
  radiusM: number
): DetectedPeriod[] {
  const nearby = points
    .filter((p) => haversineKm(p.lat, p.lon, lat, lon) * 1000 <= radiusM)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  if (nearby.length === 0) return [];

  const groups: DetectedPeriod[] = [];
  let group = [nearby[0]];

  for (let i = 1; i < nearby.length; i++) {
    const gapMs =
      new Date(nearby[i].recordedAt).getTime() - new Date(nearby[i - 1].recordedAt).getTime();
    if (gapMs / 60000 <= MAX_GAP_MINUTES) {
      group.push(nearby[i]);
    } else {
      const arrival = new Date(group[0].recordedAt);
      const departure = new Date(group[group.length - 1].recordedAt);
      if (arrival.getTime() === departure.getTime()) {
        arrival.setMinutes(arrival.getMinutes() - 1);
        departure.setMinutes(departure.getMinutes() + 1);
      }
      groups.push({ arrivalAt: arrival, departureAt: departure, pointCount: group.length });
      group = [nearby[i]];
    }
  }
  const lastArrival = new Date(group[0].recordedAt);
  const lastDeparture = new Date(group[group.length - 1].recordedAt);
  if (lastArrival.getTime() === lastDeparture.getTime()) {
    lastArrival.setMinutes(lastArrival.getMinutes() - 1);
    lastDeparture.setMinutes(lastDeparture.getMinutes() + 1);
  }
  groups.push({
    arrivalAt: lastArrival,
    departureAt: lastDeparture,
    pointCount: group.length,
  });

  // Most recent first
  return groups.sort((a, b) => b.arrivalAt.getTime() - a.arrivalAt.getTime());
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type Props = {
  lat: number;
  lon: number;
  points: SerializedPoint[];
  places: PlaceData[];
  onClose: () => void;
  onCreated: () => void;
};

export default function CreateVisitModal({ lat, lon, points, places, onClose, onCreated }: Props) {
  // scanRadius must be declared before detectedPeriods (useMemo dep)
  const [scanRadius, setScanRadius] = useState(DEFAULT_SCAN_RADIUS_M);

  // Compute for rendering (also used as initializer source via closures below)
  const detectedPeriods = useMemo(
    () => detectPeriods(points, lat, lon, scanRadius),
    [points, lat, lon, scanRadius]
  );
  const sortedPlaces = useMemo(
    () =>
      [...places]
        .map((p) => ({ ...p, distM: haversineKm(lat, lon, p.lat, p.lon) * 1000 }))
        .filter((p) => p.distM <= 100)
        .sort((a, b) => a.distM - b.distM),
    [lat, lon, places]
  );

  // State – lazy initialisers reference the memoised values computed above
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(
    () => sortedPlaces[0]?.id ?? null
  );
  const [isNewPlace, setIsNewPlace] = useState(() => sortedPlaces.length === 0);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceRadius, setNewPlaceRadius] = useState(50);
  const [periodIndex, setPeriodIndex] = useState<number>(
    () => (detectedPeriods.length > 0 ? 0 : -1)
  );
  const [customStart, setCustomStart] = useState<string>(() =>
    format(
      detectedPeriods[0]?.arrivalAt ?? new Date(Date.now() - 3_600_000),
      "yyyy-MM-dd'T'HH:mm"
    )
  );
  const [customEnd, setCustomEnd] = useState<string>(() =>
    format(detectedPeriods[0]?.departureAt ?? new Date(), "yyyy-MM-dd'T'HH:mm")
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset period selection when detected periods change (e.g. radius adjusted)
  useEffect(() => {
    setPeriodIndex((prev) => {
      if (prev === -1) return -1; // keep "Custom" if user chose it
      if (prev < detectedPeriods.length) return prev; // still valid
      return detectedPeriods.length > 0 ? 0 : -1;
    });
  }, [detectedPeriods]);

  const canSubmit =
    (isNewPlace ? newPlaceName.trim().length > 0 : selectedPlaceId !== null) &&
    (periodIndex >= 0 || (customStart.length > 0 && customEnd.length > 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const period = periodIndex >= 0 ? detectedPeriods[periodIndex] : null;
    const arrivalAt = period ? period.arrivalAt.toISOString() : new Date(customStart).toISOString();
    const departureAt = period
      ? period.departureAt.toISOString()
      : new Date(customEnd).toISOString();

    if (new Date(arrivalAt) >= new Date(departureAt)) {
      setError("Arrival must be before departure");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      let placeId = selectedPlaceId;

      if (isNewPlace) {
        const placeRes = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newPlaceName.trim(), lat, lon, radius: newPlaceRadius }),
        });
        if (!placeRes.ok) {
          const data = await placeRes.json().catch(() => null);
          setError(data?.error ?? "Failed to create place");
          return;
        }
        const { place } = await placeRes.json();
        placeId = place.id;
      }

      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, arrivalAt, departureAt, status: "confirmed" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to create visit");
        return;
      }
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-1000 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="p-5">
          <h2 className="mb-0.5 text-sm font-semibold text-gray-900">Create Visit</h2>
          <p className="mb-4 text-xs text-gray-500">
            {lat.toFixed(5)}, {lon.toFixed(5)}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Place */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-700">Place</p>
              <div className="max-h-48 overflow-y-auto rounded border border-gray-200">
                {sortedPlaces.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="place"
                      checked={!isNewPlace && selectedPlaceId === p.id}
                      onChange={() => { setSelectedPlaceId(p.id); setIsNewPlace(false); }}
                      className="shrink-0"
                    />
                    <span className="flex-1 text-sm text-gray-800">{p.name}</span>
                    <span className="text-xs text-gray-400">
                      {p.distM < 1000
                        ? `${Math.round(p.distM)}m`
                        : `${(p.distM / 1000).toFixed(1)}km`}
                    </span>
                  </label>
                ))}

                {/* New place option */}
                <label className="flex cursor-pointer items-start gap-2 px-2.5 py-1.5 hover:bg-gray-50">
                  <input
                    type="radio"
                    name="place"
                    checked={isNewPlace}
                    onChange={() => setIsNewPlace(true)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-gray-800">Create new place here</span>
                    {isNewPlace && (
                      <div className="mt-2 space-y-2">
                        <div>
                          <label className="mb-0.5 block text-xs text-gray-500">Name</label>
                          <input
                            type="text"
                            value={newPlaceName}
                            onChange={(e) => setNewPlaceName(e.target.value)}
                            placeholder="e.g. Home, Work, Gym"
                            autoFocus
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs text-gray-500">Radius (m)</label>
                          <input
                            type="number"
                            value={newPlaceRadius}
                            onChange={(e) => setNewPlaceRadius(Number(e.target.value))}
                            min={10}
                            max={5000}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Time period */}
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-gray-700">Time period</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Scan radius</span>
                  <input
                    type="range"
                    min={20}
                    max={500}
                    step={10}
                    value={scanRadius}
                    onChange={(e) => setScanRadius(Number(e.target.value))}
                    className="w-24 accent-blue-500"
                  />
                  <span className="w-12 text-right text-xs tabular-nums text-gray-500">
                    {scanRadius}m
                  </span>
                </div>
              </div>
              <div className="rounded border border-gray-200">
                {detectedPeriods.map((period, i) => {
                  const mins = differenceInMinutes(period.departureAt, period.arrivalAt);
                  return (
                    <label
                      key={i}
                      className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        name="period"
                        checked={periodIndex === i}
                        onChange={() => setPeriodIndex(i)}
                        className="shrink-0"
                      />
                      <span className="flex-1 text-sm text-gray-800">
                        {format(period.arrivalAt, "MMM d, HH:mm")} –{" "}
                        {format(period.departureAt, "HH:mm")}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {formatDuration(mins)} · {period.pointCount} pts
                      </span>
                    </label>
                  );
                })}

                {/* Custom option */}
                <label className="flex cursor-pointer items-start gap-2 px-2.5 py-1.5 hover:bg-gray-50">
                  <input
                    type="radio"
                    name="period"
                    checked={periodIndex === -1}
                    onChange={() => setPeriodIndex(-1)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-sm text-gray-800">Custom</span>
                    {periodIndex === -1 && (
                      <div className="mt-2 space-y-2">
                        <div>
                          <label className="mb-0.5 block text-xs text-gray-500">Arrival</label>
                          <input
                            type="datetime-local"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs text-gray-500">Departure</label>
                          <input
                            type="datetime-local"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? "Creating…" : isNewPlace ? "Create Place & Visit" : "Create Visit"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
