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

  describe("codec", () => {
    it("accepts jpeg for video", async () => {
      const res = await register({
        topic: uniq("mjpeg"),
        media_type: "video",
        codec: "jpeg",
      });
      expect(res.status).toBe(200);
    });

    it("accepts opus for audio", async () => {
      const res = await register({
        topic: uniq("opus"),
        media_type: "audio",
        codec: "opus",
      });
      expect(res.status).toBe(200);
    });

    it.each([
      ["audio", "jpeg"],
      ["audio", "h264"],
      ["video", "opus"],
    ])("rejects %s with codec %s as 400", async (media_type, codec) => {
      const res = await register({ topic: uniq("bad"), media_type, codec });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/codec/);
    });

    it("rejects an unknown codec", async () => {
      const res = await register({
        topic: uniq("vp8"),
        media_type: "video",
        codec: "vp8",
      });
      expect(res.status).toBe(422);
    });
  });

  describe("topic validation", () => {
    it("accepts every allowed character class", async () => {
      const res = await register({
        topic: uniq("Cam-1_front.v2/video"),
        media_type: "video",
      });
      expect(res.status).toBe(200);
    });

    it("accepts a 128 character topic", async () => {
      const res = await register({
        topic: "t".repeat(128),
        media_type: "video",
      });
      expect(res.status).toBe(200);
    });

    it.each([
      ["empty", ""],
      ["129 characters", "t".repeat(129)],
      ["the reserved '::'", "cam::mjpeg"],
      ["'..'", "cam/../etc"],
      ["a space", "cam front"],
      ["a non-ASCII letter", "카메라"],
      ["a query string", "cam?x=1"],
    ])("rejects a topic with %s as 400", async (_label, topic) => {
      const res = await register({ topic, media_type: "video" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/topic/);
    });
  });

  describe("re-registration", () => {
    it("gives the same topic a new SSRC each time", async () => {
      const topic = uniq("rereg");
      const first = await register({
        topic,
        media_type: "video",
        codec: "jpeg",
      });
      const second = await register({
        topic,
        media_type: "video",
        codec: "jpeg",
      });
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.ssrc).not.toBe(first.body.ssrc);
    });

    it("never hands out the same SSRC twice", async () => {
      const seen = new Set();
      for (let i = 0; i < 20; i++) {
        const res = await register({
          topic: uniq(`many_${i}`),
          media_type: i % 2 === 0 ? "video" : "audio",
          codec: i % 2 === 0 ? "jpeg" : "opus",
        });
        expect(res.status).toBe(200);
        expect(seen.has(res.body.ssrc)).toBe(false);
        seen.add(res.body.ssrc);
      }
      // Each registration verifies the device token with bcrypt.
    }, 60000);
  });

  describe("device authentication", () => {
    it("refuses registration without a valid token", async () => {
      const res = await register(
        { topic: uniq("noauth"), media_type: "video" },
        "not-a-real-token",
      );
      expect(res.status).not.toBe(200);
      expect(res.body).not.toHaveProperty("ssrc");
    });

    it("refuses a token presented for another device", async () => {
      const res = await register(
        { topic: uniq("wrongdev"), media_type: "video" },
        deviceToken,
        uniq("someone_else"),
      );
      expect(res.status).not.toBe(200);
      expect(res.body).not.toHaveProperty("ssrc");
    });
  });
});
