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

      const current = storage.getServerUrl();
      if (!current) {
        const baseUrl = await getDesktopServerUrl();
        if (baseUrl) {
          storage.setServerUrl(baseUrl);
        }
      }
    };

    void bootstrap();
  }, []);
};
