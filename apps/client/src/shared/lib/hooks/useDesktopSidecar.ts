import { useEffect } from "react";

import { isDemoMode } from "@/shared/demo";
import { ensureSidecarRunning, getDesktopServerUrl, isTauri } from "@/shared/desktop";
import { storage } from "@/lib/storage";

export const useDesktopSidecar = () => {
  useEffect(() => {
    if (!isTauri() || isDemoMode) {
      return;
    }

    const bootstrap = async () => {
      await ensureSidecarRunning();

      // On the Tauri client, always default to the local sidecar URL so the
      // login screen connects to the bundled server instead of any stale
      // address left over in localStorage from a previous session.
      const baseUrl = await getDesktopServerUrl();
      if (baseUrl) {
        storage.setServerUrl(baseUrl);
      }
    };

    void bootstrap();
  }, []);
};
