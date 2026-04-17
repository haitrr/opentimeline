"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlaceData } from "@/lib/detectVisits";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import DraggableScrollbar, { type ScrollSegment } from "@/components/DraggableScrollbar";
import { fetchVisitCentroid } from "@/lib/visitCentroid";
import PlaceDetailHeader from "@/components/PlaceDetailHeader";
import EditVisitModal from "@/components/EditVisitModal";
import VisitCard, { type Visit } from "@/components/VisitCard";
import { parseTimeMs, formatVisitSpan, gapToPx } from "@/lib/placeDetailUtils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  place: PlaceData;
  onClose: () => void;
};

type Filter = "all" | "confirmed" | "suggested";

export default function PlaceDetailModal({ place, onClose }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [placeInfo, setPlaceInfo] = useState<PlaceData>(place);
  const [filter, setFilter] = useState<Filter>("all");
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [creatingPlaceForVisit, setCreatingPlaceForVisit] = useState<Visit | null>(null);
  const [creatingPlaceForVisitCentroid, setCreatingPlaceForVisitCentroid] = useState<{ lat: number; lon: number } | null>(null);

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
    const centroid = await fetchVisitCentroid(visit.arrivalAt, visit.departureAt, placeInfo);
    setCreatingPlaceForVisitCentroid(centroid);
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

  function handleViewDay(arrivalAt: string) {
    const day = format(new Date(arrivalAt), "yyyy-MM-dd");
    router.push(`/timeline/${day}?fit=1`);
    onClose();
  }

  const displayed = visits
    .filter((v) =>
      filter === "confirmed" ? v.status === "confirmed" : filter === "suggested" ? v.status === "suggested" : v.status !== "rejected"
    )
    .sort((a, b) => new Date(b.arrivalAt).getTime() - new Date(a.arrivalAt).getTime());

  const visitStats = useMemo(() => {
    if (displayed.length === 0) return null;
    if (displayed.length === 1) return `1 visit · ${format(new Date(displayed[0].arrivalAt), "MMM d, yyyy")}`;
    const newest = new Date(displayed[0].arrivalAt);
    const oldest = new Date(displayed[displayed.length - 1].arrivalAt);
    return `${displayed.length} visits · ${formatVisitSpan(oldest, newest)} (${format(oldest, "MMM yyyy")} – ${format(newest, "MMM yyyy")})`;
  }, [displayed]);

  const scrubberSegments = useMemo<ScrollSegment[]>(() => {
    if (displayed.length < 2) return [];
    const toMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const newestDate = new Date(displayed[0].arrivalAt);
    const oldestDate = new Date(displayed[displayed.length - 1].arrivalAt);
    const multiYear = newestDate.getFullYear() !== oldestDate.getFullYear();
    const seen = new Map<string, string>();
    displayed.forEach((v) => {
      const d = new Date(v.arrivalAt);
      const monthKey = toMonthKey(d);
      if (!seen.has(monthKey)) seen.set(monthKey, format(new Date(`${monthKey}-01T00:00:00`), "MMMM yyyy"));
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
    if (currentStart === null || currentEnd === null || nextStart === null || nextEnd === null) return NaN;
    return Math.max(0, currentStart <= nextStart ? nextStart - currentEnd : currentStart - nextEnd);
  });
  const finiteGaps = gapsMs.filter((gap): gap is number => Number.isFinite(gap) && gap >= 0);
  const minMs = finiteGaps.length ? Math.min(...finiteGaps) : 0;
  const maxMs = finiteGaps.length ? Math.max(...finiteGaps) : 0;

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="flex h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
          <PlaceDetailHeader
            placeInfo={placeInfo}
            onClose={onClose}
            onPlaceUpdated={setPlaceInfo}
            onPlaceDeleted={onClose}
          />

          {/* Filter */}
          <div className="flex flex-wrap items-center gap-1 border-b border px-4 py-2 sm:px-5">
            <span className="mr-2 text-xs text-muted-foreground">Show:</span>
            {(["all", "confirmed", "suggested"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "confirmed" ? "Confirmed" : "Suggested"}
              </Button>
            ))}
            {visitStats && <span className="ml-auto text-xs text-muted-foreground">{visitStats}</span>}
          </div>

          {/* Timeline */}
          <div className="relative flex min-h-0 flex-1">
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 sm:px-5">
              {isLoading ? (
                <div className="space-y-3 py-8 px-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : displayed.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">No visits to show.</p>
              ) : (
                <div className="relative">
                  <div className="absolute bottom-0 top-0 w-px bg-border" style={{ left: 15 }} />
                  {scrubberSegments.length > 0 && (
                    <div data-scrubber-segment={scrubberSegments[0].segmentKey} className="absolute top-0 left-0 h-0 w-0 overflow-hidden" aria-hidden />
                  )}
                  {displayed.map((v, i) => {
                    const arrival = new Date(v.arrivalAt);
                    const isLast = i === displayed.length - 1;
                    const nextV = displayed[i + 1];
                    const nextArrival = nextV ? new Date(nextV.arrivalAt) : null;
                    const yearChanges = !isLast && nextArrival !== null && arrival.getFullYear() !== nextArrival.getFullYear();
                    const monthChanges = !isLast && nextArrival !== null && (
                      arrival.getFullYear() !== nextArrival.getFullYear() || arrival.getMonth() !== nextArrival.getMonth()
                    );
                    const hasDateSeparator = yearChanges || monthChanges;
                    return (
                      <VisitCard
                        key={v.id}
                        visit={v}
                        gapPx={isLast ? 0 : gapToPx(gapsMs[i] ?? NaN, minMs, maxMs, hasDateSeparator)}
                        gapMs={gapsMs[i] ?? NaN}
                        hasDateSeparator={hasDateSeparator}
                        nextYear={yearChanges && nextArrival ? nextArrival.getFullYear() : null}
                        nextMonthLabel={monthChanges && nextArrival ? format(nextArrival, "MMM") : null}
                        scrubberSegmentKey={monthChanges && nextArrival ? `m:${format(nextArrival, "yyyy-MM")}` : undefined}
                        isLast={isLast}
                        onConfirm={handleConfirm}
                        onReject={handleReject}
                        onEdit={setEditingVisit}
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
                className="w-10 border-l border dark:border-gray-800"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {creatingPlaceForVisit && creatingPlaceForVisitCentroid && (
        <PlaceCreationModal
          lat={creatingPlaceForVisitCentroid.lat}
          lon={creatingPlaceForVisitCentroid.lon}
          onClose={() => { setCreatingPlaceForVisit(null); setCreatingPlaceForVisitCentroid(null); }}
          onCreated={(p) => handlePlaceCreated(p.id)}
        />
      )}

      {editingVisit && (
        <EditVisitModal
          visit={editingVisit}
          placeInfo={placeInfo}
          onClose={() => setEditingVisit(null)}
          onSaved={() => setEditingVisit(null)}
        />
      )}
    </>
  );
}
