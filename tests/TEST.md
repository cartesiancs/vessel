Test with Jest

`npm run test`

The suites expect a running server. Environment variables:

- `VESSEL_API_URL` — server base URL (default `http://localhost:6174`)
- `VESSEL_ADMIN_PASSWORD` — password of the `admin` user (default `admin1`)
- `VESSEL_RTP_PORT` — the server's RTP port (`rtp_broker_port`, enabled). Required for the media tests in `streams.test.js`, which also need `gst-launch-1.0`; they are skipped otherwise. `ffprobe`, when installed, checks the recorded codecs.
- `VESSEL_RTP_HOST` — host the RTP packets are sent to (default `127.0.0.1`)
- `VESSEL_CHROME_PATH` — Chrome/Chromium used by `webrtc.test.js` (default: the usual install paths). The WebRTC suite is skipped without Chrome, `gst-launch-1.0` or `VESSEL_RTP_PORT`.
- `VESSEL_WEBRTC_SOAK_SECONDS` — how long `webrtc.test.js` checks for stalls (default 20)

`local-first.test.js` needs no server: it scans the sources for cloud integrations.

Long WebRTC soak against live topics (exits non-zero on any stalled second):

`VESSEL_API_URL=http://127.0.0.1:6174 npm run soak:webrtc -- 20 cam/video:video cam/audio:audio`

Example against a throwaway server:

`VESSEL_API_URL=http://127.0.0.1:16174 VESSEL_ADMIN_PASSWORD=admin VESSEL_RTP_PORT=15004 npm test`
