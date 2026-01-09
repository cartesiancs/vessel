import { Device } from "@/entities/device/types";
import { EntityAll } from "@/entities/entity/types";
import { Flow, FlowVersion } from "@/entities/flow/types";
import { HaState } from "@/entities/ha/types";
import { MapLayer, FeatureWithVertices } from "@/entities/map/types";
import { Permission } from "@/entities/permission/types";
import { Role } from "@/entities/role/types";
import { DeviceToken } from "@/entities/device-token/types";
import { Stat } from "@/entities/stat/types";
import { SystemConfiguration } from "@/entities/configurations/types";
import { User } from "@/entities/user/types";
import { CustomNode } from "@/entities/custom-nodes/types";

export type MockDatabase = {
  stat: Stat;
  devices: Device[];
  entities: EntityAll[];
  flows: Flow[];
  flowVersions: Record<number, FlowVersion[]>;
  configs: SystemConfiguration[];
  logs: {
    files: string[];
    contents: Record<string, string>;
  };
  storage: Record<string, { type: "file" | "dir"; content?: string }>;
  mapLayers: MapLayer[];
  mapFeatures: Record<number, FeatureWithVertices[]>;
  haStates: HaState[];
  customNodes: CustomNode[];
  permissions: Permission[];
  roles: Role[];
  users: User[];
  deviceTokens: Record<number, DeviceToken>;
};

export const createMockDb = (): MockDatabase => ({
  stat: {
    count: { devices: 2, entities: 3 },
  },
  devices: [
    {
      id: 1,
      device_id: "sensor-hub-1",
      name: "Sensor Hub A",
      manufacturer: "Vessel Labs",
      model: "VH-100",
    },
    {
      id: 2,
      device_id: "drone-1",
      name: "Delivery Drone",
      manufacturer: "Vessel Labs",
      model: "VD-42",
    },
  ],
  entities: [
    {
      id: 1,
      entity_id: "sensor-hub-1-temp",
      device_id: 1,
      friendly_name: "Room Temperature",
      platform: "mqtt",
      configuration: { topic: "sensors/temperature" },
      state: {
        state_id: 1,
        metadata_id: 1,
        state: "24.2",
        attributes: JSON.stringify({ unit: "°C" }),
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        created: new Date().toISOString(),
      },
      entity_type: "sensor",
    },
    {
      id: 2,
      entity_id: "sensor-hub-1-humidity",
      device_id: 1,
      friendly_name: "Humidity",
      platform: "mqtt",
      configuration: { topic: "sensors/humidity" },
      state: {
        state_id: 2,
        metadata_id: 1,
        state: "48",
        attributes: JSON.stringify({ unit: "%" }),
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        created: new Date().toISOString(),
      },
      entity_type: "sensor",
    },
    {
      id: 3,
      entity_id: "drone-1-camera",
      device_id: 2,
      friendly_name: "Front Camera",
      platform: "rtp",
      configuration: { topic: "drone/front-camera" },
      state: null,
      entity_type: "camera",
    },
  ],
  flows: [
    {
      id: 1,
      name: "Demo Flow",
      description: "Example flow that demonstrates mock data.",
      enabled: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  flowVersions: {
    1: [
      {
        id: 1,
        flow_id: 1,
        version: 1,
        graph_json: JSON.stringify({
          nodes: [
            {
              id: "start",
              title: "Start",
              x: 100,
              y: 100,
              width: 120,
              height: 60,
              connectors: [{ id: "start-out", name: "out", type: "out" }],
              nodeType: "START",
            },
            {
              id: "log",
              title: "Log Message",
              x: 320,
              y: 100,
              width: 140,
              height: 80,
              connectors: [{ id: "log-in", name: "message", type: "in" }],
              nodeType: "LOG_MESSAGE",
            },
          ],
          edges: [{ id: "start-log", source: "start", target: "log" }],
        }),
        comment: "Initial demo graph",
        created_at: new Date().toISOString(),
      },
    ],
  },
  configs: [
    {
      id: 1,
      key: "home_assistant_url",
      value: "https://demo-home-assistant.local",
      enabled: 1,
      description: "Demo HA endpoint",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 2,
      key: "home_assistant_token",
      value: "demo-ha-token",
      enabled: 1,
      description: "Demo HA token",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 3,
      key: "ros2_websocket_url",
      value: "ws://demo-ros2.local",
      enabled: 1,
      description: "Demo ROS2 bridge",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  logs: {
    files: ["server.log", "app.log"],
    contents: {
      "server.log":
        "[INFO] Server started in demo mode\n[INFO] All systems nominal\n",
      "app.log":
        "[INFO] User logged in (demo)\n[WARN] Using mock dataset only\n",
    },
  },
  storage: {
    "": { type: "dir" },
    src: { type: "dir" },
    "src/index.ts": {
      type: "file",
      content:
        "console.log('Demo file from mock storage');\nexport const demo = true;\n",
    },
    "README.md": {
      type: "file",
      content: "# Demo Project\nThis is a mock file system.\n",
    },
  },
  mapLayers: [
    {
      id: 1,
      name: "Demo Layer",
      description: "Sample map data",
      owner_user_id: 1,
      is_visible: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  mapFeatures: {
    1: [
      {
        id: 1,
        layer_id: 1,
        feature_type: "POINT",
        name: "HQ",
        style_properties: JSON.stringify({ color: "blue" }),
        created_by_user_id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        vertices: [
          {
            id: 1,
            feature_id: 1,
            latitude: 37.7749,
            longitude: -122.4194,
            altitude: 0,
            sequence: 0,
          },
        ],
      },
    ],
  },
  haStates: [
    {
      entity_id: "light.living_room",
      state: "on",
      attributes: { friendly_name: "Living Room Light", brightness: 200 },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      context: {},
    },
    {
      entity_id: "sensor.outdoor_temp",
      state: "18.4",
      attributes: { unit_of_measurement: "°C" },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      context: {},
    },
  ],
  customNodes: [
    {
      node_type: "demo_node",
      data: {
        name: "Demo Node",
        description: "Mock custom node",
        category: "demo",
        script_path: "/path/to/script",
        connectors: [],
      },
    },
  ],
  permissions: [
    { id: 1, name: "read", description: "Read access" },
    { id: 2, name: "write", description: "Write access" },
  ],
  roles: [
    {
      id: 1,
      name: "Admin",
      description: "Administrator",
      permissions: [
        { id: 1, name: "read", description: "Read access" },
        { id: 2, name: "write", description: "Write access" },
      ],
    },
  ],
  users: [
    {
      id: 1,
      username: "demo",
      email: "demo@example.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      roles: [
        {
          id: 1,
          name: "Admin",
          description: "Administrator",
          permissions: [
            { id: 1, name: "read", description: "Read access" },
            { id: 2, name: "write", description: "Write access" },
          ],
        },
      ],
    },
  ],
  deviceTokens: {},
});
