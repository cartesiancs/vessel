import { apiClient } from "@/shared/api";
import type { IntegrationStatus, IntegrationRegisterPayload } from "./types";

export const getIntegrationStatus = () =>
  apiClient.get<IntegrationStatus>("/integrations/status");

export const registerIntegration = (data: IntegrationRegisterPayload) =>
  apiClient.post("/integrations/register", data);

export const deleteIntegration = (integrationId: string) =>
  apiClient.delete(`/integrations/${integrationId}`);
