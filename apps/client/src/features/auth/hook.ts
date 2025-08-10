import { useCallback } from "react";
import { useNavigate } from "react-router";
import Cookies from "js-cookie";

export const useLogout = () => {
  const navigate = useNavigate();

  const logout = useCallback(() => {
    Cookies.remove("token");
    navigate("/", { replace: true });
  }, [navigate]);

  return { logout };
};
