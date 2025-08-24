import { LatLng } from "leaflet";

export interface MapVertex {
  id: number;
  feature_id: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  sequence: number;
}

export interface MapFeature {
  id: number;
  layer_id: number;
  feature_type: "POINT" | "LINE" | "POLYGON";
  name?: string;
  style_properties?: string;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
}

export interface FeatureWithVertices extends MapFeature {
  vertices: MapVertex[];
}

export interface MapLayer {
  id: number;
  name: string;
  description?: string;
  owner_user_id: number;
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
  layer_id: number;
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

export type DrawingMode = "POINT" | "LINE" | "POLYGON" | null;

export interface MapInteractionState {
  selectedFeature: FeatureWithVertices | null;
  setSelectedFeature: (feature: FeatureWithVertices | null) => void;
  drawingMode: DrawingMode;
  currentVertices: LatLng[];
  setDrawingMode: (mode: DrawingMode) => void;
  addVertex: (vertex: LatLng) => void;
  clearDrawing: () => void;
}

export interface MapDataState {
  layer: LayerWithFeatures | null;
  isLoading: boolean;
  error: string | null;
  layers: MapLayer[];
  activeLayerId: number | null;
  fetchAllLayers: () => Promise<void>;
  setActiveLayer: (layerId: number) => Promise<void>;
  addLayer: (payload: LayerPayload) => Promise<void>;
  removeLayer: (layerId: number) => Promise<void>;
  editLayer: (layerId: number, payload: LayerPayload) => Promise<void>;
  fetchLayerData: (layerId: number) => Promise<void>;
  addFeature: (payload: FeaturePayload) => Promise<void>;
  removeFeature: (featureId: number) => Promise<void>;
}
