import "leaflet";

declare module "leaflet" {
  type HeatLatLngTuple = [number, number, number?];

  interface HeatLayerOptions extends LayerOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }

  interface HeatLayer extends Layer {
    setLatLngs(latlngs: Array<HeatLatLngTuple | LatLng>): this;
    addLatLng(latlng: HeatLatLngTuple | LatLng): this;
    setOptions(options: HeatLayerOptions): this;
    redraw(): this;
  }

  function heatLayer(
    latlngs: Array<HeatLatLngTuple | LatLng>,
    options?: HeatLayerOptions
  ): HeatLayer;
}

export {};
