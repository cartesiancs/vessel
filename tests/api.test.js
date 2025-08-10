const request = require("supertest");

const API_BASE_URL = "http://localhost:8080";

describe("Vessel API E2E Test", () => {
  let authToken;
  let newDeviceId;
  let newEntityId;

  beforeAll(async () => {
    const response = await request(API_BASE_URL).post("/auth").send({
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

  describe("Entities API", () => {
    it("should create a new entity for the device", async () => {
      const response = await request(API_BASE_URL)
        .post("/api/entities")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          entity_id: "sensor.jest_test_temperature",
          device_id: newDeviceId,
          friendly_name: "Jest 온도 센서",
          platform: "jest",
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("id");
      expect(response.body.entity_id).toBe("sensor.jest_test_temperature");
      newEntityId = response.body.id;
    });
  });
});
