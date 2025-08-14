import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import Cookies from "js-cookie";
import { parseJwt } from "@/lib/jwt";

export function AuthInterceptor({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = Cookies.get("token");

  useEffect(() => {
    if (!Cookies.get("token")) {
      window.location.href = "/auth";
    } else {
      const parse = parseJwt(Cookies.get("token") || "");
      const now = new Date();
      const exp = new Date(parse.exp * 1000);

      if (now.getTime() >= exp.getTime()) {
        window.location.href = "/auth";
      }
    }
  }, [location]);

  if (!token) {
    return <Navigate to='/auth' replace />;
  }

  return <>{children}</>;
}
