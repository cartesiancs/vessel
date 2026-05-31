const request = require("supertest");

const API_BASE_URL = "http://localhost:6174";
const RUN_ID = Date.now();
const uniq = (s) => `${s}_${RUN_ID}`;

describe("Vessel API E2E Test", () => {
  let authToken;

  beforeAll(async () => {
    const response = await request(API_BASE_URL).post("/api/auth").send({
      id: "admin",
      password: "admin1",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("token");
    authToken = response.body.token;
  });

  const auth = (req) => req.set("Authorization", `Bearer ${authToken}`);

  describe("Server Info", () => {
    it("GET /info returns server info without auth", async () => {
      const res = await request(API_BASE_URL).get("/info");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: "vessel-server", code: 200 });
    });
  });

  describe("Auth API", () => {
    it("POST /api/auth rejects wrong credentials with 401", async () => {
      const res = await request(API_BASE_URL).post("/api/auth").send({
        id: "admin",
        password: "definitely-wrong-password",
      });
      expect(res.status).toBe(401);
    });

    it("POST /api/auth returns 401 when user does not exist", async () => {
      const res = await request(API_BASE_URL).post("/api/auth").send({
        id: uniq("ghost"),
        password: "any",
      });
      expect(res.status).toBe(401);
    });

    it("protected endpoint without token returns 400", async () => {
      const res = await request(API_BASE_URL).get("/api/devices");
      expect(res.status).toBe(400);
    });

    it("protected endpoint with bad token returns 401", async () => {
      const res = await request(API_BASE_URL)
        .get("/api/devices")
        .set("Authorization", "Bearer not-a-real-token");
      expect(res.status).toBe(401);
    });
  });

  describe("Permissions API", () => {
    let permissionId;

    it("POST /api/permissions creates permission", async () => {
      const res = await auth(
        request(API_BASE_URL).post("/api/permissions")
      ).send({
        name: uniq("perm.test"),
        description: "Permission created by jest",
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.name).toBe(uniq("perm.test"));
      permissionId = res.body.id;
    });

    it("GET /api/permissions lists permissions", async () => {
      const res = await auth(request(API_BASE_URL).get("/api/permissions"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((p) => p.id === permissionId)).toBe(true);
    });

    describe("Roles API", () => {
      let roleId;
      let extraPermissionId;

      it("creates an additional permission for role tests", async () => {
        const res = await auth(
          request(API_BASE_URL).post("/api/permissions")
        ).send({
          name: uniq("perm.role.test"),
          description: null,
        });
        expect(res.status).toBe(201);
        extraPermissionId = res.body.id;
      });

      it("POST /api/roles creates role with permissions", async () => {
        const res = await auth(request(API_BASE_URL).post("/api/roles")).send({
          name: uniq("role.test"),
          description: "role created by jest",
          permission_ids: [permissionId],
        });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("id");
        expect(res.body.name).toBe(uniq("role.test"));
        roleId = res.body.id;
      });

      it("GET /api/roles lists roles with permissions", async () => {
        const res = await auth(request(API_BASE_URL).get("/api/roles"));
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((r) => r.id === roleId)).toBe(true);
      });

      it("PUT /api/roles/:id updates role", async () => {
        const res = await auth(
          request(API_BASE_URL).put(`/api/roles/${roleId}`)
        ).send({
          name: uniq("role.test.updated"),
          description: "updated",
          permission_ids: [permissionId],
        });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe(uniq("role.test.updated"));
      });

      it("POST /api/roles/:id/permissions grants permission", async () => {
        const res = await auth(
          request(API_BASE_URL).post(`/api/roles/${roleId}/permissions`)
        ).send({ permission_id: extraPermissionId });
        expect(res.status).toBe(201);
      });

      it("GET /api/roles/:id/permissions lists role permissions", async () => {
        const res = await auth(
          request(API_BASE_URL).get(`/api/roles/${roleId}/permissions`)
        );
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((p) => p.id === extraPermissionId)).toBe(true);
      });

      it("DELETE /api/roles/:id/permissions/:permission_id revokes permission", async () => {
        const res = await auth(
          request(API_BASE_URL).delete(
            `/api/roles/${roleId}/permissions/${extraPermissionId}`
          )
        );
        expect(res.status).toBe(204);
      });

      describe("User-role assignment", () => {
        let userId;

        beforeAll(async () => {
          const res = await request(API_BASE_URL)
            .post("/api/users")
            .send({
              username: uniq("rbac_user"),
              email: `${uniq("rbac_user")}@example.com`,
              password: "rbacpass",
            });
          expect(res.status).toBe(201);
          userId = res.body.id;
        });

        it("POST /api/users/:id/roles assigns role", async () => {
          const res = await auth(
            request(API_BASE_URL).post(`/api/users/${userId}/roles`)
          ).send({ role_id: roleId });
          expect(res.status).toBe(201);
        });

        it("GET /api/users/:id/roles lists user roles", async () => {
          const res = await auth(
            request(API_BASE_URL).get(`/api/users/${userId}/roles`)
          );
          expect(res.status).toBe(200);
          expect(res.body.some((r) => r.id === roleId)).toBe(true);
        });

        it("DELETE /api/users/:id/roles/:role_id removes role", async () => {
          const res = await auth(
            request(API_BASE_URL).delete(
              `/api/users/${userId}/roles/${roleId}`
            )
          );
          expect(res.status).toBe(204);
        });

        afterAll(async () => {
          if (userId) {
            await auth(
              request(API_BASE_URL).delete(`/api/users/${userId}`)
            );
          }
        });
      });

      afterAll(async () => {
        if (roleId) {
          await auth(request(API_BASE_URL).delete(`/api/roles/${roleId}`));
        }
      });
    });
  });

  describe("Users API", () => {
    let userId;
    const username = uniq("user");

    it("POST /api/users creates user (no auth required)", async () => {
      const res = await request(API_BASE_URL).post("/api/users").send({
        username,
        email: `${username}@example.com`,
        password: "secret123",
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.username).toBe(username);
      userId = res.body.id;
    });

    it("GET /api/users lists users", async () => {
      const res = await auth(request(API_BASE_URL).get("/api/users"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((u) => u.id === userId)).toBe(true);
    });

    it("GET /api/users/:id returns single user", async () => {
      const res = await auth(
        request(API_BASE_URL).get(`/api/users/${userId}`)
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(userId);
      expect(res.body.username).toBe(username);
    });

    it("PUT /api/users/:id updates user", async () => {
      const res = await auth(
        request(API_BASE_URL).put(`/api/users/${userId}`)
      ).send({
        username: uniq("user_renamed"),
        email: `${uniq("user_renamed")}@example.com`,
      });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(uniq("user_renamed"));
    });

    it("DELETE /api/users/:id deletes user", async () => {
      const res = await auth(
        request(API_BASE_URL).delete(`/api/users/${userId}`)
      );
      expect(res.status).toBe(204);
    });
  });

  describe("Devices API", () => {
    let newDeviceId;
    const deviceIdStr = uniq("dev");

    it("POST /api/devices creates device", async () => {
      const res = await auth(request(API_BASE_URL).post("/api/devices")).send({
        device_id: deviceIdStr,
        name: "Jest Test Device",
        manufacturer: "Jest",
        model: "Supertest v1",
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body.name).toBe("Jest Test Device");
      newDeviceId = res.body.id;
    });

    it("GET /api/devices lists devices", async () => {
      const res = await auth(request(API_BASE_URL).get("/api/devices"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it("GET /api/devices/id/:device_pk_id returns device with entities", async () => {
      const res = await auth(
        request(API_BASE_URL).get(`/api/devices/id/${newDeviceId}`)
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(newDeviceId);
      expect(Array.isArray(res.body.entities)).toBe(true);
    });

    it("PUT /api/devices/:id updates device", async () => {
      const res = await auth(
        request(API_BASE_URL).put(`/api/devices/${newDeviceId}`)
      ).send({
        device_id: deviceIdStr,
        name: "Updated Jest Device",
        manufacturer: "Jest",
        model: "Supertest v2",
      });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(newDeviceId);
      expect(res.body.name).toBe("Updated Jest Device");
    });

    it("DELETE /api/devices/:id deletes device", async () => {
      const res = await auth(
        request(API_BASE_URL).delete(`/api/devices/${newDeviceId}`)
      );
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Device deleted");
    });
  });

  describe("Device Tokens + Streams + States", () => {
    let deviceId;
    let deviceIdStr;
    let rawToken;

    beforeAll(async () => {
      deviceIdStr = uniq("token_dev");
      const create = await auth(
        request(API_BASE_URL).post("/api/devices")
      ).send({
        device_id: deviceIdStr,
        name: "token device",
      });
      expect(create.status).toBe(200);
      deviceId = create.body.id;
    });

    afterAll(async () => {
      if (deviceId) {
        await auth(request(API_BASE_URL).delete(`/api/devices/${deviceId}`));
      }
    });

    it("POST /api/devices/:id/token issues token", async () => {
      const res = await auth(
        request(API_BASE_URL).post(`/api/devices/${deviceId}/token`)
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(typeof res.body.token).toBe("string");
      rawToken = res.body.token;
    });

    it("GET /api/devices/:id/token returns token info", async () => {
      const res = await auth(
        request(API_BASE_URL).get(`/api/devices/${deviceId}/token`)
      );
      expect(res.status).toBe(200);
      expect(res.body).toBeDefined();
    });

    it("POST /api/streams/register registers a stream with device token", async () => {
      const res = await request(API_BASE_URL)
        .post("/api/streams/register")
        .set("Authorization", `Bearer ${rawToken}`)
        .set("X-Device-Id", deviceIdStr)
        .send({ topic: uniq("topic"), media_type: "video" });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("ssrc");
      expect(res.body).toHaveProperty("rtp_port");
    });

    it("POST /api/states/:topic accepts state update with device token", async () => {
      const res = await request(API_BASE_URL)
        .post(`/api/states/${uniq("any.topic")}`)
        .set("Authorization", `Bearer ${rawToken}`)
        .set("X-Device-Id", deviceIdStr)
        .send({ state: "on" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("true");
    });

    it("DELETE /api/devices/:id/token revokes token", async () => {
      const res = await auth(
        request(API_BASE_URL).delete(`/api/devices/${deviceId}/token`)
      );
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/revoked/i);
    });
  });

  describe("Entities API", () => {
    let entityPkId;
    const entityIdStr = uniq("entity");

    it("POST /api/entities creates entity", async () => {
      const res = await auth(
        request(API_BASE_URL).post("/api/entities")
      ).send({
        entity_id: entityIdStr,
        friendly_name: "Test Entity",
        platform: "jest",
        entity_type: "sensor",
        configuration: { unit: "C" },
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body.entity_id).toBe(entityIdStr);
      entityPkId = res.body.id;
    });

    it("GET /api/entities lists entities", async () => {
      const res = await auth(request(API_BASE_URL).get("/api/entities"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/entities supports entity_type filter", async () => {
      const res = await auth(
        request(API_BASE_URL)
          .get("/api/entities")
          .query({ entity_type: "sensor" })
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/entities/all returns entities with states", async () => {
      const res = await auth(request(API_BASE_URL).get("/api/entities/all"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/entities/:entity_id/history returns history list", async () => {
      const res = await auth(
        request(API_BASE_URL).get(`/api/entities/${entityIdStr}/history`)
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("PUT /api/entities/:id updates entity", async () => {
      const res = await auth(
        request(API_BASE_URL).put(`/api/entities/${entityPkId}`)
      ).send({
        entity_id: entityIdStr,
        friendly_name: "Renamed Entity",
        platform: "jest",
        entity_type: "sensor",
        configuration: {},
      });
      expect(res.status).toBe(200);
      expect(res.body.friendly_name).toBe("Renamed Entity");
    });

    it("DELETE /api/entities/:id deletes entity", async () => {
      const res = await auth(
        request(API_BASE_URL).delete(`/api/entities/${entityPkId}`)
      );
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Entity deleted");
    });
  });

  describe("Configurations API", () => {
    let configId;
    const key = uniq("cfg.key");

    it("POST /api/configurations creates configuration", async () => {
      const res = await auth(
        request(API_BASE_URL).post("/api/configurations")
      ).send({
        key,
        value: "v1",
        enabled: 1,
        description: "jest cfg",
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body.key).toBe(key);
      configId = res.body.id;
    });

    it("GET /api/configurations lists configurations", async () => {
      const res = await auth(
        request(API_BASE_URL).get("/api/configurations")
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((c) => c.id === configId)).toBe(true);
    });

    it("PUT /api/configurations/:id updates configuration", async () => {
      const res = await auth(
        request(API_BASE_URL).put(`/api/configurations/${configId}`)
      ).send({
        key,
        value: "v2",
        enabled: 0,
        description: "updated",
      });
      expect(res.status).toBe(200);
      expect(res.body.value).toBe("v2");
    });

    it("DELETE /api/configurations/:id deletes configuration", async () => {
      const res = await auth(
        request(API_BASE_URL).delete(`/api/configurations/${configId}`)
      );
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });
  });

  describe("Flows API", () => {
    let flowId;

    it("POST /api/flows creates flow", async () => {
      const res = await auth(request(API_BASE_URL).post("/api/flows")).send({
        name: uniq("flow"),
        description: "jest flow",
        enabled: 1,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      flowId = res.body.id;
    });

    it("GET /api/flows lists flows", async () => {
      const res = await auth(request(API_BASE_URL).get("/api/flows"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((f) => f.id === flowId)).toBe(true);
    });

    it("PUT /api/flows/:id updates flow", async () => {
      const res = await auth(
        request(API_BASE_URL).put(`/api/flows/${flowId}`)
      ).send({
        name: uniq("flow_renamed"),
        description: "updated",
        enabled: 0,
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/updated/i);
    });

    it("POST /api/flows/:id/versions creates flow version", async () => {
      const res = await auth(
        request(API_BASE_URL).post(`/api/flows/${flowId}/versions`)
      ).send({
        graph_json: JSON.stringify({ nodes: [], edges: [] }),
        comment: "initial",
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      expect(res.body.flow_id).toBe(flowId);
    });

    it("GET /api/flows/:id/versions lists versions", async () => {
      const res = await auth(
        request(API_BASE_URL).get(`/api/flows/${flowId}/versions`)
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it("DELETE /api/flows/:id deletes flow", async () => {
      const res = await auth(
        request(API_BASE_URL).delete(`/api/flows/${flowId}`)
      );
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });
  });

  describe("Stat API", () => {
    it("GET /api/stat returns counts", async () => {
      const res = await auth(request(API_BASE_URL).get("/api/stat"));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("count");
      expect(res.body.count).toHaveProperty("entities");
      expect(res.body.count).toHaveProperty("devices");
    });
  });

  describe("Tunnel API", () => {
    it("GET /api/tunnel/status returns tunnel status (no auth required)", async () => {
      const res = await request(API_BASE_URL).get("/api/tunnel/status");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("active");
      expect(typeof res.body.active).toBe("boolean");
    });

    it("POST /api/tunnel/stop is idempotent", async () => {
      const res = await request(API_BASE_URL).post("/api/tunnel/stop");
      expect([204, 502]).toContain(res.status);
    });

    it("POST /api/tunnel/start with bogus server returns 200 or 502", async () => {
      const res = await request(API_BASE_URL).post("/api/tunnel/start").send({
        server: "http://127.0.0.1:1",
        target: "http://127.0.0.1:1",
      });
      expect([200, 502]).toContain(res.status);
    });
  });

  describe("Logs API", () => {
    it("GET /api/logs lists log files", async () => {
      const res = await auth(request(API_BASE_URL).get("/api/logs"));
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body.files)).toBe(true);
      }
    });

    it("GET /api/logs/latest returns latest log or 404", async () => {
      const res = await auth(request(API_BASE_URL).get("/api/logs/latest"));
      expect([200, 404, 500]).toContain(res.status);
    });

    it("GET /api/logs/:filename returns 404 for missing file", async () => {
      const res = await auth(
        request(API_BASE_URL).get(`/api/logs/${uniq("nope")}.log`)
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Map API", () => {
    let layerId;
    let featureId;

    it("POST /api/map/layers creates layer", async () => {
      const res = await auth(
        request(API_BASE_URL).post("/api/map/layers")
      ).send({
        name: uniq("layer"),
        description: "Layer by jest",
        is_visible: true,
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      layerId = res.body.id;
    });

    it("GET /api/map/layers lists layers", async () => {
      const res = await auth(request(API_BASE_URL).get("/api/map/layers"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/map/layers/:id returns layer with empty features", async () => {
      const res = await auth(
        request(API_BASE_URL).get(`/api/map/layers/${layerId}`)
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(layerId);
      expect(res.body.features).toEqual([]);
    });

    it("PUT /api/map/layers/:id updates layer", async () => {
      const res = await auth(
        request(API_BASE_URL).put(`/api/map/layers/${layerId}`)
      ).send({
        name: uniq("layer_renamed"),
        description: "updated",
        is_visible: false,
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(uniq("layer_renamed"));
    });

    it("POST /api/map/features creates point feature", async () => {
      const res = await auth(
        request(API_BASE_URL).post("/api/map/features")
      ).send({
        layer_id: layerId,
        feature_type: "POINT",
        name: "Test Point",
        style_properties: JSON.stringify({ color: "red" }),
        vertices: [{ latitude: 36.635, longitude: 127.456 }],
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("id");
      featureId = res.body.id;
    });

    it("GET /api/map/features/:id returns feature with vertices", async () => {
      const res = await auth(
        request(API_BASE_URL).get(`/api/map/features/${featureId}`)
      );
      expect(res.status).toBe(200);
      expect(res.body.vertices.length).toBe(1);
      expect(res.body.vertices[0].latitude).toBeCloseTo(36.635, 3);
    });

    it("GET /api/map/layers/:id again includes new feature", async () => {
      const res = await auth(
        request(API_BASE_URL).get(`/api/map/layers/${layerId}`)
      );
      expect(res.status).toBe(200);
      expect(res.body.features.length).toBe(1);
    });

    it("PUT /api/map/features/:id updates feature", async () => {
      const res = await auth(
        request(API_BASE_URL).put(`/api/map/features/${featureId}`)
      ).send({
        name: "Updated Point",
        vertices: [{ latitude: 37.5665, longitude: 126.978 }],
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated Point");
    });

    it("DELETE /api/map/features/:id deletes feature", async () => {
      const res = await auth(
        request(API_BASE_URL).delete(`/api/map/features/${featureId}`)
      );
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Feature deleted");
    });

    it("DELETE /api/map/layers/:id deletes layer", async () => {
      const res = await auth(
        request(API_BASE_URL).delete(`/api/map/layers/${layerId}`)
      );
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Layer deleted");
    });
  });

  describe("Custom Nodes API", () => {
    const nodeType = uniq("node.type");

    it("POST /api/custom-nodes creates custom node", async () => {
      const res = await request(API_BASE_URL).post("/api/custom-nodes").send({
        node_type: nodeType,
        data: { foo: "bar" },
      });
      expect(res.status).toBe(201);
      expect(res.body.node_type).toBe(nodeType);
    });

    it("GET /api/custom-nodes lists nodes", async () => {
      const res = await request(API_BASE_URL).get("/api/custom-nodes");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/custom-nodes/:node_type returns node", async () => {
      const res = await request(API_BASE_URL).get(
        `/api/custom-nodes/${nodeType}`
      );
      expect(res.status).toBe(200);
      expect(res.body.node_type).toBe(nodeType);
    });

    it("PUT /api/custom-nodes/:node_type updates node", async () => {
      const res = await request(API_BASE_URL)
        .put(`/api/custom-nodes/${nodeType}`)
        .send({ data: { foo: "baz" } });
      expect(res.status).toBe(200);
    });

    it("DELETE /api/custom-nodes/:node_type deletes node", async () => {
      const res = await request(API_BASE_URL).delete(
        `/api/custom-nodes/${nodeType}`
      );
      expect(res.status).toBe(204);
    });
  });

  describe("Dynamic Dashboards API", () => {
    let dashboardId;

    it("POST /api/dynamic-dashboards creates dashboard", async () => {
      const res = await request(API_BASE_URL)
        .post("/api/dynamic-dashboards")
        .send({
          name: uniq("dashboard"),
          layout: { widgets: [] },
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      dashboardId = res.body.id;
    });

    it("GET /api/dynamic-dashboards lists dashboards", async () => {
      const res = await request(API_BASE_URL).get("/api/dynamic-dashboards");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/dynamic-dashboards/:id returns dashboard", async () => {
      const res = await request(API_BASE_URL).get(
        `/api/dynamic-dashboards/${dashboardId}`
      );
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(dashboardId);
    });

    it("PUT /api/dynamic-dashboards/:id updates dashboard", async () => {
      const res = await request(API_BASE_URL)
        .put(`/api/dynamic-dashboards/${dashboardId}`)
        .send({
          name: uniq("dashboard_renamed"),
          layout: { widgets: [{ id: "w1" }] },
        });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe(uniq("dashboard_renamed"));
    });

    it("DELETE /api/dynamic-dashboards/:id deletes dashboard", async () => {
      const res = await request(API_BASE_URL).delete(
        `/api/dynamic-dashboards/${dashboardId}`
      );
      expect(res.status).toBe(204);
    });

    it("GET /api/dynamic-dashboards/:id returns 404 for missing", async () => {
      const res = await request(API_BASE_URL).get(
        `/api/dynamic-dashboards/${uniq("missing")}`
      );
      expect(res.status).toBe(404);
    });
  });

  describe("Integrations API", () => {
    afterAll(async () => {
      for (const id of ["home_assistant", "ros2", "sdr"]) {
        await auth(
          request(API_BASE_URL).delete(`/api/integrations/${id}`)
        );
      }
    });

    it("POST /api/integrations/register registers ros2", async () => {
      const res = await auth(
        request(API_BASE_URL).post("/api/integrations/register")
      ).send({
        integration_id: "ros2",
        config: { websocket_url: "ws://127.0.0.1:9090" },
      });
      expect(res.status).toBe(200);
      expect(res.body.integration_id).toBe("ros2");
    });

    it("POST /api/integrations/register registers home_assistant", async () => {
      const res = await auth(
        request(API_BASE_URL).post("/api/integrations/register")
      ).send({
        integration_id: "home_assistant",
        config: {
          url: "http://127.0.0.1:8123",
          token: "fake-token",
        },
      });
      expect(res.status).toBe(200);
      expect(res.body.integration_id).toBe("home_assistant");
    });

    it("POST /api/integrations/register registers sdr", async () => {
      const res = await auth(
        request(API_BASE_URL).post("/api/integrations/register")
      ).send({
        integration_id: "sdr",
        config: { host: "127.0.0.1", port: "1234" },
      });
      expect(res.status).toBe(200);
      expect(res.body.integration_id).toBe("sdr");
    });

    it("GET /api/integrations/status returns connected flags", async () => {
      const res = await auth(
        request(API_BASE_URL).get("/api/integrations/status")
      );
      expect(res.status).toBe(200);
      expect(res.body.home_assistant.connected).toBe(true);
      expect(res.body.ros2.connected).toBe(true);
      expect(res.body.sdr.connected).toBe(true);
    });

    it("POST /api/integrations/register rejects unknown id", async () => {
      const res = await auth(
        request(API_BASE_URL).post("/api/integrations/register")
      ).send({ integration_id: "unknown_xyz", config: {} });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    describe("HA proxy endpoints (HA at fake URL)", () => {
      it("GET /api/ha/states fails because HA is unreachable", async () => {
        const res = await auth(request(API_BASE_URL).get("/api/ha/states"));
        expect(res.status).toBeGreaterThanOrEqual(400);
      });

      it("POST /api/ha/states/:entity_id fails because HA is unreachable", async () => {
        const res = await auth(
          request(API_BASE_URL).post("/api/ha/states/light.test")
        ).send({ state: "on", attributes: {} });
        expect(res.status).toBeGreaterThanOrEqual(400);
      });
    });

    describe("SDR REST endpoints", () => {
      it("GET /api/sdr/samplerate returns default samplerate", async () => {
        const res = await auth(
          request(API_BASE_URL).get("/api/sdr/samplerate")
        );
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("samplerate");
      });

      it("POST /api/sdr/start returns streaming acknowledgement", async () => {
        const res = await auth(request(API_BASE_URL).post("/api/sdr/start"));
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("streaming");
      });

      it("POST /api/sdr/stop returns stopped", async () => {
        const res = await auth(request(API_BASE_URL).post("/api/sdr/stop"));
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("stopped");
      });

      it("POST /api/sdr/frequency fails with stub host", async () => {
        const res = await auth(
          request(API_BASE_URL).post("/api/sdr/frequency")
        ).send({ frequency: 100000000 });
        expect(res.status).toBeGreaterThanOrEqual(400);
      });
    });

    it("DELETE /api/integrations/:id removes ros2 integration", async () => {
      const res = await auth(
        request(API_BASE_URL).delete("/api/integrations/ros2")
      );
      expect(res.status).toBe(200);
    });

    it("DELETE /api/integrations/:id rejects unknown id", async () => {
      const res = await auth(
        request(API_BASE_URL).delete("/api/integrations/unknown_xyz")
      );
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("Storage API", () => {
    const dirPath = uniq("jest_dir");
    const filePath = `${dirPath}/hello.txt`;
    let codeServiceEnabled = true;

    it("PUT /api/storage/:path creates file (or 403 if disabled)", async () => {
      const res = await auth(
        request(API_BASE_URL).put(`/api/storage/${filePath}`)
      ).send({ content: "hello world" });
      if (res.status === 403) {
        codeServiceEnabled = false;
        expect(res.body.error).toMatch(/disabled/i);
        return;
      }
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/file/i);
    });

    it("GET /api/storage/:path reads file content", async () => {
      if (!codeServiceEnabled) return;
      const res = await auth(
        request(API_BASE_URL).get(`/api/storage/${filePath}`)
      );
      expect(res.status).toBe(200);
      expect(res.text).toBe("hello world");
    });

    it("GET /api/storage/ lists root directory", async () => {
      if (!codeServiceEnabled) return;
      const res = await auth(request(API_BASE_URL).get("/api/storage/"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.entries)).toBe(true);
    });

    it("POST /api/storage/mkdir/:path creates directory", async () => {
      if (!codeServiceEnabled) return;
      const res = await auth(
        request(API_BASE_URL).post(`/api/storage/mkdir/${dirPath}/sub`)
      );
      expect(res.status).toBe(201);
    });

    it("POST /api/storage/rename/:from renames file", async () => {
      if (!codeServiceEnabled) return;
      const res = await auth(
        request(API_BASE_URL).post(`/api/storage/rename/${filePath}`)
      ).send({ to: `${dirPath}/hello_renamed.txt` });
      expect(res.status).toBe(200);
    });

    it("DELETE /api/storage/:path deletes path", async () => {
      if (!codeServiceEnabled) return;
      const res = await auth(
        request(API_BASE_URL).delete(`/api/storage/${dirPath}`)
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Recordings API", () => {
    it("GET /api/recordings lists recordings", async () => {
      const res = await auth(request(API_BASE_URL).get("/api/recordings"));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/recordings supports topic filter", async () => {
      const res = await auth(
        request(API_BASE_URL)
          .get("/api/recordings")
          .query({ topic: uniq("nope") })
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/recordings/active lists active recordings", async () => {
      const res = await auth(
        request(API_BASE_URL).get("/api/recordings/active")
      );
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("GET /api/recordings/active/:topic reports recording state", async () => {
      const res = await auth(
        request(API_BASE_URL).get(
          `/api/recordings/active/${uniq("topic")}`
        )
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("is_recording");
      expect(res.body.is_recording).toBe(false);
    });

    it("POST /api/recordings without active stream returns 201 or 400", async () => {
      const res = await auth(
        request(API_BASE_URL).post("/api/recordings")
      ).send({ topic: uniq("ghost.topic") });
      expect([201, 400]).toContain(res.status);
    });

    it("GET /api/recordings/:id returns 404 for missing id", async () => {
      const res = await auth(
        request(API_BASE_URL).get("/api/recordings/999999999")
      );
      expect(res.status).toBe(404);
    });

    it("POST /api/recordings/:id/stop returns 400 for missing id", async () => {
      const res = await auth(
        request(API_BASE_URL).post("/api/recordings/999999999/stop")
      );
      expect(res.status).toBe(400);
    });

    it("DELETE /api/recordings/:id returns 404 for missing id", async () => {
      const res = await auth(
        request(API_BASE_URL).delete("/api/recordings/999999999")
      );
      expect(res.status).toBe(404);
    });

    it("GET /api/recordings/:id/stream returns 404 for missing id", async () => {
      const res = await auth(
        request(API_BASE_URL).get("/api/recordings/999999999/stream")
      );
      expect(res.status).toBe(404);
    });
  });
});
