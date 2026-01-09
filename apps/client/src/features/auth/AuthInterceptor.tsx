import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import Cookies from "js-cookie";
import { parseJwt } from "@/lib/jwt";
import { isDemoMode } from "@/shared/demo";

export function AuthInterceptor({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = Cookies.get("token");

  useEffect(() => {
    if (isDemoMode) return;

    if (!Cookies.get("token")) {
      window.location.href = "/auth";
    } else {
      const parse = parseJwt(Cookies.get("token") || "");
      if (!parse?.exp) {
        window.location.href = "/auth";
        return;
      }

      const now = new Date();
      const exp = new Date(parse.exp * 1000);

      if (now.getTime() >= exp.getTime()) {
        window.location.href = "/auth";
      }
    }
  }, [location]);

  if (!token && !isDemoMode) {
    return <Navigate to='/auth' replace />;
  }

  return <>{children}</>;
}
