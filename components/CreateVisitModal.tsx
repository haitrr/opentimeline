"use client";

import { useState, useEffect, useRef } from "react";
import { format, differenceInMinutes } from "date-fns";
import type { PlaceData } from "@/lib/detectVisits";
import { haversineKm } from "@/lib/geo";
import NewPlaceOption from "./NewPlaceOption";
import CustomPeriodOption from "./CustomPeriodOption";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

const DEFAULT_SCAN_RADIUS_M = 50;

type DetectedPeriod = {
  arrivalAt: Date;
  departureAt: Date;
  pointCount: number;
};

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
  places: PlaceData[];
  rangeStart?: string;
  rangeEnd?: string;
  onClose: () => void;
  onCreated: () => void;
};

function TimePeriodHeader({ scanRadius, onScanRadiusChange }: { scanRadius: number; onScanRadiusChange: (v: number) => void }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-3">
      <Label>Time period</Label>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Scan radius</span>
        <Slider
          min={20}
          max={500}
          step={10}
          value={[scanRadius]}
          onValueChange={(v) => onScanRadiusChange(v as number)}
          className="w-24"
        />
        <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{scanRadius}m</span>
      </div>
    </div>
  );
}

export default function CreateVisitModal({ lat, lon, places, rangeStart, rangeEnd, onClose, onCreated }: Props) {
  const [scanRadius, setScanRadius] = useState(() => {
    const firstPlace = [...places]
      .map((p) => ({ ...p, distM: haversineKm(lat, lon, p.lat, p.lon) * 1000 }))
      .filter((p) => p.distM <= 1000)
      .sort((a, b) => a.distM - b.distM)[0];
    return firstPlace?.radius ?? DEFAULT_SCAN_RADIUS_M;
  });
  const [detectedPeriods, setDetectedPeriods] = useState<DetectedPeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);

  // Debounce scanRadius changes so we don't fire an API call on every slider tick
  const [debouncedRadius, setDebouncedRadius] = useState(scanRadius);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedRadius(scanRadius), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [scanRadius]);

  const sortedPlaces = [...places]
    .map((p) => ({ ...p, distM: haversineKm(lat, lon, p.lat, p.lon) * 1000 }))
    .filter((p) => p.distM <= 1000)
    .sort((a, b) => a.distM - b.distM);

  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(
    () => sortedPlaces[0]?.id ?? null
  );
  const [isNewPlace, setIsNewPlace] = useState(() => sortedPlaces.length === 0);

  // Fetch detected periods from the server (includes ±5-day buffer around the range)
  useEffect(() => {
    const selectedPlace = sortedPlaces.find((p) => p.id === selectedPlaceId);
    const detectionLat = selectedPlace?.lat ?? lat;
    const detectionLon = selectedPlace?.lon ?? lon;

    setPeriodsLoading(true);
    const params = new URLSearchParams({
      lat: String(detectionLat),
      lon: String(detectionLon),
      radiusM: String(debouncedRadius),
      ...(rangeStart ? { rangeStart } : {}),
      ...(rangeEnd ? { rangeEnd } : {}),
    });
    fetch(`/api/visits/detect-periods?${params}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: { arrivalAt: string; departureAt: string; pointCount: number }[]) => {
        setDetectedPeriods(
          data.map((d) => ({
            arrivalAt: new Date(d.arrivalAt),
            departureAt: new Date(d.departureAt),
            pointCount: d.pointCount,
          }))
        );
      })
      .catch(() => setDetectedPeriods([]))
      .finally(() => setPeriodsLoading(false));
  }, [lat, lon, selectedPlaceId, debouncedRadius, rangeStart, rangeEnd]);

  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceRadius, setNewPlaceRadius] = useState(50);
  const [periodIndex, setPeriodIndex] = useState<number>(-1);
  const [customStart, setCustomStart] = useState<string>(() =>
    format(new Date(Date.now() - 3_600_000), "yyyy-MM-dd'T'HH:mm")
  );
  const [customEnd, setCustomEnd] = useState<string>(() =>
    format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-select first period once loaded; reset if radius changes knock it out of range
  useEffect(() => {
    setPeriodIndex((prev) => {
      if (prev === -1) return detectedPeriods.length > 0 ? 0 : -1;
      if (prev < detectedPeriods.length) return prev;
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Visit</DialogTitle>
          <DialogDescription>
            {lat.toFixed(5)}, {lon.toFixed(5)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Place */}
          <div>
            <Label className="mb-1.5 block">Place</Label>
            <div className="max-h-62.5 overflow-y-auto rounded-md border">
              {sortedPlaces.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-muted transition-colors"
                >
                  <input
                    type="radio"
                    name="place"
                    checked={!isNewPlace && selectedPlaceId === p.id}
                    onChange={() => { setSelectedPlaceId(p.id); setIsNewPlace(false); setScanRadius(p.radius); }}
                    className="shrink-0"
                  />
                  <span className="flex-1 text-sm">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.distM < 1000
                      ? `${Math.round(p.distM)}m`
                      : `${(p.distM / 1000).toFixed(1)}km`}
                  </span>
                </label>
              ))}

              <NewPlaceOption
                isNewPlace={isNewPlace}
                setIsNewPlace={setIsNewPlace}
                newPlaceName={newPlaceName}
                setNewPlaceName={setNewPlaceName}
                newPlaceRadius={newPlaceRadius}
                setNewPlaceRadius={setNewPlaceRadius}
              />
            </div>
          </div>

          <Separator />

          {/* Time period */}
          <div>
            <TimePeriodHeader scanRadius={scanRadius} onScanRadiusChange={setScanRadius} />
            <div className="rounded-md border">
              {periodsLoading ? (
                <p className="px-2.5 py-3 text-xs text-muted-foreground">Detecting periods…</p>
              ) : (
                detectedPeriods.map((period, i) => {
                  const mins = differenceInMinutes(period.departureAt, period.arrivalAt);
                  return (
                    <label
                      key={i}
                      className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-muted transition-colors"
                    >
                      <input
                        type="radio"
                        name="period"
                        checked={periodIndex === i}
                        onChange={() => setPeriodIndex(i)}
                        className="shrink-0"
                      />
                      <span className="flex-1 text-sm">
                        {format(period.arrivalAt, "MMM d, HH:mm")} –{" "}
                        {format(period.departureAt, "HH:mm")}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDuration(mins)} · {period.pointCount} pts
                      </span>
                    </label>
                  );
                })
              )}

              <CustomPeriodOption
                periodIndex={periodIndex}
                setPeriodIndex={setPeriodIndex}
                customStart={customStart}
                setCustomStart={setCustomStart}
                customEnd={customEnd}
                setCustomEnd={setCustomEnd}
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? "Creating…" : isNewPlace ? "Create Place & Visit" : "Create Visit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
