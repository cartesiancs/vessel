// Simulated cameras: push RTP to the server with gst-launch-1.0, like the ESP32 firmware does.
const { spawn, spawnSync } = require("child_process");

const RTP_HOST = process.env.VESSEL_RTP_HOST || "127.0.0.1";
const RTP_PORT = Number(process.env.VESSEL_RTP_PORT || 0);
const HAS_GST = spawnSync("gst-launch-1.0", ["--version"]).status === 0;
const VIDEO_FPS = 15;
const AUDIO_PACKETS_PER_SECOND = 50;

const sink = ["udpsink", `host=${RTP_HOST}`, `port=${RTP_PORT}`];

// I420 so jpegenc emits 4:2:0, which RFC 2435 can carry (its default 4:4:4 cannot).
const mjpegPipeline = (ssrc, buffers) => [
  "videotestsrc", "is-live=true", `num-buffers=${buffers}`,
  "!", `video/x-raw,format=I420,width=640,height=480,framerate=${VIDEO_FPS}/1`,
  "!", "jpegenc",
  "!", "rtpjpegpay", `ssrc=${ssrc}`, "pt=26",
  "!", ...sink,
];

// 16 kHz mono like the camera's microphone; Opus RTP always uses a 48 kHz clock.
const opusPipeline = (ssrc, buffers) => [
  "audiotestsrc", "is-live=true", "samplesperbuffer=320", `num-buffers=${buffers}`,
  "!", "audio/x-raw,rate=16000,channels=1",
  "!", "opusenc", "bitrate=24000", "frame-size=20",
  "!", "rtpopuspay", `ssrc=${ssrc}`, "pt=111",
  "!", ...sink,
];

function run(args) {
  const child = spawn("gst-launch-1.0", ["-q", ...args], { stdio: "ignore" });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) =>
      code === 0 || signal ? resolve() : reject(new Error(`gst-launch exited ${code}`)),
    );
  });
  return { done, stop: () => child.kill("SIGTERM") };
}

/** Sends for `seconds`, resolving when done. */
const sendMjpeg = (ssrc, seconds) => run(mjpegPipeline(ssrc, VIDEO_FPS * seconds)).done;
const sendOpus = (ssrc, seconds) =>
  run(opusPipeline(ssrc, AUDIO_PACKETS_PER_SECOND * seconds)).done;

/** Sends until stop() is called (or `maxSeconds` elapse). */
const startMjpeg = (ssrc, maxSeconds = 600) => run(mjpegPipeline(ssrc, VIDEO_FPS * maxSeconds));
const startOpus = (ssrc, maxSeconds = 600) =>
  run(opusPipeline(ssrc, AUDIO_PACKETS_PER_SECOND * maxSeconds));

module.exports = {
  HAS_GST,
  RTP_PORT,
  VIDEO_FPS,
  AUDIO_PACKETS_PER_SECOND,
  sendMjpeg,
  sendOpus,
  startMjpeg,
  startOpus,
};
