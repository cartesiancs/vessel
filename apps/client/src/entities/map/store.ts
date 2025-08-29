import { create } from "zustand";
import * as mapApi from "./api";
import { MapDataState, MapInteractionState, FeaturePayload } from "./types";

export const useMapDataStore = create<MapDataState>((set, get) => ({
  layer: null,
  isLoading: false,
  error: null,
  layers: [],
  activeLayerId: null,
  fetchAllLayers: async () => {
    try {
      const layers = await mapApi.getAllLayers();
      set({ layers });
      if (layers.length > 0 && !get().activeLayerId) {
        get().setActiveLayer(layers[0].id);
      }
    } catch (err) {
      set({ error: "Failed to fetch layers" + err });
    }
  },
  setActiveLayer: async (layerId) => {
    set({ isLoading: true, activeLayerId: layerId });
    try {
      const layerData = await mapApi.getLayerWithFeatures(layerId);
      set({ layer: layerData, isLoading: false });
    } catch (err) {
      set({
        error: "Failed to fetch active layer data" + err,
        isLoading: false,
      });
    }
  },
  addLayer: async (payload) => {
    try {
      await mapApi.createLayer(payload);
      await get().fetchAllLayers(); // 목록 새로고침
    } catch (err) {
      set({ error: "Failed to create layer" + err });
    }
  },
  removeLayer: async (layerId) => {
    try {
      await mapApi.deleteLayer(layerId);
      set((state) => ({
        layers: state.layers.filter((l) => l.id !== layerId),
      }));
      if (get().activeLayerId === layerId) {
        set({ layer: null, activeLayerId: null });
        const remainingLayers = get().layers;
        if (remainingLayers.length > 0) {
          get().setActiveLayer(remainingLayers[0].id);
        }
      }
    } catch (err) {
      set({ error: "Failed to delete layer" + err });
    }
  },
  editLayer: async (layerId, payload) => {
    try {
      await mapApi.updateLayer(layerId, payload);
      await get().fetchAllLayers();
    } catch (err) {
      set({ error: "Failed to update layer" + err });
    }
  },
  fetchLayerData: async (layerId) => {
    set({ isLoading: true, error: null });
    try {
      const layerData = await mapApi.getLayerWithFeatures(layerId);
      set({ layer: layerData, isLoading: false });
    } catch (err) {
      set({ error: "Failed to fetch map data" + err, isLoading: false });
    }
  },
  addFeature: async (payload: FeaturePayload) => {
    try {
      const newFeature = await mapApi.createFeature(payload);
      const featureWithVertices = await mapApi.getFeatureWithVertices(
        newFeature.id,
      );
      const currentLayer = get().layer;
      if (currentLayer) {
        set({
          layer: {
            ...currentLayer,
            features: [...currentLayer.features, featureWithVertices],
          },
        });
      }
    } catch (err) {
      set({ error: "Failed to add feature" + err });
    }
  },
  removeFeature: async (featureId) => {
    try {
      await mapApi.deleteFeature(featureId);
      const currentLayer = get().layer;
      if (currentLayer) {
        set({
          layer: {
            ...currentLayer,
            features: currentLayer.features.filter((f) => f.id !== featureId),
          },
        });
        useMapInteractionStore.getState().setSelectedFeature(null);
      }
    } catch (err) {
      set({ error: "Failed to remove feature" + err });
    }
  },
  updateFeature: async (featureId, payload) => {
    try {
      const updatedFeatureData = await mapApi.updateFeature(featureId, payload);
      const featureWithVertices = await mapApi.getFeatureWithVertices(
        updatedFeatureData.id,
      );
      const currentLayer = get().layer;
      if (currentLayer) {
        set({
          layer: {
            ...currentLayer,
            features: currentLayer.features.map((f) =>
              f.id === featureId ? featureWithVertices : f,
            ),
          },
        });
        useMapInteractionStore
          .getState()
          .setSelectedFeature(featureWithVertices);
      }
    } catch (err) {
      set({ error: "Failed to update feature" + err });
    }
  },
}));

export const useMapInteractionStore = create<MapInteractionState>(
  (set, get) => ({
    selectedFeature: null,
    setSelectedFeature: (feature) => set({ selectedFeature: feature }), // 피처 선택 시 엔티티 선택은 해제

    drawingMode: null,
    currentVertices: [],
    setDrawingMode: (mode) => {
      get().clearDrawing();
      set({ drawingMode: mode });
    },
    addVertex: (vertex) => {
      set((state) => ({
        currentVertices: [...state.currentVertices, vertex],
      }));
    },
    clearDrawing: () => {
      set({ currentVertices: [], drawingMode: null });
    },
  }),
);
