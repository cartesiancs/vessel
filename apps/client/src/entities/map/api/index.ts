import { apiClient } from "@/shared/api";
import {
  MapLayer,
  LayerWithFeatures,
  LayerPayload,
  FeaturePayload,
  MapFeature,
  FeatureWithVertices,
  UpdateFeaturePayload,
} from "./types";

export const getAllLayers = async (): Promise<MapLayer[]> => {
  const response = await apiClient.get<MapLayer[]>("/map/layers");
  return response.data;
};

export const getLayerWithFeatures = async (
  layerId: number,
): Promise<LayerWithFeatures> => {
  const response = await apiClient.get<LayerWithFeatures>(
    `/map/layers/${layerId}`,
  );
  return response.data;
};

export const createLayer = async (payload: LayerPayload): Promise<MapLayer> => {
  const response = await apiClient.post<MapLayer>("/map/layers", payload);
  return response.data;
};

export const updateLayer = async (
  layerId: number,
  payload: LayerPayload,
): Promise<MapLayer> => {
  const response = await apiClient.put<MapLayer>(
    `/map/layers/${layerId}`,
    payload,
  );
  return response.data;
};

export const deleteLayer = async (
  layerId: number,
): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/map/layers/${layerId}`);
  return response.data;
};

export const createFeature = async (
  payload: FeaturePayload,
): Promise<MapFeature> => {
  const response = await apiClient.post<MapFeature>("/map/features", payload);
  return response.data;
};

export const getFeatureWithVertices = async (
  featureId: number,
): Promise<FeatureWithVertices> => {
  const response = await apiClient.get<FeatureWithVertices>(
    `/map/features/${featureId}`,
  );
  return response.data;
};

export const updateFeature = async (
  featureId: number,
  payload: UpdateFeaturePayload,
): Promise<MapFeature> => {
  const response = await apiClient.put<MapFeature>(
    `/map/features/${featureId}`,
    payload,
  );
  return response.data;
};

export const deleteFeature = async (
  featureId: number,
): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/map/features/${featureId}`);
  return response.data;
};
