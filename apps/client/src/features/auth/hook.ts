import { useCallback } from "react";
import { useNavigate } from "react-router";
import { storage } from "@/lib/storage";
import { hardNavigateToDashboard } from "@/lib/resetStores";

export const useLogout = () => {
  const navigate = useNavigate();

  const logout = useCallback(() => {
    const active = storage.getActiveServer();
    if (active) {
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
