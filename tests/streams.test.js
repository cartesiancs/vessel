const request = require("supertest");

const API_BASE_URL = process.env.VESSEL_API_URL || "http://localhost:6174";
const ADMIN_PASSWORD = process.env.VESSEL_ADMIN_PASSWORD || "admin1";
const RUN_ID = Date.now();
const uniq = (s) => `${s}_${RUN_ID}`;

const MAX_SSRC = 2 ** 31 - 1;
const MAX_PORT = 65535;

describe("Stream registration E2E", () => {
  let authToken;
  let devicePk;
  let deviceIdStr;
  let deviceToken;

  const auth = (req) => req.set("Authorization", `Bearer ${authToken}`);
  const register = (body, token = deviceToken, deviceId = deviceIdStr) =>
    request(API_BASE_URL)
      .post("/api/streams/register")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Device-Id", deviceId)
      .send(body);

  beforeAll(async () => {
    const login = await request(API_BASE_URL)
      .post("/api/auth")
      .send({ id: "admin", password: ADMIN_PASSWORD });
    expect(login.status).toBe(200);
    authToken = login.body.token;

    deviceIdStr = uniq("stream_dev");
    const device = await auth(request(API_BASE_URL).post("/api/devices")).send({
      device_id: deviceIdStr,
      name: "stream e2e device",
    });
    expect(device.status).toBe(200);
    devicePk = device.body.id;

    const token = await auth(
      request(API_BASE_URL).post(`/api/devices/${devicePk}/token`),
    );
    expect(token.status).toBe(200);
    deviceToken = token.body.token;
  });

  afterAll(async () => {
    if (devicePk) {
      await auth(request(API_BASE_URL).delete(`/api/devices/${devicePk}`));
    }
  });

  describe("contract", () => {
    it("defaults to h264 when codec is omitted", async () => {
      const res = await register({
        topic: uniq("legacy"),
        media_type: "video",
      });
      expect(res.status).toBe(200);
      expect(Number.isInteger(res.body.ssrc)).toBe(true);
      expect(res.body.ssrc).toBeGreaterThanOrEqual(0);
      expect(res.body.ssrc).toBeLessThanOrEqual(MAX_SSRC);
    });

    it("returns the configured RTP port, not a hard-coded 5004", async () => {
      const res = await register({ topic: uniq("port"), media_type: "video" });
      expect(res.status).toBe(200);
      expect(Number.isInteger(res.body.rtp_port)).toBe(true);
      expect(res.body.rtp_port).toBeGreaterThanOrEqual(1);
      expect(res.body.rtp_port).toBeLessThanOrEqual(MAX_PORT);
      if (process.env.VESSEL_RTP_PORT) {
        expect(res.body.rtp_port).toBe(Number(process.env.VESSEL_RTP_PORT));
      }
    });
  });
});
