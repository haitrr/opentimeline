"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseGpx } from "@/lib/parseGpx";

type Status = "idle" | "parsing" | "uploading" | "done" | "error";

export default function ImportGpxButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    setStatus("parsing");
    setMessage(null);

    let points;
    try {
      const text = await file.text();
      points = parseGpx(text);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to parse GPX file");
      return;
    }

    if (points.length === 0) {
      setStatus("error");
      setMessage("No trackpoints found in GPX file");
      return;
    }

    setStatus("uploading");

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
      setStatus("done");
      setMessage(
        imported === 0
          ? "All points already imported"
          : `Imported ${imported} point${imported === 1 ? "" : "s"}`
      );
      if (imported > 0) router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      // Reset file input so the same file can be re-selected if needed
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === "parsing" || status === "uploading"}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-4 w-4 shrink-0"
        >
          <path
            fillRule="evenodd"
            d="M8 1a.75.75 0 0 1 .75.75V6h3.5a.75.75 0 0 1 0 1.5h-3.5v3.25a.75.75 0 0 1-1.5 0V7.5H3.75a.75.75 0 0 1 0-1.5h3.5V1.75A.75.75 0 0 1 8 1Z"
            clipRule="evenodd"
          />
          <path d="M1.75 13.5a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H1.75Z" />
        </svg>
        {status === "parsing"
          ? "Parsing…"
          : status === "uploading"
          ? "Importing…"
          : "Import GPX"}
      </button>

      {message && (
        <p
          className={`text-xs ${
            status === "error" ? "text-red-500" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
