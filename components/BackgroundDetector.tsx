"use client";

import { useEffect } from "react";

export default function BackgroundDetector() {
  useEffect(() => {
    async function detect() {
      try {
        await fetch("/api/visits/detect", { method: "POST" });
      } catch {
        // silent — background task
      }
      try {
        const res = await fetch("/api/unknown-visits/detect", { method: "POST" });
        if (res.ok) {
          const { created } = await res.json();
          if (created > 0) {
            window.dispatchEvent(new CustomEvent("opentimeline:unknown-visits-detected"));
          }
        }
      } catch {
        // silent — background task
      }
    }

    const interval = setInterval(detect, 60 * 60 * 1000); // every hour
    return () => clearInterval(interval);
  }, []);

  return null;
}
