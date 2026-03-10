"use client";

import React from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { GeoJSON } from "geojson";
import type { LayerSettings } from "@/components/map/hooks/useLayerSettings";

type GeoJSONData = GeoJSON;

type Props = {
  layerSettings: LayerSettings;
  isDarkTheme: boolean;
  pathGeoJSON: GeoJSONData;
  lineGradientExpression: unknown[];
  heatGeoJSON: GeoJSONData;
  pointsGeoJSON: GeoJSONData;
  placeCirclesGeoJSON: GeoJSONData;
  placeDotsGeoJSON: GeoJSONData;
  unknownVisitsGeoJSON: GeoJSONData;
  photosGeoJSON: GeoJSONData;
  pointCount: number;
};

function vis(show: boolean): "visible" | "none" {
  return show ? "visible" : "none";
}

export default function MapLayers({
  layerSettings,
  isDarkTheme,
  pathGeoJSON,
  lineGradientExpression,
  heatGeoJSON,
  pointsGeoJSON,
  placeCirclesGeoJSON,
  placeDotsGeoJSON,
  unknownVisitsGeoJSON,
  photosGeoJSON,
  pointCount,
}: Props) {
  const { showHeatmap, showLine, showVisitedPlaces, hidePoints, hidePlaces, hidePhotos } = layerSettings;

  return (
    <>
      {/* Heatmap */}
      <Source id="heatmap" type="geojson" data={heatGeoJSON}>
        <Layer
          id="heatmap-layer"
          type="heatmap"
          layout={{ visibility: vis(showHeatmap) }}
          paint={{
            "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 2, 1],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 0.45, 11, 0.9, 14, 1.8],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 11, 7, 14, 12],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(0,0,255,0)",
              0.2, "#93c5fd",
              0.5, "#c4b5fd",
              0.8, "#f472b6",
              1.0, "#ef4444",
            ],
            "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.75, 11, 0.80, 14, 0.85],
          }}
        />
      </Source>

      {/* Path line */}
      <Source id="path" type="geojson" data={pathGeoJSON} lineMetrics>
        <Layer
          id="path-line"
          type="line"
          layout={{ visibility: vis(showLine && pointCount > 1), "line-cap": "round", "line-join": "round" }}
          paint={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            "line-gradient": lineGradientExpression as any,
            "line-width": showHeatmap ? 2 : 3,
            "line-opacity": showHeatmap ? 0.5 : 0.75,
          }}
        />
        <Layer
          id="path-arrows"
          type="symbol"
          layout={{
            visibility: vis(showLine && pointCount > 1),
            "symbol-placement": "line",
            "symbol-spacing": 80,
            "icon-image": "arrow-direction",
            "icon-size": 1,
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": false,
          }}
          paint={{
            "icon-color": "#ffffff",
            "icon-opacity": showHeatmap ? 0.4 : 0.65,
          }}
        />
      </Source>

      {/* Unknown visits */}
      <Source id="unknown-visits" type="geojson" data={unknownVisitsGeoJSON}>
        <Layer
          id="uv-fill"
          type="fill"
          layout={{ visibility: vis(showVisitedPlaces) }}
          paint={{ "fill-color": "#eab308", "fill-opacity": 0.2 }}
        />
        <Layer
          id="uv-outline"
          type="line"
          layout={{ visibility: vis(showVisitedPlaces) }}
          paint={{ "line-color": "#eab308", "line-width": 2, "line-dasharray": [5, 5] }}
        />
      </Source>

      {/* Place circles */}
      <Source id="place-circles" type="geojson" data={placeCirclesGeoJSON}>
        <Layer
          id="place-circle-fill"
          type="fill"
          layout={{ visibility: vis(showVisitedPlaces) }}
          filter={["any", ["get", "hasVisitsInRange"], ["get", "hovered"]]}
          paint={{
            "fill-color": ["case", ["get", "hasConfirmedInRange"], "#22c55e", "#a855f7"],
            "fill-opacity": ["case", ["get", "hasConfirmedInRange"], 0.2, 0.15],
          }}
        />
        <Layer
          id="place-circle-solid-outline"
          type="line"
          layout={{ visibility: vis(showVisitedPlaces) }}
          filter={["any", ["get", "hasConfirmedInRange"], ["get", "hovered"]]}
          paint={{
            "line-color": ["case", ["get", "hasConfirmedInRange"], "#16a34a", "#7e22ce"],
            "line-width": 2,
          }}
        />
        <Layer
          id="place-circle-dashed-outline"
          type="line"
          layout={{ visibility: vis(showVisitedPlaces) }}
          filter={["all",
            ["get", "hasSuggestedInRange"],
            ["!", ["get", "hasConfirmedInRange"]],
            ["!", ["get", "hovered"]],
          ]}
          paint={{
            "line-color": "#7e22ce",
            "line-width": 2,
            "line-dasharray": [6, 6],
          }}
        />
      </Source>

      {/* Location points */}
      <Source id="points" type="geojson" data={pointsGeoJSON}>
        <Layer
          id="location-points"
          type="circle"
          layout={{ visibility: vis(!hidePoints) }}
          paint={{
            "circle-radius": ["case", ["any", ["get", "isFirst"], ["get", "isLast"]], 6, 4],
            "circle-color": ["case",
              ["get", "isFirst"], "#22c55e",
              ["get", "isLast"], "#ef4444",
              "#3b82f6",
            ],
            "circle-stroke-color": ["case",
              ["get", "isFirst"], "#15803d",
              ["get", "isLast"], "#b91c1c",
              "#1d4ed8",
            ],
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.85,
          }}
        />
      </Source>

      {/* Photos */}
      <Source id="photos" type="geojson" data={photosGeoJSON}>
        <Layer
          id="photo-circles"
          type="circle"
          layout={{ visibility: vis(!hidePhotos) }}
          paint={{
            "circle-radius": 3,
            "circle-color": "#f97316",
            "circle-stroke-color": "#ea580c",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.9,
          }}
        />
      </Source>

      {/* Place dots */}
      <Source id="place-dots" type="geojson" data={placeDotsGeoJSON}>
        <Layer
          id="place-dot-circle-unvisited"
          type="circle"
          layout={{ visibility: vis(!hidePlaces) }}
          filter={["!", ["get", "hasVisitsInRange"]]}
          paint={{
            "circle-radius": 3,
            "circle-color": "#a855f7",
            "circle-stroke-color": "#7e22ce",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.9,
          }}
        />
        <Layer
          id="place-dot-circle-visited"
          type="circle"
          layout={{ visibility: vis(showVisitedPlaces) }}
          filter={["get", "hasVisitsInRange"]}
          paint={{
            "circle-radius": 5,
            "circle-color": ["case", ["get", "hasConfirmedInRange"], "#22c55e", "#a855f7"],
            "circle-stroke-color": ["case", ["get", "hasConfirmedInRange"], "#15803d", "#7e22ce"],
            "circle-stroke-width": 2,
            "circle-opacity": 0.9,
          }}
        />
      </Source>

      {/* Labels rendered last */}
      <Source id="uv-labels-source" type="geojson" data={unknownVisitsGeoJSON}>
        <Layer
          id="uv-labels"
          type="symbol"
          minzoom={10}
          layout={{
            visibility: vis(showVisitedPlaces),
            "text-field": "Unknown",
            "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
            "text-size": 12,
            "text-anchor": "top",
            "text-offset": [0, 0.5],
            "text-allow-overlap": false,
          }}
          paint={{
            "text-color": isDarkTheme ? "#fcd34d" : "#b45309",
            "text-halo-color": isDarkTheme ? "#1f2937" : "#ffffff",
            "text-halo-width": 1.5,
          }}
        />
      </Source>
      <Source id="place-labels-source" type="geojson" data={placeDotsGeoJSON}>
        <Layer
          id="place-labels"
          type="symbol"
          minzoom={9}
          layout={{
            visibility: vis(showVisitedPlaces),
            "text-field": ["case",
              [">", ["get", "visitCount"], 1],
              ["concat", ["get", "name"], " x", ["to-string", ["get", "visitCount"]]],
              ["get", "name"],
            ],
            "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
            "text-size": 12,
            "text-anchor": "bottom",
            "text-offset": [0, -0.8],
            "text-allow-overlap": false,
          }}
          filter={["any", ["get", "hasVisitsInRange"], ["get", "hovered"]]}
          paint={{
            "text-color": isDarkTheme ? "#e5e7eb" : "#1f2937",
            "text-halo-color": isDarkTheme ? "#111827" : "#ffffff",
            "text-halo-width": 2,
          }}
        />
      </Source>
    </>
  );
}
