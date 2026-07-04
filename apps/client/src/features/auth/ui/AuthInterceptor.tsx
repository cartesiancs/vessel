import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import { parseJwt } from "@/shared/lib/jwt";
import { storage } from "@/shared/lib/storage";
import { refreshActiveSession } from "@/shared/lib/session";
import { isDemoMode } from "@/shared/config/demo";

export function AuthInterceptor({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = storage.getToken();

  useEffect(() => {
    if (isDemoMode) return;

    const currentToken = storage.getToken();
    if (!currentToken) {
      window.location.href = "/auth";
      return;
    }

    const parse = parseJwt(currentToken);
    const isValid =
      parse?.exp && new Date().getTime() < new Date(parse.exp * 1000).getTime();

    if (isValid) return;

    // Access token is missing/expired: try a silent refresh before bouncing
    // the user to the login screen.
    void refreshActiveSession().then((newToken) => {
      if (!newToken) {
        window.location.href = "/auth";
      }
    });
  }, [location]);

  if (!token && !isDemoMode) {
    return <Navigate to='/auth' replace />;
  }

  return <>{children}</>;
}
