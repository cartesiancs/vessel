import { SystemConfiguration } from "@/entities/configurations/types";

const valid = {
  HA: ["home_assistant_url", "home_assistant_token"],
  ROS: ["ros2_websocket_url"],
};

export function isValidConfig(
  configurations: SystemConfiguration[],
  target: "HA" | "ROS",
) {
  const requiredKeys = valid[target];
  const hasConfig = (key: string) =>
    configurations.some((c) => c.key === key && c.value && c.enabled !== 0);

  if (!requiredKeys) {
    return false;
  }

  return requiredKeys.every((key) => hasConfig(key));
}
