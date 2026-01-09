import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import {
  FeatureWithVertices,
  MapFeature,
  MapLayer,
} from "@/entities/map/types";
import {
  SystemConfiguration,
  SystemConfigurationPayload,
} from "@/entities/configurations/types";
import { Device, DevicePayload } from "@/entities/device/types";
import { EntityAll, EntityPayload } from "@/entities/entity/types";
import { Role, CreateRolePayload } from "@/entities/role/types";
import { User, CreateUserPayload, UpdateUserPayload } from "@/entities/user/types";
import { Flow, FlowPayload } from "@/entities/flow/types";
import { CustomNodeFromApi } from "@/entities/custom-nodes/types";
import { createMockDb, MockDatabase } from "./mockData";

const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data));

const match = (path: string, pattern: RegExp) => {
  const matchResult = path.match(pattern);
  return matchResult ? matchResult.slice(1) : null;
};

const buildResponse = <T>(
  config: InternalAxiosRequestConfig,
  status: number,
  data: T,
): AxiosResponse<T> => ({
  data: clone(data),
  status,
  statusText: "OK",
  headers: {},
  config,
});

const normalizePath = (url?: string) => {
  if (!url) return "/";
  const withoutOrigin = url.replace(/^https?:\/\/[^/]+/i, "");
  const strippedApi = withoutOrigin.replace(/^\/api/i, "");
  return strippedApi.replace(/\/+$/, "") || "/";
};

export const createMockAdapter = (): AxiosAdapter => {
  const db: MockDatabase = createMockDb();

  const counters = {
    device: db.devices.length + 1,
    entity: db.entities.length + 1,
    flow: db.flows.length + 1,
    flowVersion: Object.values(db.flowVersions).flat().length + 1,
    config: db.configs.length + 1,
    layer: db.mapLayers.length + 1,
    feature: Object.values(db.mapFeatures).flat().length + 1,
    vertex: Object.values(db.mapFeatures)
      .flat()
      .reduce((acc, f) => acc + f.vertices.length, 1),
    customNode: db.customNodes.length + 1,
    role: db.roles.length + 1,
    user: db.users.length + 1,
    permission: db.permissions.length + 1,
    deviceToken: Object.keys(db.deviceTokens).length + 1,
  };

  const getDirectoryEntries = (path: string) => {
    const entries = Object.entries(db.storage).filter(([key]) => {
      const parent =
        key.lastIndexOf("/") === -1 ? "" : key.slice(0, key.lastIndexOf("/"));
      return parent === path && key !== "";
    });

    return entries.map(([name, value]) => ({
      name: name.replace(path ? `${path}/` : "", ""),
      isDir: value.type === "dir",
    }));
  };

  const ensureDir = (path: string) => {
    const segments = path.split("/").filter(Boolean);
    let current = "";
    segments.forEach((segment) => {
      current = current ? `${current}/${segment}` : segment;
      if (!db.storage[current]) {
        db.storage[current] = { type: "dir" };
      }
    });
  };

  const renamePath = (oldPath: string, newPath: string) => {
    const updates: [string, { type: "file" | "dir"; content?: string }][] = [];
    Object.entries(db.storage).forEach(([key, value]) => {
      if (key === oldPath || key.startsWith(`${oldPath}/`)) {
        const suffix = key.slice(oldPath.length);
        updates.push([`${newPath}${suffix}`, value]);
        delete db.storage[key];
      }
    });
    updates.forEach(([key, value]) => {
      db.storage[key] = value;
    });
  };

  const getDeviceWithEntities = (deviceId: number) => {
    const device = db.devices.find((d) => d.id === deviceId);
    if (!device) return null;
    const entities = db.entities.filter((e) => e.device_id === deviceId);
    return { ...device, entities } as unknown as DeviceWithEntities;
  };

  type DeviceWithEntities = MockDatabase["devices"][number] & {
    entities: MockDatabase["entities"];
  };

  type RequestBody = Record<string, unknown>;
  type VertexInput = {
    latitude: number;
    longitude: number;
    altitude?: number;
  };

  return async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? "get").toLowerCase();
    const path = normalizePath(config.url);
    const params = (config.params as Record<string, string>) || {};
    const body = (config.data as RequestBody) || {};

    // Stat
    if (method === "get" && path === "/stat") {
      return buildResponse(config, 200, db.stat);
    }

    // Configurations
    if (path === "/configurations") {
      if (method === "get") {
        return buildResponse(config, 200, db.configs);
      }
      if (method === "post") {
        const payload = body as SystemConfigurationPayload;
        const now = new Date().toISOString();
        const newConfig: SystemConfiguration = {
          id: counters.config++,
          key: payload.key ?? "config_key",
          value: payload.value ?? "",
          enabled: payload.enabled ?? 1,
          description: payload.description ?? null,
          created_at: now,
          updated_at: now,
        };
        db.configs.push(newConfig);
        return buildResponse(config, 200, newConfig);
      }
    }

    const configMatch = match(path, /^\/configurations\/(\d+)$/);
    if (configMatch) {
      const id = Number(configMatch[0]);
      const idx = db.configs.findIndex((c) => c.id === id);
      if (idx !== -1) {
        if (method === "put") {
          db.configs[idx] = {
            ...db.configs[idx],
            ...body,
            updated_at: new Date().toISOString(),
          };
          return buildResponse(config, 200, db.configs[idx]);
        }
        if (method === "delete") {
          const deleted = db.configs[idx];
          db.configs.splice(idx, 1);
          return buildResponse(config, 200, deleted);
        }
      }
    }

    // Devices
    if (path === "/devices" && method === "get") {
      return buildResponse(config, 200, db.devices);
    }
    if (path === "/devices" && method === "post") {
      const payload = body as DevicePayload;
      const newDevice: Device = {
        id: counters.device++,
        device_id: payload.device_id ?? `device-${Date.now()}`,
        name: payload.name ?? null,
        manufacturer: payload.manufacturer ?? null,
        model: payload.model ?? null,
      };
      db.devices.push(newDevice);
      return buildResponse(config, 200, newDevice);
    }

    const deviceByIdMatch = match(path, /^\/devices\/id\/(\d+)$/);
    if (deviceByIdMatch && method === "get") {
      const id = Number(deviceByIdMatch[0]);
      const device = getDeviceWithEntities(id);
      if (device) return buildResponse(config, 200, device);
    }

    const deviceMatch = match(path, /^\/devices\/(\d+)$/);
    if (deviceMatch) {
      const id = Number(deviceMatch[0]);
      const idx = db.devices.findIndex((d) => d.id === id);
      if (idx !== -1) {
        if (method === "put") {
          db.devices[idx] = { ...db.devices[idx], ...body };
          return buildResponse(config, 200, db.devices[idx]);
        }
        if (method === "delete") {
          const deleted = db.devices[idx];
          db.devices.splice(idx, 1);
          return buildResponse(config, 200, deleted);
        }
      }
    }

    // Device tokens
    const tokenMatch = match(path, /^\/devices\/(\d+)\/token$/);
    if (tokenMatch) {
      const deviceId = Number(tokenMatch[0]);
      if (method === "post") {
        const token = `token-${deviceId}-${Date.now()}`;
        const tokenObj = {
          id: counters.deviceToken++,
          device_id: deviceId,
          token,
          expires_at: null,
          last_used_at: null,
          created_at: new Date().toISOString(),
        };
        db.deviceTokens[deviceId] = tokenObj;
        return buildResponse(config, 200, {
          message: "issued",
          token,
        });
      }
      if (method === "get") {
        const tokenInfo = db.deviceTokens[deviceId];
        return buildResponse(config, 200, tokenInfo ?? { message: "none" });
      }
      if (method === "delete") {
        delete db.deviceTokens[deviceId];
        return buildResponse(config, 200, { message: "revoked" });
      }
    }

    // Entities
    if (path === "/entities" && method === "get") {
      const filtered = params.entity_type
        ? db.entities.filter((e) => e.entity_type === params.entity_type)
        : db.entities;
      return buildResponse(config, 200, filtered);
    }
    if (path === "/entities" && method === "post") {
      const payload = body as EntityPayload;
      const newEntity: EntityAll = {
        id: counters.entity++,
        entity_id: payload.entity_id ?? `entity-${Date.now()}`,
        device_id: payload.device_id ?? 0,
        friendly_name: payload.friendly_name ?? "",
        platform: payload.platform ?? "",
        configuration: (payload.configuration as Record<string, unknown> | null) ?? null,
        state: null,
        entity_type: payload.entity_type ?? "",
      };
      db.entities.push(newEntity);
      db.stat.count.entities = db.entities.length;
      return buildResponse(config, 200, newEntity);
    }
    const entityMatch = match(path, /^\/entities\/(\d+)$/);
    if (entityMatch) {
      const id = Number(entityMatch[0]);
      const idx = db.entities.findIndex((e) => e.id === id);
      if (idx !== -1) {
        if (method === "put") {
          db.entities[idx] = { ...db.entities[idx], ...body };
          return buildResponse(config, 200, db.entities[idx]);
        }
        if (method === "delete") {
          const deleted = db.entities[idx];
          db.entities.splice(idx, 1);
          db.stat.count.entities = db.entities.length;
          return buildResponse(config, 200, deleted);
        }
      }
    }
    if (path === "/entities/all" && method === "get") {
      const filtered = params.entity_type
        ? db.entities.filter((e) => e.entity_type === params.entity_type)
        : db.entities;
      return buildResponse(config, 200, filtered);
    }

    // Permissions
    if (path === "/permissions" && method === "get") {
      return buildResponse(config, 200, db.permissions);
    }

    // Roles
    if (path === "/roles") {
      if (method === "get") {
        return buildResponse(config, 200, db.roles);
      }
      if (method === "post") {
        const payload = body as CreateRolePayload;
        const newRole: Role = {
          id: counters.role++,
          name: payload.name ?? `Role ${counters.role}`,
          description: payload.description ?? null,
          permissions: db.permissions.filter((p) =>
            (payload.permission_ids ?? []).includes(p.id),
          ),
        };
        db.roles.push(newRole);
        return buildResponse(config, 200, newRole);
      }
    }
    const roleMatch = match(path, /^\/roles\/(\d+)$/);
    if (roleMatch) {
      const id = Number(roleMatch[0]);
      const idx = db.roles.findIndex((r) => r.id === id);
      if (idx !== -1) {
        if (method === "put") {
          const payload = body as Partial<CreateRolePayload>;
          db.roles[idx] = {
            ...db.roles[idx],
            ...payload,
            name: payload.name ?? db.roles[idx].name,
            description: payload.description ?? db.roles[idx].description,
            permissions: db.permissions.filter((p) =>
              ((payload.permission_ids as number[] | undefined) ?? []).includes(
                p.id,
              ),
            ),
          };
          return buildResponse(config, 200, db.roles[idx]);
        }
        if (method === "delete") {
          const deleted = db.roles[idx];
          db.roles.splice(idx, 1);
          return buildResponse(config, 200, deleted);
        }
      }
    }

    // Users
    if (path === "/users") {
      if (method === "get") {
        return buildResponse(config, 200, db.users);
      }
      if (method === "post") {
        const payload = body as CreateUserPayload;
        const newUser: User = {
          id: counters.user++,
          username: payload.username ?? `user-${counters.user}`,
          email: payload.email ?? "",
          roles: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        db.users.push(newUser);
        return buildResponse(config, 200, newUser);
      }
    }

    const userMatch = match(path, /^\/users\/(\d+)$/);
    if (userMatch) {
      const id = Number(userMatch[0]);
      const idx = db.users.findIndex((u) => u.id === id);
      if (idx !== -1) {
        if (method === "put") {
          const payload = body as UpdateUserPayload;
          db.users[idx] = {
            ...db.users[idx],
            ...payload,
            username: payload.username ?? db.users[idx].username,
            email: payload.email ?? db.users[idx].email,
            updated_at: new Date().toISOString(),
          };
          return buildResponse(config, 200, db.users[idx]);
        }
        if (method === "delete") {
          const deleted = db.users[idx];
          db.users.splice(idx, 1);
          return buildResponse(config, 200, deleted);
        }
      }
    }

    const userRoleAssign = match(path, /^\/users\/(\d+)\/roles$/);
    if (userRoleAssign && method === "post") {
      const id = Number(userRoleAssign[0]);
      const user = db.users.find((u) => u.id === id);
      if (user) {
        const role = db.roles.find(
          (r) => r.id === (body.role_id as number | undefined),
        );
        if (role && !user.roles.find((r) => r.id === role.id)) {
          user.roles.push(role);
        }
        return buildResponse(config, 200, user);
      }
    }
    const userRoleRevoke = match(path, /^\/users\/(\d+)\/roles\/(\d+)$/);
    if (userRoleRevoke && method === "delete") {
      const userId = Number(userRoleRevoke[0]);
      const roleId = Number(userRoleRevoke[1]);
      const user = db.users.find((u) => u.id === userId);
      if (user) {
        user.roles = user.roles.filter((r) => r.id !== roleId);
        return buildResponse(config, 200, user);
      }
    }

    // Flows
    if (path === "/flows" && method === "get") {
      return buildResponse(config, 200, db.flows);
    }
    if (path === "/flows" && method === "post") {
      const payload = body as Partial<FlowPayload>;
      const newFlow: Flow = {
        id: counters.flow++,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        enabled: payload.enabled ?? 1,
        name: payload.name ?? `Flow ${counters.flow}`,
        description: payload.description ?? null,
      };
      db.flows.push(newFlow);
      db.flowVersions[newFlow.id] = [];
      return buildResponse(config, 200, newFlow);
    }
    const flowMatch = match(path, /^\/flows\/(\d+)$/);
    if (flowMatch && method === "delete") {
      const id = Number(flowMatch[0]);
      const idx = db.flows.findIndex((f) => f.id === id);
      if (idx !== -1) {
        const removed = db.flows[idx];
        db.flows.splice(idx, 1);
        delete db.flowVersions[id];
        return buildResponse(config, 200, removed);
      }
    }

    const flowVersionMatch = match(path, /^\/flows\/(\d+)\/versions$/);
    if (flowVersionMatch) {
      const flowId = Number(flowVersionMatch[0]);
      if (method === "get") {
        return buildResponse(config, 200, db.flowVersions[flowId] ?? []);
      }
      if (method === "post") {
        const versions = db.flowVersions[flowId] ?? [];
        const versionNumber =
          versions.length > 0
            ? Math.max(...versions.map((v) => v.version)) + 1
            : 1;
        const newVersion = {
          id: counters.flowVersion++,
          flow_id: flowId,
          version: versionNumber,
          comment: (body.comment as string | undefined) ?? null,
          graph_json: (body.graph_json as string | undefined) ?? "{}",
          created_at: new Date().toISOString(),
        };
        if (!db.flowVersions[flowId]) {
          db.flowVersions[flowId] = [];
        }
        db.flowVersions[flowId].push(newVersion);
        return buildResponse(config, 200, newVersion);
      }
    }

    // Custom nodes
    if (path === "/custom-nodes") {
      if (method === "get") {
        return buildResponse(config, 200, db.customNodes);
      }
      if (method === "post") {
        const payload = body as Partial<CustomNodeFromApi>;
        const newNode: CustomNodeFromApi = {
          node_type: payload.node_type ?? "demo_node",
          data: payload.data ?? {},
        };
        db.customNodes.push(newNode);
        return buildResponse(config, 200, newNode);
      }
    }
    const customNodeMatch = match(path, /^\/custom-nodes\/([^/]+)$/);
    if (customNodeMatch) {
      const nodeType = customNodeMatch[0];
      const idx = db.customNodes.findIndex((n) => n.node_type === nodeType);
      if (idx !== -1) {
        if (method === "put") {
          db.customNodes[idx] = {
            ...db.customNodes[idx],
            data: body.data as Record<string, unknown>,
          };
          return buildResponse(config, 200, db.customNodes[idx]);
        }
        if (method === "delete") {
          const deleted = db.customNodes[idx];
          db.customNodes.splice(idx, 1);
          return buildResponse(config, 200, deleted);
        }
      }
    }

    // Map layers
    if (path === "/map/layers") {
      if (method === "get") {
        return buildResponse(config, 200, db.mapLayers);
      }
      if (method === "post") {
        const isVisible = Boolean(body.is_visible ?? true);
        const payload = body as Partial<MapLayer>;
        const newLayer: MapLayer = {
          id: counters.layer++,
          owner_user_id: 1,
          is_visible: isVisible ? 1 : 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          name: payload.name ?? `Layer ${counters.layer}`,
          description: payload.description,
        };
        db.mapLayers.push(newLayer);
        db.mapFeatures[newLayer.id] = [];
        return buildResponse(config, 200, newLayer);
      }
    }

    const mapLayerMatch = match(path, /^\/map\/layers\/(\d+)$/);
    if (mapLayerMatch) {
      const layerId = Number(mapLayerMatch[0]);
      if (method === "get") {
        const layer = db.mapLayers.find((l) => l.id === layerId);
        if (layer) {
          return buildResponse(config, 200, {
            ...layer,
            features: db.mapFeatures[layerId] ?? [],
          });
        }
      }
      if (method === "put") {
        const idx = db.mapLayers.findIndex((l) => l.id === layerId);
        if (idx !== -1) {
          const isVisible = Boolean(
            body.is_visible ?? Boolean(db.mapLayers[idx].is_visible),
          );
          const payload = body as Partial<MapLayer>;
          db.mapLayers[idx] = {
            ...db.mapLayers[idx],
            ...payload,
            name: payload.name ?? db.mapLayers[idx].name,
            description: payload.description ?? db.mapLayers[idx].description,
            is_visible: isVisible ? 1 : 0,
            updated_at: new Date().toISOString(),
          };
          return buildResponse(config, 200, db.mapLayers[idx]);
        }
      }
      if (method === "delete") {
        const idx = db.mapLayers.findIndex((l) => l.id === layerId);
        if (idx !== -1) {
          const deleted = db.mapLayers[idx];
          db.mapLayers.splice(idx, 1);
          delete db.mapFeatures[layerId];
          return buildResponse(config, 200, { message: "deleted", ...deleted });
        }
      }
    }

    // Map features
    if (path === "/map/features" && method === "post") {
      const featureId = counters.feature++;
      const vertices = (body.vertices as VertexInput[] | undefined ?? []).map(
        (v, idx: number) => ({
          id: counters.vertex++,
          feature_id: featureId,
          sequence: idx,
          latitude: v.latitude,
          longitude: v.longitude,
          altitude: v.altitude ?? 0,
        }),
      );
      const newFeature: MapFeature = {
        id: featureId,
        layer_id: body.layer_id as number,
        feature_type: body.feature_type as MapFeature["feature_type"],
        name: (body.name as string | undefined) ?? "",
        style_properties: (body.style_properties as string | undefined) ?? "",
        created_by_user_id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const featureWithVertices: FeatureWithVertices = {
        ...newFeature,
        vertices,
      };
      if (!db.mapFeatures[newFeature.layer_id]) {
        db.mapFeatures[newFeature.layer_id] = [];
      }
      db.mapFeatures[newFeature.layer_id].push(featureWithVertices);
      return buildResponse(config, 200, newFeature);
    }

    const mapFeatureMatch = match(path, /^\/map\/features\/(\d+)$/);
    if (mapFeatureMatch) {
      const featureId = Number(mapFeatureMatch[0]);
      const layerId = Number(
        Object.entries(db.mapFeatures).find(([, features]) =>
          features.some((f) => f.id === featureId),
        )?.[0] ?? 0,
      );
      const features = db.mapFeatures[layerId] ?? [];
      const idx = features.findIndex((f) => f.id === featureId);
      if (idx !== -1) {
        if (method === "get") {
          return buildResponse(config, 200, features[idx]);
        }
        if (method === "put") {
          const updated = {
            ...features[idx],
            ...body,
            vertices: body.vertices
              ? (body.vertices as VertexInput[]).map((v, i: number) => ({
                  id: counters.vertex++,
                  feature_id: featureId,
                  sequence: i,
                  latitude: v.latitude,
                  longitude: v.longitude,
                  altitude: v.altitude ?? 0,
                }))
              : features[idx].vertices,
            updated_at: new Date().toISOString(),
          };
          features[idx] = updated;
          db.mapFeatures[layerId] = features;
          return buildResponse(config, 200, updated);
        }
        if (method === "delete") {
          const deleted = features[idx];
          features.splice(idx, 1);
          db.mapFeatures[layerId] = features;
          return buildResponse(config, 200, { message: "deleted", ...deleted });
        }
      }
    }

    // HA
    if (path === "/ha/states" && method === "get") {
      return buildResponse(config, 200, db.haStates);
    }

    // Logs
    if (path === "/logs/latest" && method === "get") {
      const filename = db.logs.files[0];
      return buildResponse(config, 200, {
        filename,
        logs: db.logs.contents[filename],
      });
    }
    if (path === "/logs" && method === "get") {
      return buildResponse(config, 200, { files: db.logs.files });
    }
    const logMatch = match(path, /^\/logs\/(.+)$/);
    if (logMatch && method === "get") {
      const filename = logMatch[0];
      return buildResponse(config, 200, {
        filename,
        logs: db.logs.contents[filename] ?? "",
      });
    }

    // Storage
    if (path.startsWith("/storage")) {
      const relPath = path.replace(/^\/storage\/?/, "");
      if (method === "get") {
        if (relPath === "" || db.storage[relPath]?.type === "dir") {
          const entries = getDirectoryEntries(relPath);
          return buildResponse(config, 200, { path: relPath, entries });
        }
        const file = db.storage[relPath];
        if (file?.type === "file") {
          return buildResponse(config, 200, file.content ?? "");
        }
      }
      if (method === "put") {
        ensureDir(
          relPath.includes("/")
            ? relPath.split("/").slice(0, -1).join("/")
            : "",
        );
        const content = (body.content as string | undefined) ?? "";
        db.storage[relPath] = { type: "file", content };
        return buildResponse(config, 200, { message: "saved" });
      }
      if (method === "post" && relPath.startsWith("mkdir/")) {
        const dir = relPath.replace(/^mkdir\//, "");
        ensureDir(dir);
        db.storage[dir] = { type: "dir" };
        return buildResponse(config, 200, { message: "created" });
      }
      if (method === "post" && relPath.startsWith("rename/")) {
        const oldPath = relPath.replace(/^rename\//, "");
        const newPath = (body.to as string | undefined) ?? oldPath;
        renamePath(oldPath, newPath);
        return buildResponse(config, 200, { message: "renamed" });
      }
      if (method === "delete") {
        delete db.storage[relPath];
        Object.keys(db.storage).forEach((key) => {
          if (key.startsWith(`${relPath}/`)) {
            delete db.storage[key];
          }
        });
        return buildResponse(config, 200, { message: "deleted" });
      }
    }

    // Fallback
    return buildResponse(config, 200, {});
  };
};
