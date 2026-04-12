import type { PlaceData } from "@/lib/detectVisits";
import type { UnknownVisitData } from "@/components/map/MapWrapper";
import type { ImmichPhoto } from "@/lib/immich";
import type { SerializedPoint } from "@/lib/groupByHour";

export type MapBounds = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

export type LayerSettings = {
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  showLine: boolean;
  setShowLine: (v: boolean) => void;
  showVisitedPlaces: boolean;
  setShowVisitedPlaces: (v: boolean) => void;
  hidePoints: boolean;
  setHidePoints: (v: boolean) => void;
  hidePlaces: boolean;
  setHidePlaces: (v: boolean) => void;
  hidePhotos: boolean;
  setHidePhotos: (v: boolean) => void;
  settingsLoaded: boolean;
};

export type Props = {
  points: SerializedPoint[];
  pointsEnvelope?: MapBounds | null;
  rangeKey?: string;
  shouldAutoFit?: boolean;
  places?: PlaceData[];
  unknownVisits?: UnknownVisitData[];
  photos?: ImmichPhoto[];
  layerSettings?: LayerSettings;
  onBoundsChange?: (bounds: MapBounds) => void;
  onMapClick?: (lat: number, lon: number) => void;
  onCreateVisit?: (lat: number, lon: number) => void;
  onPlaceClick?: (place: PlaceData) => void;
  onPlaceMoveRequest?: (place: PlaceData, lat: number, lon: number) => void;
  onUnknownVisitCreatePlace?: (uv: UnknownVisitData) => void;
  onPhotoClick?: (photo: ImmichPhoto, list?: ImmichPhoto[]) => void;
};

export type PopupState =
  | { kind: "point"; point: SerializedPoint; lat: number; lon: number }
  | { kind: "unknownVisit"; uv: UnknownVisitData; lat: number; lon: number }
  | { kind: "photo"; photo: ImmichPhoto; lat: number; lon: number }
  | null;

export const MAP_LAYER_SETTINGS_KEY = "opentimeline:map-layer-settings";

export type MapLayerSettings = {
  showHeatmap?: boolean;
  showLine?: boolean;
  showVisitedPlaces?: boolean;
  showPoints?: boolean;
  showPlaces?: boolean;
  hidePoints?: boolean;
  hidePlaces?: boolean;
  hidePhotos?: boolean;
};

export const DEFAULT_MAP_LAYER_SETTINGS = {
  showHeatmap: false,
  showLine: true,
  showVisitedPlaces: true,
  hidePoints: false,
  hidePlaces: false,
  hidePhotos: false,
};

export const FIT_BOUNDS_PADDING = 40;
export const FIT_BOUNDS_MAX_ZOOM = 16.5;
export const PLAY_DURATION_PER_DAY_MS = 30000; // 30s per day of journey, capped at 5 min
