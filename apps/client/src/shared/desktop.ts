type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
type TauriNamespace = { invoke?: InvokeFn };
type TauriGlobal = { invoke?: InvokeFn; tauri?: TauriNamespace };

const resolveInvoker = (): InvokeFn | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const tauri = (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;
  if (tauri?.invoke && typeof tauri.invoke === "function") {
    return tauri.invoke as InvokeFn;
  }

  if (tauri?.tauri?.invoke && typeof tauri.tauri.invoke === "function") {
    return tauri.tauri.invoke as InvokeFn;
  }

  return null;
};

const hasTauriUA = () => {
  if (typeof navigator === "undefined" || !navigator.userAgent) return false;
  return navigator.userAgent.toLowerCase().includes("tauri");
};

const hasTauriEnv = () => {
  try {
    // Vite sets import.meta.env.TAURI in Tauri builds
    const env = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env;
    return Boolean(env?.TAURI);
  } catch {
    return false;
  }
};

export const isTauri = (): boolean =>
  Boolean(resolveInvoker()) || hasTauriUA() || hasTauriEnv();

export const ensureSidecarRunning = async (): Promise<void> => {
  const invoke = resolveInvoker();
  if (!invoke) {
    return;
  }

  try {
    await invoke("start_sidecar");
  } catch (error) {
    console.warn("Failed to start server sidecar via Tauri", error);
  }
};

type SidecarStatus = {
  base_url?: string | null;
};

export const getDesktopServerUrl = async (): Promise<string | null> => {
  const invoke = resolveInvoker();
  if (!invoke) {
    return null;
  }

  try {
    const result = (await invoke("get_sidecar_status")) as SidecarStatus | null;
    if (result && typeof result.base_url === "string") {
      return result.base_url;
    }
  } catch (error) {
    console.warn("Failed to read sidecar status from Tauri", error);
  }

  return null;
};
