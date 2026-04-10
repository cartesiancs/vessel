export const isDemoMode =
  typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.VITE_DEMO_MODE === "true";

export const DEMO_SERVER_URL = "https://demo.vessel.local";
export const DEMO_TOKEN = "demo-token";
