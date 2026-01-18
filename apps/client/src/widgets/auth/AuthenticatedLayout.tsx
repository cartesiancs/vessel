import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import Cookies from "js-cookie";
import { WebSocketProvider } from "@/features/ws/WebSocketProvider";
import { TopBarWrapper } from "./TopBarWrapper";
import { isDemoMode } from "@/shared/demo";

export function AuthenticatedLayout() {
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isDemoMode) {
      setWsUrl("ws://demo.vessel.local/mock");
      return;
    }

    const token = Cookies.get("token");
    const serverUrlString = Cookies.get("server_url");

    if (!token || !serverUrlString) {
      navigate("/auth", { replace: true });
      return;
    }

    try {
      const url = new URL(serverUrlString);
      const host = url.host;
      const wsProto = url.protocol === "https:" ? "wss" : "ws";

      setWsUrl(`${wsProto}://${host}/signal?token=${token}`);
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
