import { useCallback } from "react";
import { useNavigate } from "react-router";
import { storage } from "@/lib/storage";

export const useLogout = () => {
  const navigate = useNavigate();

  const logout = useCallback(() => {
    storage.removeToken();
    storage.removeServerUrl();
    navigate("/auth", { replace: true });
  }, [navigate]);

  return { logout };
};
