import { apiClient } from "@/shared/api";
import { Flow, FlowPayload, FlowVersion, FlowVersionPayload } from "./types";

export const getFlows = async (): Promise<Flow[]> => {
  const { data } = await apiClient.get<Flow[]>("/flows");
  return data;
};

export const createFlow = async (payload: FlowPayload): Promise<Flow> => {
  const { data } = await apiClient.post<Flow>("/flows", payload);
  return data;
};

export const saveFlowVersion = async (
  flowId: number,
  payload: FlowVersionPayload,
): Promise<FlowVersion> => {
  const { data } = await apiClient.post<FlowVersion>(
    `/flows/${flowId}/versions`,
    payload,
  );
  return data;
};

export const getFlowVersions = async (
  flowId: number,
): Promise<FlowVersion[]> => {
  const { data } = await apiClient.get<FlowVersion[]>(
    `/flows/${flowId}/versions`,
  );
  return data;
};
