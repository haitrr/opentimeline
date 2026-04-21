"use client";

import { MapPin, Navigation, Copy, Trash2 } from "lucide-react";
import { formatRelative } from "@/lib/relativeTime";
import { toast } from "sonner";

export type PlacePanelItem = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  radius: number;
  isActive: boolean;
  totalVisits: number;
  confirmedVisits: number;
  visitsInRange: number;
  confirmedVisitsInRange: number;
  suggestedVisitsInRange: number;
  lastVisitAt: string | null;
  createdAt: string;
};

type Props = {
  place: PlacePanelItem;
  onEdit: (place: PlacePanelItem) => void;
  onDelete: (place: PlacePanelItem) => void;
};

export default function PlaceListItem({ place, onEdit, onDelete }: Props) {
  const hasVisits = place.confirmedVisits > 0;
  const visitsLabel = hasVisits
    ? `${place.confirmedVisits} ${place.confirmedVisits === 1 ? "visit" : "visits"} · ${place.radius}m radius`
    : `No visits yet · ${place.radius}m radius`;

  function flyTo() {
    window.dispatchEvent(
      new CustomEvent("opentimeline:fly-to", {
        detail: { lat: place.lat, lon: place.lon },
      })
    );
  }

  async function handleCopyCoords(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${place.lat}, ${place.lon}`);
      toast.success("Coordinates copied");
    } catch {
      toast.error("Couldn't copy coordinates");
    }
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const ok = window.confirm(
      `Delete "${place.name}"? This cannot be undone.`
    );
    if (ok) onDelete(place);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={place.name}
      title={place.name}
      onClick={() => onEdit(place)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(place);
        }
      }}
      className="group relative flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 pr-28 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:pr-20"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <MapPin className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">
          {place.name}
        </p>
        {hasVisits && place.lastVisitAt != null && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last visited {formatRelative(place.lastVisitAt)}
          </p>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">{visitsLabel}</p>
      </div>
      <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-60">
        <button
          type="button"
          aria-label="Fly to place"
          onClick={(e) => {
            e.stopPropagation();
            flyTo();
          }}
          className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:p-1"
        >
          <Navigation className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Copy coordinates"
          onClick={handleCopyCoords}
          className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground md:p-1"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Delete place"
          onClick={handleDelete}
          className="rounded p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive md:p-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
