import { useEffect } from "react";
import Cookies from "js-cookie";

import { isDemoMode } from "@/shared/demo";
import { ensureSidecarRunning, getDesktopServerUrl, isTauri } from "@/shared/desktop";

export const useDesktopSidecar = () => {
  useEffect(() => {
    if (!isTauri() || isDemoMode) {
      return;
    }

    const bootstrap = async () => {
      await ensureSidecarRunning();

      const current = Cookies.get("server_url");
      if (!current) {
        const baseUrl = await getDesktopServerUrl();
        if (baseUrl) {
          Cookies.set("server_url", baseUrl, { expires: 30 });
        }
      }
    };

    void bootstrap();
  }, []);
};
