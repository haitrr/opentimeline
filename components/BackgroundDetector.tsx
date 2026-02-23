"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function BackgroundDetector() {
  const queryClient = useQueryClient();

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
            queryClient.invalidateQueries({ queryKey: ["unknown-visits"] });
            queryClient.invalidateQueries({ queryKey: ["places"] });
          }
        }
      } catch {
        // silent — background task
      }
    }

    const interval = setInterval(detect, 60 * 60 * 1000); // every hour
    return () => clearInterval(interval);
  }, [queryClient]);

  return null;
}
