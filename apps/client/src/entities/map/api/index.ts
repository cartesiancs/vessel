import { apiClient } from "@/shared/api";
import { downloadBlob } from "@/shared/lib/download";
import {
  MapLayer,
  LayerWithFeatures,
  LayerPayload,
  FeaturePayload,
  FeatureWithVertices,
  UpdateFeaturePayload,
  MapExportFormat,
  ImportPayload,
} from "../model/types";

export const getAllLayers = async (): Promise<MapLayer[]> => {
  const response = await apiClient.get<MapLayer[]>("/map/layers");
  return response.data;
};

export const getLayerWithFeatures = async (
  layerId: string,
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
  layerId: string,
  payload: LayerPayload,
): Promise<MapLayer> => {
  const response = await apiClient.put<MapLayer>(
    `/map/layers/${layerId}`,
    payload,
  );
  return response.data;
};

export const deleteLayer = async (
  layerId: string,
): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/map/layers/${layerId}`);
  return response.data;
};

export const createFeature = async (
  payload: FeaturePayload,
): Promise<FeatureWithVertices> => {
  const { layer_id, ...body } = payload;
  const response = await apiClient.post<FeatureWithVertices>(
    `/map/layers/${layer_id}/features`,
    body,
  );
  return response.data;
};

export const updateFeature = async (
  layerId: string,
  featureId: string,
  payload: UpdateFeaturePayload,
): Promise<FeatureWithVertices> => {
  const response = await apiClient.put<FeatureWithVertices>(
    `/map/layers/${layerId}/features/${featureId}`,
    payload,
  );
  return response.data;
};

export const deleteFeature = async (
  layerId: string,
  featureId: string,
): Promise<{ message: string }> => {
  const response = await apiClient.delete(
    `/map/layers/${layerId}/features/${featureId}`,
  );
  return response.data;
};

export const exportLayer = async (
  layerId: string,
  format: MapExportFormat,
): Promise<void> => {
  const response = await apiClient.get(`/map/layers/${layerId}/export`, {
    params: { format },
    responseType: "blob",
  });

  const disposition = response.headers["content-disposition"] as
    | string
    | undefined;
  let filename = `map.${format}`;
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) {
      filename = match[1];
    }
  }

  downloadBlob(response.data as Blob, filename);
};

export const importLayer = async (
  payload: ImportPayload,
): Promise<MapLayer> => {
  const form = new FormData();
  if (payload.name) {
    form.append("name", payload.name);
  }
  form.append("format", payload.format);
  form.append("file", payload.file);
  const response = await apiClient.post<MapLayer>("/map/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};
