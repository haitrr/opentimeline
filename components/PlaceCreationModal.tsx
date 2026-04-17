"use client";

import { useState } from "react";
import type { PlaceData } from "@/lib/detectVisits";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  lat: number;
  lon: number;
  supersedesVisitId?: number;
  onClose: () => void;
  onCreated: (place: PlaceData) => void;
};

export default function PlaceCreationModal({ lat, lon, supersedesVisitId, onClose, onCreated }: Props) {
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
        body: JSON.stringify({ name: name.trim(), lat, lon, radius, supersedesVisitId }),
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Place</DialogTitle>
          <DialogDescription>
            {lat.toFixed(5)}, {lon.toFixed(5)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="place-name">Name</Label>
            <Input
              id="place-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Home, Work, Gym"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="place-radius">Radius (meters)</Label>
            <Input
              id="place-radius"
              type="number"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              min={10}
              max={5000}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
