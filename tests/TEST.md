Test with Jest

`npm run test`

The suites expect a running server. Environment variables:

- `VESSEL_API_URL` — server base URL (default `http://localhost:6174`)
- `VESSEL_ADMIN_PASSWORD` — password of the `admin` user (default `admin1`)
- `VESSEL_RTP_PORT` — the server's RTP port (`rtp_broker_port`, enabled). Required for the media tests in `streams.test.js`, which also need `gst-launch-1.0`; they are skipped otherwise. `ffprobe`, when installed, checks the recorded codecs.
- `VESSEL_RTP_HOST` — host the RTP packets are sent to (default `127.0.0.1`)

Example against a throwaway server:

`VESSEL_API_URL=http://127.0.0.1:16174 VESSEL_ADMIN_PASSWORD=admin VESSEL_RTP_PORT=15004 npm test`
