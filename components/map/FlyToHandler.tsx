"use client";

import React, { useEffect } from "react";
import type { MapRef } from "react-map-gl/maplibre";

export default function FlyToHandler({ mapRef }: { mapRef: React.RefObject<MapRef | null> }) {
  useEffect(() => {
    function handler(e: Event) {
      const { lat, lon } = (e as CustomEvent<{ lat: number; lon: number }>).detail;
      mapRef.current?.flyTo({ center: [lon, lat], zoom: 17, duration: 1000 });
    }
    window.addEventListener("opentimeline:fly-to", handler);
    return () => window.removeEventListener("opentimeline:fly-to", handler);
  }, [mapRef]);
  return null;
}
