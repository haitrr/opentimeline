"use client";

import React from "react";
import type { DeviceColor } from "@/lib/deviceColors";

type Props = {
  deviceColors: Map<string | null, DeviceColor>;
  hidePoints: boolean;
};

export default function PointsLegend({ deviceColors, hidePoints }: Props) {
  if (hidePoints || deviceColors.size === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-900 rounded-lg border border-gray-200 bg-white/90 px-3 py-2 shadow-md">
      <div className="flex flex-col gap-1">
        {Array.from(deviceColors.entries()).map(([id, { color }]) => (
          <div key={id ?? "__null__"} className="flex items-center gap-2">
            <span
              data-testid={`swatch-${id ?? "__null__"}`}
              className="h-3 w-3 flex-shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-gray-700">{id ?? "Unknown"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
