const DEMO_HOSTNAME = "demo.vsl.cartesiancs.com";

const isDemoHostname =
  typeof window !== "undefined" &&
  window.location?.hostname === DEMO_HOSTNAME;

const isDemoEnv =
  typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.VITE_DEMO_MODE === "true";

export const isDemoMode = isDemoEnv || isDemoHostname;

export const DEMO_SERVER_URL = "https://demo.vessel.local";
export const DEMO_TOKEN = "demo-token";
