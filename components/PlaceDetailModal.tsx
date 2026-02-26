"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { format, differenceInMinutes, differenceInYears, differenceInMonths, differenceInDays, formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlaceData } from "@/lib/detectVisits";
import type { ImmichPhoto } from "@/lib/immich";
import LazyVisitPhotos from "@/components/VisitPhotos";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import DraggableScrollbar, { type ScrollSegment } from "@/components/DraggableScrollbar";

type Visit = {
  id: number;
  arrivalAt: string;
  departureAt: string;
  status: string;
};

type NearbyPlaceOption = {
  id: number;
  name: string;
  distanceM: number;
};

type VisitCardProps = {
  visit: Visit;
  gapPx: number;
  hasDateSeparator: boolean;
  nextYear: number | null;
  nextMonthLabel: string | null;
  scrubberSegmentKey?: string;
  isLast: boolean;
  onConfirm: (id: number) => void;
  onReject: (id: number) => void;
  onEdit: (visit: Visit) => void;
  onCreatePlace: (visit: Visit) => void;
  onViewDay: (arrivalAt: string) => void;
};

function VisitCard({
  visit: v,
  gapPx: spacerPx,
  hasDateSeparator,
  nextYear,
  nextMonthLabel,
  scrubberSegmentKey,
  isLast,
  onConfirm,
  onReject,
  onEdit,
  onCreatePlace,
  onViewDay,
}: VisitCardProps) {
  const arrival = new Date(v.arrivalAt);
  const departure = new Date(v.departureAt);
  const durationMin = differenceInMinutes(departure, arrival);
  const isSuggested = v.status === "suggested";

  const { data: photos = [] } = useQuery<ImmichPhoto[]>({
    queryKey: ["immich", v.arrivalAt, v.departureAt],
    queryFn: async () => {
      const res = await fetch(`/api/immich?start=${v.arrivalAt}&end=${v.departureAt}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: Infinity,
  });

  return (
    <Fragment key={v.id}>
      <div className="relative flex items-start gap-3">
        <div
          className={`relative z-10 mt-2.75 h-2.75 w-2.75 shrink-0 rounded-full border-2 border-white shadow ${
            isSuggested ? "bg-amber-400" : "bg-[#1a7bb5]"
          }`}
          style={{ marginLeft: 10 }}
        />
        <div className="flex-1 rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800">
                {format(arrival, "MMM d, yyyy")}
                <span className="ml-1.5 font-normal text-gray-400">
                    {formatDistanceToNow(arrival, { addSuffix: true })}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {format(arrival, "HH:mm")} &rarr; {format(departure, "HH:mm")}
                <span className="ml-1.5 text-gray-400">
                  {formatDuration(durationMin)}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium leading-none ${
                    isSuggested
                      ? "bg-amber-100 text-amber-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {isSuggested ? "Suggested" : "Confirmed"}
                </span>
                <button
                  onClick={() => onViewDay(v.arrivalAt)}
                  className="rounded border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  View Day
                </button>
                <button
                  onClick={() => onEdit(v)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Edit visit"
                  aria-label="Edit visit"
                >
                  ✎
                </button>
              </div>
              {isSuggested && (
                <div className="flex items-end gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onConfirm(v.id)}
                      className="rounded bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => onReject(v.id)}
                      className="rounded border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                    >
                      Reject
                    </button>
                  </div>
                  <button
                    onClick={() => onCreatePlace(v)}
                    className="rounded bg-amber-500 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-amber-600"
                  >
                    Create Place
                  </button>
                </div>
              )}
            </div>
          </div>
          <LazyVisitPhotos photos={photos} arrivalAt={v.arrivalAt} departureAt={v.departureAt} />
        </div>
      </div>

      {!isLast && (
        <div
          className="relative flex items-center justify-center"
          style={{ height: spacerPx }}
          data-scrubber-segment={scrubberSegmentKey}
        >
          {hasDateSeparator && (
            <div className="relative z-10 flex flex-col items-center gap-1">
              {nextYear !== null && (
                <span className="rounded-full bg-[#1a7bb5] px-3 py-0.5 text-xs font-semibold text-white shadow-sm">
                  {nextYear}
                </span>
              )}
              {nextMonthLabel !== null && (
                <span className="rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-gray-600 shadow-sm ring-1 ring-gray-200">
                  {nextMonthLabel}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Fragment>
  );
}

type Props = {
  place: PlaceData;
  onClose: () => void;
};

type Filter = "all" | "confirmed" | "suggested";

const MIN_GAP_PX = 10;
const MAX_GAP_PX = 80;
const YEAR_BADGE_MIN_PX = 32;

function parseTimeMs(value: string): number | null {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatVisitSpan(from: Date, to: Date): string {
  const totalYears = differenceInYears(to, from);
  if (totalYears >= 1) {
    const remainMonths = differenceInMonths(to, from) - totalYears * 12;
    return remainMonths > 0 ? `${totalYears} yr ${remainMonths} mo` : `${totalYears} yr`;
  }
  const totalMonths = differenceInMonths(to, from);
  if (totalMonths >= 1) return `${totalMonths} mo`;
  const totalDays = differenceInDays(to, from);
  return `${Math.max(1, totalDays)} day${totalDays !== 1 ? "s" : ""}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function gapToPx(
  gapMs: number,
  minMs: number,
  maxMs: number,
  yearChanges: boolean
): number {
  if (!Number.isFinite(gapMs) || gapMs < 0) {
    return yearChanges ? YEAR_BADGE_MIN_PX : MIN_GAP_PX;
  }
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) {
    return yearChanges ? Math.max(MIN_GAP_PX, YEAR_BADGE_MIN_PX) : MIN_GAP_PX;
  }
  let px: number;
  if (minMs === maxMs) {
    px = (MIN_GAP_PX + MAX_GAP_PX) / 2;
  } else {
    const t =
      (Math.log(gapMs + 1) - Math.log(minMs + 1)) /
      (Math.log(maxMs + 1) - Math.log(minMs + 1));
    px = MIN_GAP_PX + Math.max(0, Math.min(1, t)) * (MAX_GAP_PX - MIN_GAP_PX);
  }
  const safePx = Number.isFinite(px) ? px : MIN_GAP_PX;
  return yearChanges ? Math.max(safePx, YEAR_BADGE_MIN_PX) : safePx;
}

export default function PlaceDetailModal({ place, onClose }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [placeInfo, setPlaceInfo] = useState<PlaceData>(place);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(place.name);
  const [radiusInput, setRadiusInput] = useState(place.radius);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Create place state
  const [creatingPlaceForVisit, setCreatingPlaceForVisit] = useState<Visit | null>(null);
  const [creatingPlaceForVisitCentroid, setCreatingPlaceForVisitCentroid] = useState<{ lat: number; lon: number } | null>(null);

  // Edit visit state
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [editArrivalAt, setEditArrivalAt] = useState("");
  const [editDepartureAt, setEditDepartureAt] = useState("");
  const [editPlaceId, setEditPlaceId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("suggested");
  const [editVisitError, setEditVisitError] = useState<string | null>(null);
  const [savingVisitEdit, setSavingVisitEdit] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlaceOption[]>([]);
  const [loadingNearbyPlaces, setLoadingNearbyPlaces] = useState(false);

  const { data: visits = [], isLoading } = useQuery<Visit[]>({
    queryKey: ["visits", "place", placeInfo.id],
    queryFn: async () => {
      const res = await fetch(`/api/visits?placeId=${placeInfo.id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function handleConfirm(visitId: number) {
    const res = await fetch(`/api/visits/${visitId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    }
  }

  async function handleReject(visitId: number) {
    const res = await fetch(`/api/visits/${visitId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    }
  }

  async function openCreatePlaceForVisit(visit: Visit) {
    const params = new URLSearchParams({ start: visit.arrivalAt, end: visit.departureAt });
    let lat = placeInfo.lat;
    let lon = placeInfo.lon;
    try {
      const res = await fetch(`/api/locations?${params}`);
      if (res.ok) {
        const points: Array<{ lat: number; lon: number }> = await res.json();
        if (points.length > 0) {
          lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
          lon = points.reduce((s, p) => s + p.lon, 0) / points.length;
        }
      }
    } catch { /* fallback to place coords */ }
    setCreatingPlaceForVisitCentroid({ lat, lon });
    setCreatingPlaceForVisit(visit);
  }

  async function handlePlaceCreated(placeId: number) {
    if (!creatingPlaceForVisit) return;
    await fetch(`/api/visits/${creatingPlaceForVisit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId }),
    });
    setCreatingPlaceForVisit(null);
    setCreatingPlaceForVisitCentroid(null);
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  async function loadNearbyPlaces(visitId: number) {
    setLoadingNearbyPlaces(true);
    try {
      const res = await fetch(`/api/visits/${visitId}/nearby-places`);
      if (!res.ok) {
        setNearbyPlaces([]);
        return;
      }
      const data = await res.json();
      setNearbyPlaces(Array.isArray(data.places) ? data.places : []);
    } catch {
      setNearbyPlaces([]);
    } finally {
      setLoadingNearbyPlaces(false);
    }
  }

  function openEditVisit(visit: Visit) {
    setEditingVisit(visit);
    setEditArrivalAt(toDateTimeLocalValue(visit.arrivalAt));
    setEditDepartureAt(toDateTimeLocalValue(visit.departureAt));
    setEditPlaceId(placeInfo.id);
    setEditStatus(visit.status);
    setEditVisitError(null);
    setNearbyPlaces([]);
    void loadNearbyPlaces(visit.id);
  }

  function closeEditVisit() {
    setEditingVisit(null);
    setEditArrivalAt("");
    setEditDepartureAt("");
    setEditPlaceId(null);
    setNearbyPlaces([]);
    setLoadingNearbyPlaces(false);
    setEditStatus("suggested");
    setEditVisitError(null);
    setSavingVisitEdit(false);
  }

  async function saveVisitChanges() {
    if (!editingVisit) return;

    const arrivalDate = new Date(editArrivalAt);
    const departureDate = new Date(editDepartureAt);

    if (Number.isNaN(arrivalDate.getTime()) || Number.isNaN(departureDate.getTime())) {
      setEditVisitError("Arrival and departure time are required");
      return;
    }
    if (departureDate.getTime() <= arrivalDate.getTime()) {
      setEditVisitError("Departure time must be after arrival time");
      return;
    }
    if (editPlaceId == null) {
      setEditVisitError("Please select a place");
      return;
    }

    setSavingVisitEdit(true);
    setEditVisitError(null);
    try {
      const res = await fetch(`/api/visits/${editingVisit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: editPlaceId,
          arrivalAt: arrivalDate.toISOString(),
          departureAt: departureDate.toISOString(),
          status: editStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditVisitError(data.error ?? "Failed to update visit");
        return;
      }
      closeEditVisit();
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    } catch {
      setEditVisitError("Network error");
    } finally {
      setSavingVisitEdit(false);
    }
  }

  async function deleteVisit() {
    if (!editingVisit) return;
    const shouldDelete = window.confirm("Delete this visit? This action cannot be undone.");
    if (!shouldDelete) return;

    setSavingVisitEdit(true);
    setEditVisitError(null);
    try {
      const res = await fetch(`/api/visits/${editingVisit.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setEditVisitError(data.error ?? "Failed to delete visit");
        return;
      }
      closeEditVisit();
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    } catch {
      setEditVisitError("Network error");
    } finally {
      setSavingVisitEdit(false);
    }
  }

  function handleViewDay(arrivalAt: string) {
    const day = format(new Date(arrivalAt), "yyyy-MM-dd");
    router.push(`/timeline/${day}?fit=1`);
    onClose();
  }

  async function handleSavePlace() {
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setEditError("Name is required");
      return;
    }
    if (!Number.isFinite(radiusInput) || radiusInput <= 0) {
      setEditError("Radius must be a positive number");
      return;
    }

    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/places/${placeInfo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, radius: radiusInput }),
      });

      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? "Failed to update place");
        return;
      }

      const { place: updated } = await res.json();
      setPlaceInfo(updated);
      setNameInput(updated.name);
      setRadiusInput(updated.radius);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["places"] });
      router.refresh();
    } catch {
      setEditError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlace() {
    const confirmed = window.confirm(
      `Delete place "${placeInfo.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/places/${placeInfo.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setEditError(data.error ?? "Failed to delete place");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["places"] });
      router.refresh();
      onClose();
    } catch {
      setEditError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  const displayed = visits
    .filter((v) =>
      filter === "confirmed" ? v.status === "confirmed" : filter === "suggested" ? v.status === "suggested" : v.status !== "rejected"
    )
    .sort((a, b) => new Date(b.arrivalAt).getTime() - new Date(a.arrivalAt).getTime());

  const visitStats = useMemo(() => {
    if (displayed.length === 0) return null;
    if (displayed.length === 1) {
      return `1 visit · ${format(new Date(displayed[0].arrivalAt), "MMM d, yyyy")}`;
    }
    const newest = new Date(displayed[0].arrivalAt);
    const oldest = new Date(displayed[displayed.length - 1].arrivalAt);
    const span = formatVisitSpan(oldest, newest);
    return `${displayed.length} visits · ${span} (${format(oldest, "MMM yyyy")} – ${format(newest, "MMM yyyy")})`;
  }, [displayed]);

  const scrubberSegments = useMemo<ScrollSegment[]>(() => {
    if (displayed.length < 2) return [];
    const toMonthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const newestDate = new Date(displayed[0].arrivalAt);
    const oldestDate = new Date(displayed[displayed.length - 1].arrivalAt);
    const multiYear = newestDate.getFullYear() !== oldestDate.getFullYear();
    const seen = new Map<string, string>();
    displayed.forEach((v) => {
      const d = new Date(v.arrivalAt);
      const monthKey = toMonthKey(d);
      if (!seen.has(monthKey)) {
        seen.set(monthKey, format(new Date(`${monthKey}-01T00:00:00`), "MMMM yyyy"));
      }
    });
    if (seen.size < 2) return [];
    let lastYearLabel: string | undefined;
    return [...seen.entries()].map(([monthKey, label]) => {
      let shortLabel: string | undefined;
      const yr = monthKey.slice(0, 4);
      if (multiYear) {
        if (yr !== lastYearLabel) { shortLabel = yr; lastYearLabel = yr; }
      } else {
        shortLabel = format(new Date(`${monthKey}-01T00:00:00`), "MMM");
      }
      return { label, shortLabel, segmentKey: `m:${monthKey}` };
    });
  }, [displayed]);

  const gapsMs = displayed.slice(0, -1).map((v, i) => {
    const nextVisit = displayed[i + 1];
    if (!nextVisit) return NaN;

    const currentStart = parseTimeMs(v.arrivalAt);
    const currentEnd = parseTimeMs(v.departureAt);
    const nextStart = parseTimeMs(nextVisit.arrivalAt);
    const nextEnd = parseTimeMs(nextVisit.departureAt);

    if (currentStart === null || currentEnd === null || nextStart === null || nextEnd === null) {
      return NaN;
    }

    const rawGap =
      currentStart <= nextStart
        ? nextStart - currentEnd
        : currentStart - nextEnd;

    return Math.max(0, rawGap);
  });
  const finiteGaps = gapsMs.filter((gap): gap is number => Number.isFinite(gap) && gap >= 0);
  const minMs = finiteGaps.length ? Math.min(...finiteGaps) : 0;
  const maxMs = finiteGaps.length ? Math.max(...finiteGaps) : 0;

  // Place options for the edit modal: always include current place, plus any other nearby places
  const placeOptions = useMemo(() => {
    const others = nearbyPlaces.filter((p) => p.id !== placeInfo.id);
    return [{ id: placeInfo.id, name: placeInfo.name, distanceM: 0 }, ...others];
  }, [nearbyPlaces, placeInfo.id, placeInfo.name]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-5">
          <div>
            {editing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Radius (m)</label>
                  <input
                    type="number"
                    value={radiusInput}
                    onChange={(e) => setRadiusInput(Number(e.target.value))}
                    min={1}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-base font-semibold text-gray-900">{placeInfo.name}</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  Radius: {placeInfo.radius}m &middot; {placeInfo.lat.toFixed(5)}, {placeInfo.lon.toFixed(5)}
                </p>
              </>
            )}
            {editError && <p className="mt-1 text-xs text-red-600">{editError}</p>}
          </div>
          <div className="ml-2 flex shrink-0 flex-wrap items-start justify-end gap-1.5 sm:ml-4">
            {editing ? (
              <>
                <button
                  onClick={handleSavePlace}
                  className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={saving || deleting || !nameInput.trim()}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleDeletePlace}
                  className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  disabled={saving || deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setNameInput(placeInfo.name);
                    setRadiusInput(placeInfo.radius);
                    setEditError(null);
                  }}
                  className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  disabled={saving || deleting}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="mt-0.5 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 px-4 py-2 sm:px-5">
          <span className="mr-2 text-xs text-gray-500">Show:</span>
          {(["all", "confirmed", "suggested"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f === "all" ? "All" : f === "confirmed" ? "Confirmed" : "Suggested"}
            </button>
          ))}
          {visitStats && (
            <span className="ml-auto text-xs text-gray-400">{visitStats}</span>
          )}
        </div>

        {/* Timeline */}
        <div className="relative flex min-h-0 flex-1">
          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 sm:px-5">
          {isLoading ? (
            <p className="py-8 text-center text-xs text-gray-400">Loading…</p>
          ) : displayed.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">No visits to show.</p>
          ) : (
            <div className="relative">
              <div className="absolute bottom-0 top-0 w-px bg-gray-200" style={{ left: 15 }} />
              {scrubberSegments.length > 0 && (
                <div
                  data-scrubber-segment={scrubberSegments[0].segmentKey}
                  className="absolute top-0 left-0 h-0 w-0 overflow-hidden"
                  aria-hidden
                />
              )}

              {displayed.map((v, i) => {
                const arrival = new Date(v.arrivalAt);
                const isLast = i === displayed.length - 1;
                const nextV = displayed[i + 1];
                const nextArrival = nextV ? new Date(nextV.arrivalAt) : null;
                const yearChanges = !isLast && nextArrival !== null && arrival.getFullYear() !== nextArrival.getFullYear();
                const monthChanges = !isLast && nextArrival !== null && (
                  arrival.getFullYear() !== nextArrival.getFullYear() ||
                  arrival.getMonth() !== nextArrival.getMonth()
                );
                const hasDateSeparator = yearChanges || monthChanges;
                const spacerPx = isLast ? 0 : gapToPx(gapsMs[i] ?? NaN, minMs, maxMs, hasDateSeparator);
                const nextYear = yearChanges && nextArrival ? nextArrival.getFullYear() : null;
                const nextMonthLabel = monthChanges && nextArrival ? format(nextArrival, "MMM") : null;
                const scrubberSegmentKey = monthChanges && nextArrival ? `m:${format(nextArrival, "yyyy-MM")}` : undefined;

                return (
                  <VisitCard
                    key={v.id}
                    visit={v}
                    gapPx={spacerPx}
                    hasDateSeparator={hasDateSeparator}
                    nextYear={nextYear}
                    nextMonthLabel={nextMonthLabel}
                    scrubberSegmentKey={scrubberSegmentKey}
                    isLast={isLast}
                    onConfirm={handleConfirm}
                    onReject={handleReject}
                    onEdit={openEditVisit}
                    onCreatePlace={openCreatePlaceForVisit}
                    onViewDay={handleViewDay}
                  />
                );
              })}
            </div>
          )}
          </div>
          {scrubberSegments.length > 0 && (
            <DraggableScrollbar
              segments={scrubberSegments}
              scrollContainerRef={scrollRef}
              className="w-10 border-l border-gray-100 dark:border-gray-800"
            />
          )}
        </div>
      </div>

      {creatingPlaceForVisit && creatingPlaceForVisitCentroid && (
        <PlaceCreationModal
          lat={creatingPlaceForVisitCentroid.lat}
          lon={creatingPlaceForVisitCentroid.lon}
          onClose={() => { setCreatingPlaceForVisit(null); setCreatingPlaceForVisitCentroid(null); }}
          onCreated={(p) => handlePlaceCreated(p.id)}
        />
      )}

      {editingVisit && (
        <div className="fixed inset-0 z-1001 flex items-end justify-center bg-black/40 p-2 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full overflow-hidden rounded-lg bg-white shadow-xl sm:max-w-md">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Edit Visit</h2>
              <button
                onClick={closeEditVisit}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                disabled={savingVisitEdit}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto px-5 py-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Arrival</label>
                <input
                  type="datetime-local"
                  value={editArrivalAt}
                  onChange={(e) => setEditArrivalAt(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  disabled={savingVisitEdit}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">Departure</label>
                <input
                  type="datetime-local"
                  value={editDepartureAt}
                  onChange={(e) => setEditDepartureAt(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  disabled={savingVisitEdit}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">Place</label>
                <select
                  value={editPlaceId != null ? String(editPlaceId) : ""}
                  onChange={(e) => setEditPlaceId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  disabled={savingVisitEdit || loadingNearbyPlaces}
                >
                  {placeOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id === placeInfo.id
                        ? `${p.name} (current)`
                        : `${p.name} (${p.distanceM}m)`}
                    </option>
                  ))}
                </select>
                {loadingNearbyPlaces && (
                  <p className="mt-1 text-xs text-gray-400">Loading nearby places…</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-500">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                  disabled={savingVisitEdit}
                >
                  <option value="suggested">Suggested</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {editVisitError && <p className="text-xs text-red-600">{editVisitError}</p>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-3">
              <button
                onClick={deleteVisit}
                className="rounded border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                disabled={savingVisitEdit}
              >
                Delete
              </button>
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <button
                  onClick={closeEditVisit}
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  disabled={savingVisitEdit}
                >
                  Cancel
                </button>
                <button
                  onClick={saveVisitChanges}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  disabled={savingVisitEdit || !editArrivalAt || !editDepartureAt || editPlaceId == null}
                >
                  {savingVisitEdit ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
