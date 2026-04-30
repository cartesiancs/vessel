import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import { parseJwt } from "@/lib/jwt";
import { storage } from "@/lib/storage";
import { isDemoMode } from "@/shared/demo";

export function AuthInterceptor({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = storage.getToken();

  useEffect(() => {
    if (isDemoMode) return;

    const currentToken = storage.getToken();
    if (!currentToken) {
      window.location.href = "/auth";
    } else {
      const parse = parseJwt(currentToken);
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
