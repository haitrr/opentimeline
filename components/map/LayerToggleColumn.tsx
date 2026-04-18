"use client";

import React from "react";
import { Camera, CircleDot, Flame, MapPin, MapPinCheck, Route } from "lucide-react";
import type { LayerSettings } from "@/components/map/mapConstants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type LayerToggle = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onToggle: () => void;
};

function buildToggles(layerSettings: LayerSettings): LayerToggle[] {
  const {
    showHeatmap, setShowHeatmap,
    showLine, setShowLine,
    showVisitedPlaces, setShowVisitedPlaces,
    hidePoints, setHidePoints,
    hidePlaces, setHidePlaces,
    hidePhotos, setHidePhotos,
  } = layerSettings;
  return [
    { label: "Heatmap", icon: Flame, active: showHeatmap, onToggle: () => setShowHeatmap(!showHeatmap) },
    { label: "Path line", icon: Route, active: showLine, onToggle: () => setShowLine(!showLine) },
    { label: "Visited places", icon: MapPinCheck, active: showVisitedPlaces, onToggle: () => setShowVisitedPlaces(!showVisitedPlaces) },
    { label: "Points", icon: CircleDot, active: !hidePoints, onToggle: () => setHidePoints(!hidePoints) },
    { label: "Places", icon: MapPin, active: !hidePlaces, onToggle: () => setHidePlaces(!hidePlaces) },
    { label: "Photos", icon: Camera, active: !hidePhotos, onToggle: () => setHidePhotos(!hidePhotos) },
  ];
}

type Props = {
  layerSettings: LayerSettings;
};

export default function LayerToggleColumn({ layerSettings }: Props) {
  const toggles = buildToggles(layerSettings);
  return (
    <TooltipProvider delay={200}>
      <div className="pointer-events-none absolute top-4 right-4 z-900 flex flex-col gap-2">
        {toggles.map(({ label, icon: Icon, active, onToggle }) => (
          <Tooltip key={label}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label={label}
                  aria-pressed={active}
                  className={`pointer-events-auto flex items-center justify-center rounded-full border p-2.5 shadow-md transition-colors ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </button>
              }
            />
            <TooltipContent side="left">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
