# Device Point Colors & Legend

## Summary

Show distinct point colors per device on the map, and display a legend (bottom-right) mapping device IDs to their colors when the points layer is visible.

## Constraints

- Green (#22c55e) for the first point and red (#ef4444) for the last point are preserved — device color applies only to intermediate points.
- `deviceId` is already included in each GeoJSON point feature property.
- Follows the existing pattern where path segments use `["get", "color"]` encoded in GeoJSON properties.

## Data Layer — `useMapGeoJSON.ts`

1. Before building point features, collect all unique `deviceId` values (including `null`).
2. Assign each a color from a fixed palette of 8–10 visually distinct colors, cycling if there are more devices than palette entries.
3. `null` deviceId maps to the current fallback blue `#3b82f6`.
4. Each point feature gains a `deviceColor` property (the assigned color string) and a `deviceStrokeColor` property (a darker shade).
5. The hook returns `pointsGeoJSON` (unchanged shape) plus a new `deviceColors: Map<string | null, string>` export.

## Map Layer — `MapLayers.tsx`

`circle-color` paint expression becomes:
```
["case",
  ["get", "isFirst"], "#22c55e",
  ["get", "isLast"],  "#ef4444",
  ["get", "deviceColor"]
]
```
`circle-stroke-color` mirrors the same pattern using `deviceStrokeColor`.

No new props needed on `MapLayers` — data is encoded in the GeoJSON.

## Legend Component — `PointsLegend.tsx`

- New file: `components/map/PointsLegend.tsx`
- Props: `deviceColors: Map<string | null, string>`, `hidePoints: boolean`
- Renders nothing when `hidePoints` is true.
- Positioned `absolute bottom-4 right-4 z-900` inside the map container.
- Compact semi-transparent card (white bg, rounded, shadow) matching existing map UI.
- Each row: small filled circle (device color) + label (deviceId string, or "Unknown" for null).

## Integration

- `useMapGeoJSON` returns `deviceColors` alongside the existing GeoJSON objects.
- Parent component (`MapLibreMap` or `MapWrapper`) passes `deviceColors` and `hidePoints` to `PointsLegend`.
- `PointsLegend` is rendered inside the map container alongside `LayerToggleColumn`.

## Testing

- Unit test for the color assignment logic: verify deterministic color assignment, cycling behavior, null fallback.
- Unit test for `PointsLegend`: renders when `!hidePoints`, hidden when `hidePoints`, shows correct labels and colors.
- No e2e tests needed — legend is purely presentational.
