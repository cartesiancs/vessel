type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
type TauriCore = { invoke?: InvokeFn };
type TauriNamespace = { invoke?: InvokeFn };
type TauriGlobal = {
  invoke?: InvokeFn;
  core?: TauriCore;
  tauri?: TauriNamespace;
};

const resolveInvoker = (): InvokeFn | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const tauri = (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__;

  // Tauri v2 (withGlobalTauri: true)
  if (tauri?.core?.invoke && typeof tauri.core.invoke === "function") {
    return tauri.core.invoke.bind(tauri.core) as InvokeFn;
  }

  // Tauri v1 fallbacks
  if (tauri?.invoke && typeof tauri.invoke === "function") {
    return tauri.invoke as InvokeFn;
  }

  if (tauri?.tauri?.invoke && typeof tauri.tauri.invoke === "function") {
    return tauri.tauri.invoke as InvokeFn;
  }

  return null;
};

// Loads the official invoke function via dynamic import. Works regardless of
// whether `withGlobalTauri` is enabled, because Vite bundles @tauri-apps/api.
let cachedAsyncInvoke: Promise<InvokeFn | null> | null = null;
const loadAsyncInvoke = async (): Promise<InvokeFn | null> => {
  if (typeof window === "undefined") return null;
  if (!cachedAsyncInvoke) {
    cachedAsyncInvoke = (async () => {
      try {
        const mod = (await import("@tauri-apps/api/core")) as {
          invoke?: InvokeFn;
        };
        return typeof mod.invoke === "function" ? mod.invoke : null;
      } catch {
        return null;
      }
    })();
  }
  return cachedAsyncInvoke;
};

const getInvoke = async (): Promise<InvokeFn | null> => {
  const sync = resolveInvoker();
  if (sync) return sync;
  return await loadAsyncInvoke();
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
  const invoke = await getInvoke();
  if (!invoke) {
    return;
  }

  try {
    await invoke("start_sidecar");
  } catch (error) {
    console.warn("Failed to start server sidecar via Tauri", error);
  }
};

export type SidecarStatus = {
  running: boolean;
  base_url?: string | null;
  listen_address: string;
  working_dir: string;
};

export type ServerAddress = {
  host: string;
  port: number;
};

export const getDesktopServerUrl = async (): Promise<string | null> => {
  const invoke = await getInvoke();
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

export const getSidecarStatus = async (): Promise<SidecarStatus | null> => {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("get_sidecar_status")) as SidecarStatus;
  } catch (error) {
    console.warn("Failed to read sidecar status", error);
    return null;
  }
};

export const getServerAddress = async (): Promise<ServerAddress | null> => {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return (await invoke("get_server_address")) as ServerAddress;
  } catch (error) {
    console.warn("Failed to read server address", error);
    return null;
  }
};

export const updateServerAddress = async (
  host: string,
  port: number,
): Promise<SidecarStatus> => {
  const invoke = await getInvoke();
  if (!invoke) {
    throw new Error("Tauri runtime not available");
  }
  return (await invoke("update_server_address", { host, port })) as SidecarStatus;
};

export const openDesktopSettings = async (): Promise<void> => {
  const invoke = await getInvoke();
  if (!invoke) return;
  try {
    await invoke("open_settings_window");
  } catch (error) {
    console.warn("Failed to open settings window", error);
  }
};
