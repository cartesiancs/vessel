#!/usr/bin/env node
// Long-running WebRTC soak: watches live topics in headless Chrome and prints per-minute delivery,
// flagging any second in which a topic received nothing.
//   node tests/soak/webrtc-soak.js <minutes> <topic:kind>... [--out samples.jsonl]
// Uses VESSEL_API_URL and VESSEL_ADMIN_PASSWORD like the E2E suites.
const fs = require("fs");
const { openViewer } = require("../support/webrtcViewer");

const API_BASE_URL = process.env.VESSEL_API_URL || "http://localhost:6174";
const ADMIN_PASSWORD = process.env.VESSEL_ADMIN_PASSWORD || "admin1";
const POLL_MS = 2000;
const REPORT_MS = 60_000;

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outPath = outIndex >= 0 ? args.splice(outIndex, 2)[1] : null;
  const minutes = Number(args.shift());
  const topics = args.map((arg) => {
    const i = arg.lastIndexOf(":");
    return { topic: arg.slice(0, i), kind: arg.slice(i + 1) };
  });
  if (!(minutes > 0) || topics.length === 0) {
    console.error(
      "usage: webrtc-soak.js <minutes> <topic:kind>... [--out file.jsonl]",
    );
    process.exit(2);
  }

  const login = await fetch(`${API_BASE_URL}/api/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "admin", password: ADMIN_PASSWORD }),
  });
  const { token } = await login.json();
  const viewer = await openViewer({ apiUrl: API_BASE_URL, token, topics });
  const out = outPath ? fs.createWriteStream(outPath) : null;

  const start = Date.now();
  const last = new Map();
  const stalls = new Map(topics.map((t) => [t.topic, 0]));
  let seen = 0;
  let nextReport = start + REPORT_MS;
  while (Date.now() - start < minutes * 60_000) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    const samples = await viewer.samples();
    for (const sample of samples.slice(seen)) {
      out?.write(`${JSON.stringify(sample)}\n`);
      for (const { topic } of topics) {
        const m = sample.media[topic];
        const value = m ? (m.frames !== undefined ? m.frames : m.packets) : 0;
        if (last.has(topic) && value === last.get(topic)) {
          stalls.set(topic, stalls.get(topic) + 1);
        }
        last.set(topic, value);
      }
    }
    seen = samples.length;
    if (Date.now() >= nextReport) {
      nextReport += REPORT_MS;
      const s = samples[samples.length - 1];
      const parts = topics.map(
        ({ topic }) =>
          `${topic}=${last.get(topic)} (stalled ${stalls.get(topic)}s)`,
      );
      console.log(
        `${((Date.now() - start) / 60_000).toFixed(1)} min ws=${s.ws} pc=${s.pc} ${parts.join(" | ")}`,
      );
    }
  }
  const events = (await viewer.events()).filter((e) => e.ev !== "renegotiated");
  console.log(
    "events:",
    events.map((e) => `${e.ev}${e.state ? `=${e.state}` : ""}`).join(", "),
  );
  await viewer.close();
  out?.end();
  const stalled = [...stalls.values()].some((n) => n > 0);
  process.exit(stalled ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
