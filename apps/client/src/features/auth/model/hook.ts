import { useCallback } from "react";
import { useNavigate } from "react-router";
import { storage } from "@/shared/lib/storage";
import { hardNavigateToDashboard } from "@/shared/lib/resetStores";
import { logoutSession } from "@/features/auth/api";

export const useLogout = () => {
  const navigate = useNavigate();

  const logout = useCallback(() => {
    const active = storage.getActiveServer();
    if (active) {
      // Best-effort server-side revocation of the refresh token family. Fire
      // and forget — local cleanup proceeds regardless.
      if (active.refreshToken) {
        void logoutSession(active.url, active.refreshToken);
      }
      storage.removeServer(active.id);
    }
    const remaining = storage.getServers();
    if (remaining.length > 0) {
      hardNavigateToDashboard();
      return;
    }
    navigate("/auth", { replace: true });
  }, [navigate]);

  return { logout };
};
