export interface SystemConfiguration {
  id: number;
  key: string;
  value: string;
  enabled: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type SystemConfigurationPayload = Omit<
  SystemConfiguration,
  "id" | "created_at" | "updated_at"
>;
