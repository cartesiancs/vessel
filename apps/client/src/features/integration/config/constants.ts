export const INTEGRATION_DEVICE_ID: Record<string, string> = {
  "home-assistant": "home_assistant",
  ros2: "ros2_bridge",
  sdr: "sdr_server",
};

export const INTEGRATION_ENTITY_ID: Record<string, string> = {
  "home-assistant": "home_assistant.bridge",
  ros2: "ros2.bridge",
  sdr: "sdr.server",
};
