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
    <div className="rounded-lg border border-gray-200 bg-white/90 px-3 py-2 shadow-md dark:border-gray-700 dark:bg-gray-900/90">
      <div className="flex flex-col gap-1">
        {Array.from(deviceColors.entries()).map(([id, { color }]) => (
          <div key={id ?? "__null__"} className="flex items-center gap-2">
            <span
              data-testid={`swatch-${id ?? "__null__"}`}
              className="h-3 w-3 flex-shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-gray-700 dark:text-gray-200">{id ?? "Unknown"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
