"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_MAP_LAYER_SETTINGS,
  MAP_LAYER_SETTINGS_KEY,
  type MapLayerSettings,
  type LayerSettings,
} from "@/components/map/mapConstants";

export type { LayerSettings };

export function useLayerSettings(): LayerSettings {
  const [showHeatmap, setShowHeatmap] = useState(DEFAULT_MAP_LAYER_SETTINGS.showHeatmap);
  const [showLine, setShowLine] = useState(DEFAULT_MAP_LAYER_SETTINGS.showLine);
  const [showVisitedPlaces, setShowVisitedPlaces] = useState(DEFAULT_MAP_LAYER_SETTINGS.showVisitedPlaces);
  const [hidePoints, setHidePoints] = useState(DEFAULT_MAP_LAYER_SETTINGS.hidePoints);
  const [hidePlaces, setHidePlaces] = useState(DEFAULT_MAP_LAYER_SETTINGS.hidePlaces);
  const [hidePhotos, setHidePhotos] = useState(DEFAULT_MAP_LAYER_SETTINGS.hidePhotos);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load layer settings from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MAP_LAYER_SETTINGS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MapLayerSettings;
      if (typeof parsed.showHeatmap === "boolean") setShowHeatmap(parsed.showHeatmap);
      if (typeof parsed.showLine === "boolean") setShowLine(parsed.showLine);
      if (typeof parsed.showVisitedPlaces === "boolean") setShowVisitedPlaces(parsed.showVisitedPlaces);
      if (typeof parsed.showPoints === "boolean") {
        setHidePoints(!parsed.showPoints);
      } else if (typeof parsed.hidePoints === "boolean") {
        setHidePoints(parsed.hidePoints);
      }
      if (typeof parsed.showPlaces === "boolean") {
        setHidePlaces(!parsed.showPlaces);
      } else if (typeof parsed.hidePlaces === "boolean") {
        setHidePlaces(parsed.hidePlaces);
      }
      if (typeof parsed.hidePhotos === "boolean") setHidePhotos(parsed.hidePhotos);
    } catch {
      // ignore invalid local storage values
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  // Save layer settings to localStorage
  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      window.localStorage.setItem(
        MAP_LAYER_SETTINGS_KEY,
        JSON.stringify({
          showHeatmap,
          showLine,
          showVisitedPlaces,
          showPoints: !hidePoints,
          showPlaces: !hidePlaces,
          hidePhotos,
        })
      );
    } catch {
      // ignore local storage write errors
    }
  }, [settingsLoaded, showHeatmap, showLine, showVisitedPlaces, hidePoints, hidePlaces, hidePhotos]);

  return {
    showHeatmap, setShowHeatmap,
    showLine, setShowLine,
    showVisitedPlaces, setShowVisitedPlaces,
    hidePoints, setHidePoints,
    hidePlaces, setHidePlaces,
    hidePhotos, setHidePhotos,
    settingsLoaded,
  };
}
