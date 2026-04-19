"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ImmichPhoto } from "@/lib/immich";

type Props = {
  rangeStart?: string;
  rangeEnd?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ImportImmichDialog({ rangeStart, rangeEnd, open, onOpenChange }: Props) {
  const [pendingPhotos, setPendingPhotos] = useState<ImmichPhoto[]>([]);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      setPendingPhotos([]);
      setFetching(false);
      setImporting(false);
      return;
    }
    if (!rangeStart || !rangeEnd) return;

    let cancelled = false;
    setFetching(true);

    (async () => {
      try {
        const res = await fetch(
          `/api/immich?start=${encodeURIComponent(rangeStart)}&end=${encodeURIComponent(rangeEnd)}`
        );
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Server error ${res.status}`);
        }
        const photos: ImmichPhoto[] = await res.json();
        if (cancelled) return;
        const withLocation = photos.filter((p) => p.lat !== null && p.lon !== null);
        if (photos.length === 0) {
          toast.error("No photos found in this time range");
          onOpenChange(false);
          return;
        }
        if (withLocation.length === 0) {
          toast.error(`Found ${photos.length} photo${photos.length === 1 ? "" : "s"} but none have GPS data`);
          onOpenChange(false);
          return;
        }
        setPendingPhotos(withLocation);
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Failed to fetch photos");
        onOpenChange(false);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) onOpenChange(false);
  }

  async function handleImport() {
    setImporting(true);
    const trigger = `immich-import-${Date.now()}`;
    const points = pendingPhotos.map((p) => ({
      lat: p.lat!,
      lon: p.lon!,
      tst: Math.floor(new Date(p.takenAt).getTime() / 1000),
      recordedAt: p.takenAt,
      alt: null,
      vel: null,
      cog: null,
    }));
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points, trigger }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const { imported, skipped } = await res.json();
      const skippedMsg = skipped > 0 ? `, ${skipped} skipped (already imported)` : "";
      toast.success(
        imported === 0
          ? `No new points — ${skipped} already imported`
          : `Imported ${imported} point${imported === 1 ? "" : "s"}${skippedMsg}`
      );
      if (imported > 0) queryClient.invalidateQueries({ queryKey: ["locations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Immich</DialogTitle>
        </DialogHeader>
        {fetching ? (
          <p className="text-sm text-muted-foreground">Fetching photos…</p>
        ) : (
          <p className="text-sm">
            Import {pendingPhotos.length} photo{pendingPhotos.length === 1 ? "" : "s"} with location data as points?
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={fetching || importing || pendingPhotos.length === 0}>
            {importing ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
