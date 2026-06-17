import { LatLng } from "leaflet";

export interface MapVertex {
  id?: string;
  feature_id?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  sequence: number;
}

export interface MapFeature {
  id: string;
  layer_id: string;
  feature_type: "POINT" | "LINE" | "POLYGON";
  name?: string;
  style_properties?: string;
}

export interface FeatureWithVertices extends MapFeature {
  vertices: MapVertex[];
}

export interface MapLayer {
  id: string;
  name: string;
  description?: string;
  is_visible: number;
  created_at: string;
  updated_at: string;
}

export interface LayerWithFeatures extends MapLayer {
  features: FeatureWithVertices[];
}

export interface LayerPayload {
  name: string;
  description?: string;
  is_visible?: boolean;
}

export interface VertexPayload {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface FeaturePayload {
  layer_id: string;
  feature_type: "POINT" | "LINE" | "POLYGON";
  name?: string;
  style_properties?: string;
  vertices: VertexPayload[];
}

export interface UpdateFeaturePayload {
  name?: string;
  style_properties?: string;
  vertices?: VertexPayload[];
}

export type MapExportFormat = "geojson" | "kml";

export interface ImportPayload {
  name?: string;
  format: "geojson" | "kml" | "json";
  file: File | Blob;
}

export type DrawingMode = "POINT" | "LINE" | "POLYGON" | null;

// 타일맵 타입 정의
export type TileMapType = "dark" | "satellite";

export interface TileMapConfig {
  type: TileMapType;
  url: string;
  attribution: string;
  maxNativeZoom: number;
}

export const TILE_MAPS: Record<TileMapType, TileMapConfig> = {
  dark: {
    type: "dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 20,
  },
  satellite: {
    type: "satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
    maxNativeZoom: 18,
  },
};

export interface MapInteractionState {
  selectedFeature: FeatureWithVertices | null;
  setSelectedFeature: (feature: FeatureWithVertices | null) => void;
  drawingMode: DrawingMode;
  currentVertices: LatLng[];
  setDrawingMode: (mode: DrawingMode) => void;
  addVertex: (vertex: LatLng) => void;
  clearDrawing: () => void;
  tileMapType: TileMapType;
  setTileMapType: (type: TileMapType) => void;
}

export interface MapDataState {
  layer: LayerWithFeatures | null;
  isLoading: boolean;
  error: string | null;
  layers: MapLayer[];
  activeLayerId: string | null;
  fetchAllLayers: () => Promise<void>;
  setActiveLayer: (layerId: string) => Promise<void>;
  addLayer: (payload: LayerPayload) => Promise<void>;
  removeLayer: (layerId: string) => Promise<void>;
  editLayer: (layerId: string, payload: LayerPayload) => Promise<void>;
  fetchLayerData: (layerId: string) => Promise<void>;
  importLayer: (payload: ImportPayload) => Promise<void>;
  addFeature: (payload: FeaturePayload) => Promise<void>;
  removeFeature: (featureId: string) => Promise<void>;
  updateFeature: (
    featureId: string,
    payload: UpdateFeaturePayload,
  ) => Promise<void>;
}
