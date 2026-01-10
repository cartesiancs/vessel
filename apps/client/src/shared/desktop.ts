type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<any>;

const resolveInvoker = (): InvokeFn | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const tauri = (window as any).__TAURI__;
  if (tauri?.invoke && typeof tauri.invoke === "function") {
    return tauri.invoke as InvokeFn;
  }

  if (tauri?.tauri?.invoke && typeof tauri.tauri.invoke === "function") {
    return tauri.tauri.invoke as InvokeFn;
  }

  return null;
};

export const isTauri = Boolean(resolveInvoker());

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

export const getDesktopServerUrl = async (): Promise<string | null> => {
  const invoke = resolveInvoker();
  if (!invoke) {
    return null;
  }

  try {
    const result = await invoke("get_sidecar_status");
    if (result && typeof result.base_url === "string") {
      return result.base_url;
    }
  } catch (error) {
    console.warn("Failed to read sidecar status from Tauri", error);
  }

  return null;
};
