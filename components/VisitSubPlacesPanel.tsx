"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";

type SubPlace = { id: number; name: string };

type Props = {
  visitId: number;
  parentPlaceId: number;
  subPlaces: SubPlace[];
  checkedSubPlaceIds: number[];
};

export default function VisitSubPlacesPanel({
  visitId,
  parentPlaceId,
  subPlaces,
  checkedSubPlaceIds,
}: Props) {
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<Set<number>>(new Set(checkedSubPlaceIds));
  const [saving, setSaving] = useState(false);

  if (subPlaces.length === 0) return null;

  async function toggle(subPlaceId: number) {
    const next = new Set(checked);
    if (next.has(subPlaceId)) {
      next.delete(subPlaceId);
    } else {
      next.add(subPlaceId);
    }
    setChecked(next);
    setSaving(true);
    try {
      await fetch(`/api/visits/${visitId}/sub-places`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subPlaceIds: [...next] }),
      });
      queryClient.invalidateQueries({ queryKey: ["visits", "place", parentPlaceId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 rounded-md border bg-muted/30 px-3 py-2">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Places visited inside</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {subPlaces.map((sp) => (
          <div key={sp.id} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              id={`sub-${visitId}-${sp.id}`}
              checked={checked.has(sp.id)}
              disabled={saving}
              onChange={() => toggle(sp.id)}
              className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
            />
            <Label
              htmlFor={`sub-${visitId}-${sp.id}`}
              className="cursor-pointer text-xs"
            >
              {sp.name}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
