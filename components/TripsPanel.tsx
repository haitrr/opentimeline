"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TripCard } from "./trips/TripCard";
import { TripForm } from "./trips/TripForm";
import {
  Trip,
  TripCandidate,
  FormState,
  EMPTY_FORM,
  formatDateRange,
} from "./trips/types";

async function fetchTrips(): Promise<{ trips: Trip[] }> {
  const res = await fetch("/api/trips");
  if (!res.ok) throw new Error("Failed to fetch trips");
  return res.json();
}

function tripStartStr(iso: string) {
  return iso.slice(0, 10);
}

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
    router.push(`/timeline/${start}?range=custom&end=${end}&fit=1`);
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
        <TripForm
          editingTrip={editingTrip}
          form={form}
          setForm={setForm}
          isPending={createMutation.isPending || updateMutation.isPending}
          onSubmit={submitForm}
          onCancel={() => {
            setShowCreateForm(false);
            setEditingTrip(null);
            setForm(EMPTY_FORM);
          }}
        />
      )}

      {/* Detected candidates */}
      {candidates && candidates.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground px-1">Detected trips</p>
          {candidates.map((c) => (
            <div
              key={c.startDate + c.endDate}
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
