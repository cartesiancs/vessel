const request = require("supertest");

const API_BASE_URL = "http://localhost:8080";

describe("Vessel API E2E Test", () => {
  let authToken;
  let newDeviceId;
  let newEntityId;
  let newLayerId;
  let newFeatureId;

  beforeAll(async () => {
    const response = await request(API_BASE_URL).post("/api/auth").send({
      id: "admin",
      password: "admin",
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("token");
    authToken = response.body.token;
  });

  describe("Devices API", () => {
    it("should create a new device successfully", async () => {
      const response = await request(API_BASE_URL)
        .post("/api/devices")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          device_id: "jest_test_device_01",
          name: "Jest Test Device",
          manufacturer: "Jest",
          model: "Supertest v1",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id");
      expect(response.body.name).toBe("Jest Test Device");

      newDeviceId = response.body.id;
    });

    it("should get a list of all devices", async () => {
      const response = await request(API_BASE_URL)
        .get("/api/devices")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it("should update an existing device", async () => {
      const response = await request(API_BASE_URL)
        .put(`/api/devices/${newDeviceId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          device_id: "jest_test_device_01_updated",
          name: "Updated Jest Device",
          manufacturer: "Jest",
          model: "Supertest v2",
        });

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(newDeviceId);
      expect(response.body.name).toBe("Updated Jest Device");
    });

    it("should delete the created device", async () => {
      const response = await request(API_BASE_URL)
        .delete(`/api/devices/${newDeviceId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Device deleted");
    });
  });

  describe("Map API", () => {
    it("should create a new map layer", async () => {
      const response = await request(API_BASE_URL)
        .post("/api/map/layers")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Test Layer",
          description: "A layer created by Jest",
          is_visible: true,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id");
      expect(response.body.name).toBe("Test Layer");
      newLayerId = response.body.id;
    });

    it("should get a list of all map layers", async () => {
      const response = await request(API_BASE_URL)
        .get("/api/map/layers")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it("should get a specific map layer by ID", async () => {
      const response = await request(API_BASE_URL)
        .get(`/api/map/layers/${newLayerId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(newLayerId);
      expect(response.body.features).toEqual([]);
    });

    it("should create a new point feature in the layer", async () => {
      const response = await request(API_BASE_URL)
        .post("/api/map/features")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          layer_id: newLayerId,
          feature_type: "POINT",
          name: "Test Point 1",
          style_properties: JSON.stringify({ color: "red" }),
          vertices: [{ latitude: 36.635, longitude: 127.456 }],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id");
      expect(response.body.name).toBe("Test Point 1");
      expect(response.body.feature_type).toBe("POINT");
      newFeatureId = response.body.id;
    });

    it("should get the layer again with the new feature", async () => {
      const response = await request(API_BASE_URL)
        .get(`/api/map/layers/${newLayerId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.features.length).toBe(1);
    });

    it("should get a specific feature by ID", async () => {
      const response = await request(API_BASE_URL)
        .get(`/api/map/features/${newFeatureId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.vertices.length).toBe(1);
      expect(response.body.vertices[0].latitude).toBe(36.635);
    });

    it("should update an existing feature", async () => {
      const response = await request(API_BASE_URL)
        .put(`/api/map/features/${newFeatureId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Updated Test Point",
          vertices: [{ latitude: 37.5665, longitude: 126.978 }],
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe("Updated Test Point");
    });

    it("should delete the created feature", async () => {
      const response = await request(API_BASE_URL)
        .delete(`/api/map/features/${newFeatureId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Feature deleted");
    });

    it("should delete the created layer", async () => {
      const response = await request(API_BASE_URL)
        .delete(`/api/map/layers/${newLayerId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Layer deleted");
    });
  });
});
