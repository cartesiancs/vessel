// Headless-Chrome WebRTC viewer that speaks the Vessel signaling protocol the way the client does
// (apps/client/src/features/rtc/lib/rtc.ts): recvonly transceivers, one offer, subscribe_stream
// per topic, server-initiated renegotiation, messages applied one at a time. It records events and
// per-second inbound-rtp stats so tests can assert on what a viewer actually receives.
const fs = require("fs");

const DEFAULT_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function findChrome() {
  if (process.env.VESSEL_CHROME_PATH) return process.env.VESSEL_CHROME_PATH;
  return DEFAULT_CHROME_PATHS.find((p) => fs.existsSync(p)) || null;
}

function pageViewer({ wsUrl, topics }) {
  window.__events = [];
  window.__samples = [];
  const log = (ev, data = {}) =>
    window.__events.push({ t: Date.now(), ev, ...data });
  const ws = new WebSocket(wsUrl);
  const pc = new RTCPeerConnection({ iceServers: [] });
  for (let i = 0; i < 2; i++)
    pc.addTransceiver("audio", { direction: "recvonly" });
  for (let i = 0; i < 4; i++)
    pc.addTransceiver("video", { direction: "recvonly" });
  const pending = [];
  const trackTopic = {};
  const queue = [];
  let chain = Promise.resolve();
  const send = (type, payload) =>
    ws.readyState === 1 && ws.send(JSON.stringify({ type, payload }));

  pc.ontrack = (e) => {
    const p = pending.shift();
    if (!p) return;
    trackTopic[e.track.id] = p.topic;
    log("track", { topic: p.topic, kind: e.track.kind });
    const el = document.createElement(e.track.kind);
    el.srcObject = new MediaStream([e.track]);
    el.muted = true;
    el.autoplay = true;
    document.body.appendChild(el);
  };
  pc.onicecandidate = (e) =>
    e.candidate && send("candidate", e.candidate.toJSON());
  pc.onconnectionstatechange = () =>
    log("pc_state", { state: pc.connectionState });

  let subscribed = false;
  const apply = async (msg) => {
    try {
      if (msg.type === "answer") {
        await pc.setRemoteDescription(msg.payload);
        while (queue.length) await pc.addIceCandidate(queue.shift());
        if (!subscribed) {
          subscribed = true;
          for (const t of topics) {
            pending.push(t);
            send("subscribe_stream", { topic: t.topic });
          }
        }
      } else if (msg.type === "offer") {
        await pc.setRemoteDescription(msg.payload);
        await pc.setLocalDescription(await pc.createAnswer());
        send("answer", pc.localDescription);
        while (queue.length) await pc.addIceCandidate(queue.shift());
        log("renegotiated");
      } else if (msg.type === "candidate" && msg.payload) {
        if (pc.remoteDescription) await pc.addIceCandidate(msg.payload);
        else queue.push(msg.payload);
      }
    } catch (err) {
      log("signal_error", { message: String(err) });
    }
  };
  ws.onopen = async () => {
    log("ws_open");
    await pc.setLocalDescription(await pc.createOffer());
    send("offer", pc.localDescription);
  };
  ws.onclose = (e) => log("ws_close", { code: e.code });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    chain = chain.then(() => apply(msg));
  };

  window.__close = () => ws.close();
  setInterval(async () => {
    const stats = await pc.getStats();
    const media = {};
    stats.forEach((r) => {
      if (r.type !== "inbound-rtp") return;
      const topic = trackTopic[r.trackIdentifier];
      if (topic) {
        media[topic] = {
          packets: r.packetsReceived || 0,
          frames: r.framesDecoded,
        };
      }
    });
    window.__samples.push({
      t: Date.now(),
      ws: ws.readyState,
      pc: pc.connectionState,
      media,
    });
  }, 1000);
}

/**
 * Opens a viewer subscribed to `topics` ([{ topic, kind }]). Returns helpers to read what it
 * received; call close() when done.
 */
async function openViewer({ apiUrl, token, topics }) {
  const { chromium } = require("playwright-core");
  const executablePath = findChrome();
  if (!executablePath)
    throw new Error("No Chrome/Chromium found; set VESSEL_CHROME_PATH");
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  await page.goto(`${apiUrl}/info`);
  const wsUrl = `${apiUrl.replace(/^http/, "ws")}/signal?token=${token}`;
  await page.evaluate(pageViewer, { wsUrl, topics });

  const events = [];
  const samples = [];
  const drain = async () => {
    const batch = await page.evaluate(() => ({
      events: window.__events.splice(0),
      samples: window.__samples.splice(0),
    }));
    events.push(...batch.events);
    samples.push(...batch.samples);
  };

  /** Media counter (frames for video, packets for audio) for `topic` in the latest sample. */
  const counter = async (topic) => {
    await drain();
    for (let i = samples.length - 1; i >= 0; i--) {
      const m = samples[i].media[topic];
      if (m) return m.frames !== undefined ? m.frames : m.packets;
    }
    return 0;
  };

  /** Resolves with how many units arrived for `topic` during the next `ms` milliseconds. */
  const receivedDuring = async (topic, ms) => {
    const before = await counter(topic);
    await new Promise((r) => setTimeout(r, ms));
    return (await counter(topic)) - before;
  };

  /** Waits until `topic` advances by `units` within `timeoutMs`; returns the time it took. */
  const waitForDelivery = async (topic, units, timeoutMs) => {
    const start = Date.now();
    const base = await counter(topic);
    while (Date.now() - start < timeoutMs) {
      if ((await counter(topic)) - base >= units) return Date.now() - start;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`no delivery on ${topic} within ${timeoutMs} ms`);
  };

  return {
    events: async () => {
      await drain();
      return events;
    },
    samples: async () => {
      await drain();
      return samples;
    },
    counter,
    receivedDuring,
    waitForDelivery,
    closeSignaling: () => page.evaluate(() => window.__close()),
    close: () => browser.close(),
  };
}

module.exports = { openViewer, findChrome };
