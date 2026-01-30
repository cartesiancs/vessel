const http = require("node:http");
const https = require("node:https");
const { randomBytes } = require("node:crypto");

const config = {
  serverUrl: "http://127.0.0.1:6174",
  entityId: "testbasic-http",
  deviceId: "testbasic",
  deviceToken: "OQ_PrBdAapWVulzXCke4n9EbXEINILPLryIpIe_19lM",
  intervalMs: 10_000,
};

if (!config.deviceId || !config.deviceToken) {
  console.error("Error: deviceId and deviceToken must be set.");
  process.exit(1);
}

const targetUrl = new URL(
  `/api/states/${encodeURIComponent(config.entityId)}`,
  config.serverUrl,
);
const httpClient = targetUrl.protocol === "https:" ? https : http;

const makeRandomState = (length = 12) =>
  randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);

async function postState() {
  const stateValue = makeRandomState();
  const body = JSON.stringify({ state: stateValue });

  const options = {
    method: "POST",
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
    path: targetUrl.pathname,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "X-Device-Id": config.deviceId,
      Authorization: `Bearer ${config.deviceToken}`,
    },
  };

  await new Promise((resolve, reject) => {
    const req = httpClient.request(options, (res) => {
      const chunks = [];

      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const responseBody =
          Buffer.concat(chunks).toString("utf8") || "<empty>";
        const timestamp = new Date().toISOString();

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          console.log(
            `[${timestamp}] Sent state "${stateValue}" -> ${res.statusCode} ${res.statusMessage}`,
          );
        } else {
          console.error(
            `[${timestamp}] Server responded with ${res.statusCode} ${res.statusMessage}: ${responseBody}`,
          );
        }

        resolve();
      });
    });

    req.on("error", (error) => {
      console.error("Failed to send state:", error.message);
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

(async () => {
  try {
    await postState();
  } catch (error) {
    console.error("Initial request failed, continuing with interval:", error);
  }

  const intervalId = setInterval(async () => {
    try {
      await postState();
    } catch (error) {
      console.error("Interval request failed:", error);
    }
  }, config.intervalMs);

  process.on("SIGINT", () => {
    clearInterval(intervalId);
    console.log("\nStopped sending random text states.");
    process.exit(0);
  });
})();
