"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Trip = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  visitCount: number;
  createdAt: string;
};

type TripCandidate = {
  name: string;
  startDate: string;
  endDate: string;
};

async function fetchTrips(): Promise<{ trips: Trip[] }> {
  const res = await fetch("/api/trips");
  if (!res.ok) throw new Error("Failed to fetch trips");
  return res.json();
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const startFmt = format(start, "MMM d");
  const endFmt =
    start.getFullYear() === end.getFullYear()
      ? format(end, "MMM d, yyyy")
      : format(end, "MMM d, yyyy");
  return `${startFmt} – ${endFmt}`;
}

function tripStartStr(iso: string) {
  return iso.slice(0, 10);
}

function TripCard({
  trip,
  onEdit,
  onDelete,
  onNavigate,
}: {
  trip: Trip;
  onEdit: (trip: Trip) => void;
  onDelete: (id: number) => void;
  onNavigate: (trip: Trip) => void;
}) {
  return (
    <div className="group flex items-start gap-2 rounded-md p-2 hover:bg-muted/50">
      <button
        type="button"
        className="flex flex-1 flex-col items-start gap-0.5 text-left"
        onClick={() => onNavigate(trip)}
      >
        <span className="text-sm font-medium leading-snug">{trip.name}</span>
        <span className="text-xs text-muted-foreground">
          {formatDateRange(trip.startDate, trip.endDate)}
        </span>
        <span className="text-xs text-muted-foreground">
          {trip.visitCount} visit{trip.visitCount !== 1 ? "s" : ""}
        </span>
      </button>
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Edit trip"
          onClick={() => onEdit(trip)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474ZM4.75 3.5A2.25 2.25 0 0 0 2.5 5.75v5.5A2.25 2.25 0 0 0 4.75 13.5h5.5A2.25 2.25 0 0 0 12.5 11.25V9a.75.75 0 0 0-1.5 0v2.25a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1-.75-.75v-5.5a.75.75 0 0 1 .75-.75H7A.75.75 0 0 0 7 2H4.75Z" />
          </svg>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          aria-label="Delete trip"
          onClick={() => onDelete(trip.id)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
          </svg>
        </Button>
      </div>
    </div>
  );
}

type FormState = { name: string; startDate: string; endDate: string };
const EMPTY_FORM: FormState = { name: "", startDate: "", endDate: "" };

export default function TripsPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [detecting, setDetecting] = useState(false);
  const [candidates, setCandidates] = useState<TripCandidate[] | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["trips"], queryFn: fetchTrips });
  const trips = data?.trips ?? [];

  const createMutation = useMutation({
    mutationFn: async (f: FormState) => {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.name, startDate: f.startDate, endDate: f.endDate }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to create trip");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      setShowCreateForm(false);
      setForm(EMPTY_FORM);
      toast("Trip saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, f }: { id: number; f: FormState }) => {
      const res = await fetch(`/api/trips/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: f.name, startDate: f.startDate, endDate: f.endDate }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to update trip");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      setEditingTrip(null);
      setForm(EMPTY_FORM);
      toast("Trip updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/trips/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete trip");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast("Trip deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDetect() {
    setDetecting(true);
    setCandidates(null);
    try {
      const res = await fetch("/api/trips/detect", { method: "POST" });
      if (!res.ok) throw new Error("Detection failed");
      const { candidates: found } = await res.json();
      setCandidates(found);
      if (found.length === 0) toast("No trips detected");
    } catch {
      toast.error("Trip detection failed");
    } finally {
      setDetecting(false);
    }
  }

  function openCreateForm() {
    setEditingTrip(null);
    setForm(EMPTY_FORM);
    setShowCreateForm(true);
  }

  function openEditForm(trip: Trip) {
    setShowCreateForm(false);
    setEditingTrip(trip);
    setForm({
      name: trip.name,
      startDate: tripStartStr(trip.startDate),
      endDate: tripStartStr(trip.endDate),
    });
  }

  function handleNavigate(trip: Trip) {
    const start = tripStartStr(trip.startDate);
    const end = tripStartStr(trip.endDate);
    router.push(`/timeline/${start}?range=custom&end=${end}`);
  }

  function handleSaveCandidate(candidate: TripCandidate) {
    createMutation.mutate({
      name: candidate.name,
      startDate: candidate.startDate,
      endDate: candidate.endDate,
    });
    setCandidates((prev) => prev?.filter((c) => c !== candidate) ?? null);
  }

  function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (editingTrip) {
      updateMutation.mutate({ id: editingTrip.id, f: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const inputClass =
    "w-full rounded-md border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={handleDetect}
          disabled={detecting}
        >
          {detecting ? "Detecting…" : "Detect trips"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={openCreateForm}
        >
          New trip
        </Button>
      </div>

      {/* Create / Edit form */}
      {(showCreateForm || editingTrip) && (
        <form onSubmit={submitForm} className="flex flex-col gap-2 rounded-md border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {editingTrip ? "Edit trip" : "New trip"}
          </p>
          <input
            className={inputClass}
            placeholder="Trip name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            aria-label="Trip name"
          />
          <div className="flex gap-2">
            <input
              type="date"
              className={inputClass}
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              required
              aria-label="Start date"
            />
            <input
              type="date"
              className={inputClass}
              value={form.endDate}
              min={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              required
              aria-label="End date"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              className="flex-1 text-xs"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingTrip ? "Save" : "Create"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => {
                setShowCreateForm(false);
                setEditingTrip(null);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Detected candidates */}
      {candidates && candidates.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground px-1">Detected trips</p>
          {candidates.map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded-md border p-2"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateRange(c.startDate, c.endDate)}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleSaveCandidate(c)}
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() =>
                    setCandidates((prev) => prev?.filter((x) => x !== c) ?? null)
                  }
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Saved trips list */}
      {isLoading ? (
        <p className="px-2 py-4 text-center text-xs text-muted-foreground">Loading…</p>
      ) : trips.length === 0 ? (
        <p className="px-2 py-4 text-center text-xs text-muted-foreground">
          No trips yet. Click &quot;Detect trips&quot; or &quot;New trip&quot; to get started.
        </p>
      ) : (
        <div className="flex flex-col">
          {trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onEdit={openEditForm}
              onDelete={(id) => {
                if (confirm(`Delete "${trip.name}"?`)) deleteMutation.mutate(id);
              }}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
