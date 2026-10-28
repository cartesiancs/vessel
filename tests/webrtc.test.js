// WebRTC viewer E2E: a headless Chrome viewer watches a simulated camera (MJPEG video transcoded
// to H.264, plus Opus audio) while the camera re-registers and goes silent, the two situations
// that used to freeze every viewer until a page reload. Needs a running server with RTP enabled
// (VESSEL_RTP_PORT), gst-launch-1.0 and Chrome/Chromium (VESSEL_CHROME_PATH to override).
const request = require("supertest");
const { openViewer, findChrome } = require("./support/webrtcViewer");
const {
  HAS_GST,
  RTP_PORT,
  VIDEO_FPS,
  AUDIO_PACKETS_PER_SECOND,
  startMjpeg,
  startOpus,
} = require("./support/rtpSender");

const API_BASE_URL = process.env.VESSEL_API_URL || "http://localhost:6174";
const ADMIN_PASSWORD = process.env.VESSEL_ADMIN_PASSWORD || "admin1";
const SOAK_SECONDS = Number(process.env.VESSEL_WEBRTC_SOAK_SECONDS || 20);
const RUN_ID = Date.now();
const uniq = (s) => `${s}_${RUN_ID}`;

const canRun = HAS_GST && RTP_PORT > 0 && findChrome() !== null;
const describeWebRTC = canRun ? describe : describe.skip;

// The server drops a stream after 10 s without packets.
const STREAM_IDLE_TIMEOUT_MS = 10_000;
const SOAK_WINDOW_MS = 5_000;
// How long a viewer may wait for media to come back after the camera returns: transcoder start
// plus one keyframe interval (x264 key-int 30 at 15 fps = 2 s), with margin.
const RECOVERY_TIMEOUT_MS = 15_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describeWebRTC("WebRTC viewer E2E", () => {
  const videoTopic = uniq("webrtc_cam/video");
  const audioTopic = uniq("webrtc_cam/audio");
  let authToken;
  let devicePk;
  let deviceIdStr;
  let deviceToken;
  let video;
  let audio;
  let viewer;

  // The SSRC the server has on record per topic: what a camera keeps sending on through an
  // outage, as long as it does not register again.
  const lastRegistered = new Map();

  const auth = (req) => req.set("Authorization", `Bearer ${authToken}`);
  const register = async (topic, media_type, codec) => {
    const res = await request(API_BASE_URL)
      .post("/api/streams/register")
      .set("Authorization", `Bearer ${deviceToken}`)
      .set("X-Device-Id", deviceIdStr)
      .send({ topic, media_type, codec });
    expect(res.status).toBe(200);
    lastRegistered.set(topic, res.body.ssrc);
    return res.body.ssrc;
  };

  beforeAll(async () => {
    const login = await request(API_BASE_URL)
      .post("/api/auth")
      .send({ id: "admin", password: ADMIN_PASSWORD });
    expect(login.status).toBe(200);
    authToken = login.body.token;

    deviceIdStr = uniq("webrtc_dev");
    const device = await auth(request(API_BASE_URL).post("/api/devices")).send({
      device_id: deviceIdStr,
      name: "webrtc e2e camera",
    });
    expect(device.status).toBe(200);
    devicePk = device.body.id;
    const token = await auth(
      request(API_BASE_URL).post(`/api/devices/${devicePk}/token`),
    );
    deviceToken = token.body.token;

    video = startMjpeg(await register(videoTopic, "video", "jpeg"));
    audio = startOpus(await register(audioTopic, "audio", "opus"));
    // Let the transcoder publish its H.264 output before the viewer subscribes.
    await sleep(2000);

    viewer = await openViewer({
      apiUrl: API_BASE_URL,
      token: authToken,
      topics: [
        { topic: videoTopic, kind: "video" },
        { topic: audioTopic, kind: "audio" },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    if (viewer) await viewer.close();
    video?.stop();
    audio?.stop();
    if (devicePk) {
      await auth(request(API_BASE_URL).delete(`/api/devices/${devicePk}`));
    }
  });

  it("delivers video and audio, renegotiating both subscriptions cleanly", async () => {
    await viewer.waitForDelivery(videoTopic, VIDEO_FPS, RECOVERY_TIMEOUT_MS);
    await viewer.waitForDelivery(
      audioTopic,
      AUDIO_PACKETS_PER_SECOND,
      RECOVERY_TIMEOUT_MS,
    );
    const events = await viewer.events();
    expect(events.filter((e) => e.ev === "track")).toHaveLength(2);
    expect(events.filter((e) => e.ev === "signal_error")).toEqual([]);
  }, 40_000);

  it(
    `keeps delivering without stalls for ${SOAK_SECONDS} s`,
    async () => {
      const windows = Math.max(
        1,
        Math.round((SOAK_SECONDS * 1000) / SOAK_WINDOW_MS),
      );
      for (let i = 0; i < windows; i++) {
        const [frames, packets] = await Promise.all([
          viewer.receivedDuring(videoTopic, SOAK_WINDOW_MS),
          viewer.receivedDuring(audioTopic, SOAK_WINDOW_MS),
        ]);
        // At least half the nominal rate in every window: 15 fps video, 50 packets/s audio.
        expect(frames).toBeGreaterThanOrEqual(
          (VIDEO_FPS * SOAK_WINDOW_MS) / 2000,
        );
        expect(packets).toBeGreaterThanOrEqual(
          (AUDIO_PACKETS_PER_SECOND * SOAK_WINDOW_MS) / 2000,
        );
      }
      const samples = await viewer.samples();
      expect(samples.every((s) => s.ws === 1 && s.pc === "connected")).toBe(
        true,
      );
    },
    SOAK_SECONDS * 1000 + 30_000,
  );

  it("resumes on the same connection after the camera re-registers with a new SSRC", async () => {
    // What a camera does after a Wi-Fi reconnect: register again, then send on the new SSRC.
    video.stop();
    audio.stop();
    video = startMjpeg(await register(videoTopic, "video", "jpeg"));
    audio = startOpus(await register(audioTopic, "audio", "opus"));

    await viewer.waitForDelivery(videoTopic, VIDEO_FPS, RECOVERY_TIMEOUT_MS);
    await viewer.waitForDelivery(
      audioTopic,
      AUDIO_PACKETS_PER_SECOND,
      RECOVERY_TIMEOUT_MS,
    );
  }, 60_000);

  it("resumes after the stream timed out and the camera kept its SSRC", async () => {
    video.stop();
    audio.stop();
    // Long enough for the server to drop both streams from memory.
    await sleep(STREAM_IDLE_TIMEOUT_MS + 3000);
    expect(await viewer.receivedDuring(videoTopic, 1000)).toBe(0);

    // Same SSRCs: the server must rehydrate them from the database.
    video = startMjpeg(lastRegistered.get(videoTopic));
    audio = startOpus(lastRegistered.get(audioTopic));

    await viewer.waitForDelivery(videoTopic, VIDEO_FPS, RECOVERY_TIMEOUT_MS);
    await viewer.waitForDelivery(
      audioTopic,
      AUDIO_PACKETS_PER_SECOND,
      RECOVERY_TIMEOUT_MS,
    );
  }, 60_000);
});
