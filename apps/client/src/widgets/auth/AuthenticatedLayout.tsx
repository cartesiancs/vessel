import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import Cookies from "js-cookie";
import { WebSocketProvider } from "@/features/ws/WebSocketProvider";
import { TopBarWrapper } from "./TopBarWrapper";

export function AuthenticatedLayout() {
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = Cookies.get("token");
    const serverUrlString = Cookies.get("server_url");

    if (!token || !serverUrlString) {
      navigate("/auth", { replace: true });
      return;
    }

    try {
      const url = new URL(serverUrlString);
      const host = url.host;
      setWsUrl(`ws://${host}/signal?token=${token}`);
    } catch {
      console.error("Invalid server_url in cookies:", serverUrlString);
      navigate("/auth", { replace: true });
    }
  }, [navigate]);

  if (!wsUrl) {
    return <div>Loading...</div>;
  }

  return (
    <WebSocketProvider url={wsUrl}>
      <TopBarWrapper>
        <Outlet />
      </TopBarWrapper>
    </WebSocketProvider>
  );
}
