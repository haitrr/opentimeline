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
    }

    detect();
    const interval = setInterval(detect, 60 * 60 * 1000); // every hour
    return () => clearInterval(interval);
  }, []);

  return null;
}
