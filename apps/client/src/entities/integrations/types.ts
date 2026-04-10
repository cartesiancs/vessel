export interface IntegrationStatus {
  home_assistant: { connected: boolean };
  ros2: { connected: boolean };
  sdr: { connected: boolean };
}

export interface IntegrationRegisterPayload {
  integration_id: string;
  config: Record<string, string>;
}
