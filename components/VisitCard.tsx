"use client";

import { Fragment } from "react";
import { format, differenceInMinutes, formatDistanceToNow } from "date-fns";
import { FetchVisitPhotos } from "@/components/VisitPhotos";
import { formatDuration, formatGapMs } from "@/lib/placeDetailUtils";

export type Visit = {
  id: number;
  arrivalAt: string;
  departureAt: string;
  status: string;
};

export type VisitCardProps = {
  visit: Visit;
  gapPx: number;
  gapMs: number;
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

function VisitMeta({ arrival, departure, durationMin }: { arrival: Date; departure: Date; durationMin: number }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold text-gray-800">
        {format(arrival, "MMM d, yyyy")}
        <span className="ml-1.5 font-normal text-gray-400">
          {formatDistanceToNow(arrival, { addSuffix: true })}
        </span>
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        {format(arrival, "HH:mm")} &rarr; {format(departure, "HH:mm")}
        <span className="ml-1.5 text-gray-400">{formatDuration(durationMin)}</span>
      </p>
    </div>
  );
}

type VisitActionsProps = {
  visit: Visit;
  isSuggested: boolean;
  onConfirm: (id: number) => void;
  onReject: (id: number) => void;
  onEdit: (visit: Visit) => void;
  onCreatePlace: (visit: Visit) => void;
  onViewDay: (arrivalAt: string) => void;
};

function VisitActions({ visit: v, isSuggested, onConfirm, onReject, onEdit, onCreatePlace, onViewDay }: VisitActionsProps) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex items-center gap-1">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium leading-none ${isSuggested ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
          {isSuggested ? "Suggested" : "Confirmed"}
        </span>
        <button onClick={() => onViewDay(v.arrivalAt)} className="rounded border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
          View Day
        </button>
        <button onClick={() => onEdit(v)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Edit visit" aria-label="Edit visit">
          ✎
        </button>
      </div>
      {isSuggested && (
        <div className="flex items-end gap-1">
          <div className="flex items-center gap-1">
            <button onClick={() => onConfirm(v.id)} className="rounded bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-blue-700">
              Confirm
            </button>
            <button onClick={() => onReject(v.id)} className="rounded border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
              Reject
            </button>
          </div>
          <button onClick={() => onCreatePlace(v)} className="rounded bg-amber-500 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-amber-600">
            Create Place
          </button>
        </div>
      )}
    </div>
  );
}

export default function VisitCard({
  visit: v,
  gapPx: spacerPx,
  gapMs,
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
            <VisitMeta arrival={arrival} departure={departure} durationMin={durationMin} />
            <VisitActions
              visit={v}
              isSuggested={isSuggested}
              onConfirm={onConfirm}
              onReject={onReject}
              onEdit={onEdit}
              onCreatePlace={onCreatePlace}
              onViewDay={onViewDay}
            />
          </div>
          <FetchVisitPhotos arrivalAt={v.arrivalAt} departureAt={v.departureAt} />
        </div>
      </div>

      {!isLast && (
        <div className="relative" style={{ height: spacerPx }} data-scrubber-segment={scrubberSegmentKey}>
          {hasDateSeparator && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1">
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
          {formatGapMs(gapMs) && (
            <span
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-400 ring-1 ring-gray-200"
              style={{ left: 15, top: "50%" }}
            >
              {formatGapMs(gapMs)}
            </span>
          )}
        </div>
      )}
    </Fragment>
  );
}
