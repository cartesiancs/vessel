import { Navigate } from "react-router";
import Cookies from "js-cookie";
export function AuthInterceptor({ children }: { children: React.ReactNode }) {
  const token = Cookies.get("token");

  if (!token) {
    return <Navigate to='/' replace />;
  }

  return <>{children}</>;
}
