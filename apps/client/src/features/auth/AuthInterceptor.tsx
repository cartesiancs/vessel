import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import Cookies from "js-cookie";

export function AuthInterceptor({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = Cookies.get("token");

  useEffect(() => {
    if (!Cookies.get("token")) {
      window.location.href = "/";
    }
  }, [location]);

  if (!token) {
    return <Navigate to='/' replace />;
  }

  return <>{children}</>;
}
