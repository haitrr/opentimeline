"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import { FetchVisitPhotos } from "@/components/VisitPhotos";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

type UnknownVisit = {
  id: number;
  lat: number;
  lon: number;
  arrivalAt: string;
  departureAt: string;
  pointCount: number;
  status: string;
};

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function UnknownVisitSuggestionsPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<UnknownVisit | null>(null);
  const [editing, setEditing] = useState<{ id: number; arrivalAt: string; departureAt: string } | null>(null);

  const { data: suggestions = [] } = useQuery<UnknownVisit[]>({
    queryKey: ["unknown-visits", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/unknown-visits?status=suggested");
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function handleReject(id: number) {
    const res = await fetch(`/api/unknown-visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    if (res.ok) queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/unknown-visits/${id}`, { method: "DELETE" });
    if (res.ok) queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
  }

  async function handleEditSave(id: number) {
    if (!editing) return;
    const res = await fetch(`/api/unknown-visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arrivalAt: new Date(editing.arrivalAt).toISOString(),
        departureAt: new Date(editing.departureAt).toISOString(),
      }),
    });
    if (res.ok) {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    }
  }

  async function handlePlaceCreated(visit: UnknownVisit) {
    await fetch(`/api/unknown-visits/${visit.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    setConfirming(null);
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen} className="border-t">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted">
          <span className="flex items-center gap-2">
            Unknown Places
            {suggestions.length > 0 && (
              <Badge variant="warning" className="h-5 px-1.5">
                {suggestions.length}
              </Badge>
            )}
          </span>
          <span>{open ? "▲" : "▼"}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="max-h-80">
            <div className="px-4 pb-3">
              {suggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No unknown place visits detected.</p>
              ) : (
                <ul className="space-y-2">
                  {suggestions.map((s) => (
                    <li
                      key={s.id}
                      className="cursor-pointer rounded border border-amber-100 bg-amber-50 p-2 transition-colors hover:bg-amber-100 dark:border-amber-900/30 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
                      onClick={() => {
                        router.push(`/timeline/${format(new Date(s.arrivalAt), "yyyy-MM-dd")}`);
                        window.dispatchEvent(new CustomEvent("opentimeline:fly-to", { detail: { lat: s.lat, lon: s.lon } }));
                      }}
                    >
                      <p className="text-xs font-medium text-foreground">
                        {s.lat.toFixed(5)}, {s.lon.toFixed(5)}
                      </p>
                      {editing?.id === s.id ? (
                        <div className="mt-1 space-y-1">
                          <div>
                            <Label className="text-xs text-muted-foreground">Arrival</Label>
                            <Input
                              type="datetime-local"
                              value={editing.arrivalAt}
                              onChange={(e) => setEditing({ ...editing, arrivalAt: e.target.value })}
                              className="mt-0.5 h-8 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Departure</Label>
                            <Input
                              type="datetime-local"
                              value={editing.departureAt}
                              onChange={(e) => setEditing({ ...editing, departureAt: e.target.value })}
                              className="mt-0.5 h-8 text-xs"
                            />
                          </div>
                          <div className="flex gap-1.5 pt-0.5">
                            <Button
                              size="sm"
                              className="h-7 flex-1 bg-amber-500 text-xs hover:bg-amber-600"
                              onClick={(e) => { e.stopPropagation(); handleEditSave(s.id); }}
                            >
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 flex-1 text-xs"
                              onClick={(e) => { e.stopPropagation(); setEditing(null); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(s.arrivalAt), "MMM d, HH:mm")} –{" "}
                            {format(new Date(s.departureAt), "HH:mm")}
                          </p>
                          <p className="text-xs text-muted-foreground">{s.pointCount} points</p>
                          <FetchVisitPhotos arrivalAt={s.arrivalAt} departureAt={s.departureAt} lat={s.lat} lon={s.lon} />
                          <div className="mt-1.5 flex gap-1.5">
                            <Button
                              size="sm"
                              className="h-7 flex-1 bg-amber-500 text-xs hover:bg-amber-600"
                              onClick={(e) => { e.stopPropagation(); setConfirming(s); }}
                            >
                              Create Place
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 flex-1 text-xs"
                              onClick={(e) => { e.stopPropagation(); setEditing({ id: s.id, arrivalAt: toDatetimeLocal(s.arrivalAt), departureAt: toDatetimeLocal(s.departureAt) }); }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 flex-1 text-xs"
                              onClick={(e) => { e.stopPropagation(); handleReject(s.id); }}
                            >
                              Dismiss
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 border-destructive text-xs text-destructive hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                            >
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      {confirming && (
        <PlaceCreationModal
          lat={confirming.lat}
          lon={confirming.lon}
          onClose={() => setConfirming(null)}
          onCreated={() => handlePlaceCreated(confirming)}
        />
      )}
    </>
  );
}
