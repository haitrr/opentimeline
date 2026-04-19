"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { parseGpx } from "@/lib/parseGpx";

export default function ImportGpxButton({ onClose }: { onClose?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    onClose?.();
    const toastId = toast.loading("Parsing GPX file…");
    let points;
    try {
      const text = await file.text();
      points = parseGpx(text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse GPX file", { id: toastId });
      return;
    }

    if (points.length === 0) {
      toast.error("No trackpoints found in GPX file", { id: toastId });
      return;
    }

    toast.loading("Importing…", { id: toastId });
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const { imported } = await res.json();
      toast.success(
        imported === 0 ? "All points already imported" : `Imported ${imported} point${imported === 1 ? "" : "s"}`,
        { id: toastId }
      );
      if (imported > 0) router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed", { id: toastId });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <input
      ref={inputRef}
      id="gpx-file-input"
      type="file"
      accept=".gpx,application/gpx+xml"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
      }}
    />
  );
}

export function triggerGpxInput() {
  document.getElementById("gpx-file-input")?.click();
}
