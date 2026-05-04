"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SubPlace = { id: number; name: string; confirmedVisits: number };

type Props = {
  parentPlaceId: number;
  parentLat: number;
  parentLon: number;
  parentRadius: number;
  onOpenPlace?: (sp: { id: number; name: string }) => void;
};

export default function SubPlacesSection({
  parentPlaceId,
  parentLat,
  parentLon,
  parentRadius,
  onOpenPlace,
}: Props) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const { data: subPlaces = [] } = useQuery<SubPlace[]>({
    queryKey: ["places", "children", parentPlaceId],
    queryFn: async () => {
      const res = await fetch(`/api/places?parentId=${parentPlaceId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.places.map((p: { id: number; name: string; confirmedVisits: number }) => ({
        id: p.id,
        name: p.name,
        confirmedVisits: p.confirmedVisits,
      }));
    },
  });

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          lat: parentLat,
          lon: parentLon,
          radius: parentRadius,
          parentId: parentPlaceId,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to add sub-place");
        return;
      }
      setNewName("");
      setShowInput(false);
      queryClient.invalidateQueries({ queryKey: ["places", "children", parentPlaceId] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(sp: SubPlace) {
    const ok = window.confirm(`Delete "${sp.name}"? This will also remove its visit records.`);
    if (!ok) return;
    const res = await fetch(`/api/places/${sp.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete sub-place");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["places", "children", parentPlaceId] });
    queryClient.invalidateQueries({ queryKey: ["visits", "place", parentPlaceId] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  return (
    <div className="border-t px-4 py-4 sm:px-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Places inside</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowInput((v) => !v)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {showInput && (
        <div className="mb-3 flex gap-2">
          <Input
            placeholder="Sub-place name (e.g. H&M)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
            className="h-8 text-sm"
            style={{ fontSize: 16 }}
            autoFocus
          />
          <Button size="sm" className="h-8" onClick={handleAdd} disabled={adding || !newName.trim()}>
            Add
          </Button>
        </div>
      )}

      {subPlaces.length === 0 && !showInput ? (
        <p className="text-xs text-muted-foreground">No sub-places yet. Add one to start annotating visits.</p>
      ) : (
        <ul className="space-y-1">
          {subPlaces.map((sp) => (
            <li key={sp.id} className="group flex items-center justify-between rounded px-2 py-1 hover:bg-muted">
              <button
                type="button"
                className="flex items-baseline gap-2 text-left"
                onClick={() => onOpenPlace?.(sp)}
                disabled={!onOpenPlace}
              >
                <span className={`text-sm ${onOpenPlace ? "hover:underline cursor-pointer" : ""}`}>{sp.name}</span>
                <span className="text-xs text-muted-foreground">
                  {sp.confirmedVisits} {sp.confirmedVisits === 1 ? "visit" : "visits"}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Delete ${sp.name}`}
                onClick={() => handleDelete(sp)}
                className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
