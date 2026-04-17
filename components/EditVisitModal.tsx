"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PlaceData } from "@/lib/detectVisits";
import type { Visit } from "@/components/VisitCard";
import { toDateTimeLocalValue } from "@/lib/placeDetailUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type NearbyPlaceOption = {
  id: number;
  name: string;
  distanceM: number;
};

type Props = {
  visit: Visit;
  placeInfo: PlaceData;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditVisitModal({ visit, placeInfo, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [editArrivalAt, setEditArrivalAt] = useState(toDateTimeLocalValue(visit.arrivalAt));
  const [editDepartureAt, setEditDepartureAt] = useState(toDateTimeLocalValue(visit.departureAt));
  const [editPlaceId, setEditPlaceId] = useState<number | null>(placeInfo.id);
  const [editStatus, setEditStatus] = useState(visit.status);
  const [editVisitError, setEditVisitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlaceOption[]>([]);
  const [loadingNearbyPlaces, setLoadingNearbyPlaces] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoadingNearbyPlaces(true);
      try {
        const res = await fetch(`/api/visits/${visit.id}/nearby-places`);
        if (res.ok) {
          const data = await res.json();
          setNearbyPlaces(Array.isArray(data.places) ? data.places : []);
        }
      } catch {
        // ignore
      } finally {
        setLoadingNearbyPlaces(false);
      }
    })();
  }, [visit.id]);

  const placeOptions = useMemo(() => {
    const others = nearbyPlaces.filter((p) => p.id !== placeInfo.id);
    return [{ id: placeInfo.id, name: placeInfo.name, distanceM: 0 }, ...others];
  }, [nearbyPlaces, placeInfo.id, placeInfo.name]);

  async function handleSave() {
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
    setSaving(true);
    setEditVisitError(null);
    try {
      const res = await fetch(`/api/visits/${visit.id}`, {
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
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
      onSaved();
    } catch {
      setEditVisitError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this visit? This action cannot be undone.")) return;
    setSaving(true);
    setEditVisitError(null);
    try {
      const res = await fetch(`/api/visits/${visit.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setEditVisitError(data.error ?? "Failed to delete visit");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
      onSaved();
    } catch {
      setEditVisitError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Visit</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="edit-arrival" className="text-muted-foreground">Arrival</Label>
            <Input
              id="edit-arrival"
              type="datetime-local"
              value={editArrivalAt}
              onChange={(e) => setEditArrivalAt(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-departure" className="text-muted-foreground">Departure</Label>
            <Input
              id="edit-departure"
              type="datetime-local"
              value={editDepartureAt}
              onChange={(e) => setEditDepartureAt(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-place" className="text-muted-foreground">Place</Label>
            <select
              id="edit-place"
              value={editPlaceId != null ? String(editPlaceId) : ""}
              onChange={(e) => setEditPlaceId(e.target.value ? Number(e.target.value) : null)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving || loadingNearbyPlaces}
            >
              {placeOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === placeInfo.id ? `${p.name} (current)` : `${p.name} (${p.distanceM}m)`}
                </option>
              ))}
            </select>
            {loadingNearbyPlaces && <p className="mt-1 text-xs text-muted-foreground">Loading nearby places…</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-status" className="text-muted-foreground">Status</Label>
            <select
              id="edit-status"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving}
            >
              <option value="suggested">Suggested</option>
              <option value="confirmed">Confirmed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {editVisitError && <p className="text-xs text-destructive">{editVisitError}</p>}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            disabled={saving}
          >
            Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !editArrivalAt || !editDepartureAt || editPlaceId == null}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
