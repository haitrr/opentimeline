"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import PlaceCreationModal from "@/components/PlaceCreationModal";
import { fetchVisitCentroid } from "@/lib/visitCentroid";
import { FetchVisitPhotos } from "@/components/VisitPhotos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type Visit = {
  id: number;
  arrivalAt: string;
  departureAt: string;
  status: string;
  place: { id: number; name: string; lat: number; lon: number };
};

export default function VisitSuggestionsPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [creatingPlaceForVisit, setCreatingPlaceForVisit] = useState<Visit | null>(null);
  const [creatingPlaceForVisitCentroid, setCreatingPlaceForVisitCentroid] = useState<{ lat: number; lon: number } | null>(null);

  const { data: visits = [] } = useQuery<Visit[]>({
    queryKey: ["visits", "suggested"],
    queryFn: async () => {
      const res = await fetch("/api/visits?status=suggested");
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function handleAction(id: number, status: "confirmed" | "rejected") {
    const res = await fetch(`/api/visits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["visits"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
    }
  }

  async function openCreatePlaceForVisit(visit: Visit) {
    const centroid = await fetchVisitCentroid(visit.arrivalAt, visit.departureAt, visit.place);
    setCreatingPlaceForVisitCentroid(centroid);
    setCreatingPlaceForVisit(visit);
  }

  function handlePlaceCreatedForVisit() {
    setCreatingPlaceForVisit(null);
    setCreatingPlaceForVisitCentroid(null);
    queryClient.invalidateQueries({ queryKey: ["visits"] });
    queryClient.invalidateQueries({ queryKey: ["places"] });
  }

  return (
    <>
      <div className="flex h-full flex-col">
        {visits.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2">
            <Badge className="h-5 px-1.5">{visits.length}</Badge>
            <span className="text-xs text-muted-foreground">pending</span>
          </div>
        )}
        <ScrollArea className="flex-1">
          <div className="px-4 pb-3">
            {visits.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No pending suggestions.</p>
            ) : (
              <ul className="space-y-2">
                {visits.map((v) => (
                  <li
                    key={v.id}
                    className="cursor-pointer rounded-lg border bg-muted/50 p-2 transition-colors hover:bg-muted"
                    onClick={() => {
                      router.push(`/timeline/${format(new Date(v.arrivalAt), "yyyy-MM-dd")}`);
                      window.dispatchEvent(new CustomEvent("opentimeline:fly-to", { detail: { lat: v.place.lat, lon: v.place.lon } }));
                    }}
                  >
                    <p className="text-sm font-medium text-foreground">{v.place.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(v.arrivalAt), "MMM d, HH:mm")} –{" "}
                      {format(new Date(v.departureAt), "HH:mm")}
                    </p>
                    <FetchVisitPhotos arrivalAt={v.arrivalAt} departureAt={v.departureAt} />
                    <div className="mt-1.5 flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 flex-1 bg-amber-500 text-xs hover:bg-amber-600"
                        onClick={(e) => { e.stopPropagation(); openCreatePlaceForVisit(v); }}
                      >
                        Create Place
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleAction(v.id, "confirmed"); }}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleAction(v.id, "rejected"); }}
                      >
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>
      </div>

      {creatingPlaceForVisit && creatingPlaceForVisitCentroid && (
        <PlaceCreationModal
          lat={creatingPlaceForVisitCentroid.lat}
          lon={creatingPlaceForVisitCentroid.lon}
          supersedesVisitId={creatingPlaceForVisit.id}
          onClose={() => { setCreatingPlaceForVisit(null); setCreatingPlaceForVisitCentroid(null); }}
          onCreated={handlePlaceCreatedForVisit}
        />
      )}
    </>
  );
}
