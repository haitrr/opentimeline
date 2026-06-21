"use client";

import React, { useMemo } from "react";
import { Source, Layer } from "react-map-gl/maplibre";
import type { GeoJSON } from "geojson";
import type { LayerSettings } from "@/components/map/hooks/useLayerSettings";
import { geoCircle } from "@/components/map/mapUtils";

type GeoJSONData = GeoJSON;

type Props = {
  layerSettings: LayerSettings;
  isDarkTheme: boolean;
  pathGeoJSON: GeoJSONData;
  heatGeoJSON: GeoJSONData;
  pointsGeoJSON: GeoJSONData;
  placeCirclesGeoJSON: GeoJSONData;
  hoveredPlaceCircleGeoJSON: GeoJSONData;
  placeDotsGeoJSON: GeoJSONData;
  unknownVisitsGeoJSON: GeoJSONData;
  photosGeoJSON: GeoJSONData;
  pointCount: number;
  previewCircle?: { lat: number; lon: number; radius: number } | null;
};

function vis(show: boolean): "visible" | "none" {
  return show ? "visible" : "none";
}

export default function MapLayers({
  layerSettings,
  isDarkTheme,
  pathGeoJSON,
  heatGeoJSON,
  pointsGeoJSON,
  placeCirclesGeoJSON,
  hoveredPlaceCircleGeoJSON,
  placeDotsGeoJSON,
  unknownVisitsGeoJSON,
  photosGeoJSON,
  pointCount,
  previewCircle,
}: Props) {
  const { showHeatmap, showLine, showVisitedPlaces, hidePoints, hidePlaces, hidePhotos } = layerSettings;

  const previewCircleGeoJSON = useMemo(
    () =>
      previewCircle
        ? { type: "Feature" as const, geometry: geoCircle(previewCircle.lat, previewCircle.lon, previewCircle.radius), properties: {} }
        : null,
    [previewCircle]
  );

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
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.3, 5, 0.5, 8, 0.8, 11, 1, 14, 1.2],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 18, 5, 25, 8, 30, 11, 25, 14, 20],
            "heatmap-color": isDarkTheme
              ? [
                  "interpolate", ["linear"], ["heatmap-density"],
                  0,    "rgba(0,0,0,0)",
                  0.1,  "rgba(45,0,90,0.9)",
                  0.3,  "rgba(110,0,140,1)",
                  0.5,  "rgba(190,20,110,1)",
                  0.7,  "rgba(240,110,20,1)",
                  0.9,  "rgba(210,15,15,1)",
                  1.0,  "rgba(230,30,30,1)",
                ]
              : [
                  "interpolate", ["linear"], ["heatmap-density"],
                  0,    "rgba(0,0,0,0)",
                  0.15, "rgba(80,18,123,0.7)",
                  0.35, "rgba(162,37,155,0.85)",
                  0.55, "rgba(212,87,157,0.92)",
                  0.75, "rgba(251,180,109,0.97)",
                  1.0,  "rgba(220,30,30,1)",
                ],
            "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.85, 8, 0.88, 14, 0.9],
          }}
        />
      </Source>

      {/* Path line */}
      <Source id="path" type="geojson" data={pathGeoJSON}>
        <Layer
          id="path-line"
          type="line"
          layout={{ visibility: vis(showLine && pointCount > 1), "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": ["get", "color"],
            "line-width": showHeatmap ? 2 : 3,
            "line-opacity": showHeatmap ? 0.5 : 0.75,
          }}
        />
        <Layer
          id="path-arrows"
          type="symbol"
          minzoom={11}
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
          filter={["get", "hasVisitsInRange"]}
          paint={{
            "fill-color": ["case", ["get", "hasConfirmedInRange"], "#22c55e", "#a855f7"],
            "fill-opacity": ["case", ["get", "hasConfirmedInRange"], 0.2, 0.15],
          }}
        />
        <Layer
          id="place-circle-solid-outline"
          type="line"
          layout={{ visibility: vis(showVisitedPlaces) }}
          filter={["get", "hasConfirmedInRange"]}
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
          ]}
          paint={{
            "line-color": "#7e22ce",
            "line-width": 2,
            "line-dasharray": [6, 6],
          }}
        />
      </Source>

      {/* Hovered place radius */}
      <Source id="hovered-place-circle" type="geojson" data={hoveredPlaceCircleGeoJSON}>
        <Layer
          id="hovered-place-circle-fill"
          type="fill"
          layout={{ visibility: vis(showVisitedPlaces) }}
          paint={{
            "fill-color": ["case", ["get", "hasConfirmedInRange"], "#22c55e", "#a855f7"],
            "fill-opacity": ["case", ["get", "hasConfirmedInRange"], 0.2, 0.15],
          }}
        />
        <Layer
          id="hovered-place-circle-outline"
          type="line"
          layout={{ visibility: vis(showVisitedPlaces) }}
          paint={{
            "line-color": ["case", ["get", "hasConfirmedInRange"], "#16a34a", "#7e22ce"],
            "line-width": 2,
          }}
        />
      </Source>

      {/* Location points */}
      <Source id="points" type="geojson" data={pointsGeoJSON} promoteId="id">
        <Layer
          id="location-points"
          type="circle"
          minzoom={12}
          layout={{ visibility: vis(!hidePoints) }}
          paint={{
            "circle-radius": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              8,
              ["case", ["any", ["get", "isFirst"], ["get", "isLast"]], 6, 4],
            ],
            "circle-color": ["case",
              ["get", "isFirst"], "#22c55e",
              ["get", "isLast"],  "#ef4444",
              ["get", "deviceColor"],
            ],
            "circle-stroke-color": ["case",
              ["get", "isFirst"], "#15803d",
              ["get", "isLast"],  "#b91c1c",
              ["get", "deviceStrokeColor"],
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
            "circle-radius": 4,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#64748b",
            "circle-stroke-width": 2,
            "circle-opacity": 0.95,
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

      {/* Place creation preview circle */}
      {previewCircleGeoJSON && (
        <Source id="place-preview-circle" type="geojson" data={previewCircleGeoJSON}>
          <Layer
            id="place-preview-fill"
            type="fill"
            paint={{ "fill-color": "#3b82f6", "fill-opacity": 0.15 }}
          />
          <Layer
            id="place-preview-outline"
            type="line"
            paint={{ "line-color": "#2563eb", "line-width": 2, "line-dasharray": [5, 4] }}
          />
        </Source>
      )}
    </>
  );
}
