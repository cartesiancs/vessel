import type { SystemConfiguration } from "../model/types";

export const CODE_SERVICE_CONFIG_KEY = "code_service_enabled";

export function getCodeServiceEnabled(
  configurations: SystemConfiguration[],
): boolean {
  const row = configurations.find((c) => c.key === CODE_SERVICE_CONFIG_KEY);
  return row !== undefined && row.enabled === 1;
}
