import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { WebSocketProvider } from "@/features/ws/WebSocketProvider";
import { TopBarWrapper } from "./TopBarWrapper";
import { isDemoMode } from "@/shared/demo";
import { storage } from "@/lib/storage";
import { ChatPanelContainer, useChatStore, PANEL_WIDTH } from "@/features/llm-chat";
import { useIsMobile } from "@/hooks/use-mobile";

export function AuthenticatedLayout() {
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isDemoMode) {
      setWsUrl("ws://demo.vessel.local/mock");
      return;
    }

    const token = storage.getToken();
    const serverUrlString = storage.getServerUrl();

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
      console.error("Invalid server_url in storage:", serverUrlString);
      navigate("/auth", { replace: true });
    }
  }, [navigate]);

  const isOpen = useChatStore((s) => s.isOpen);
  const isMobile = useIsMobile();

  if (!wsUrl) {
    return <div>Loading...</div>;
  }

  // Disable content push on mobile
  const chatPanelWidth = isOpen && !isMobile ? PANEL_WIDTH : 0;

  return (
    <WebSocketProvider url={wsUrl}>
      <div
        style={
          {
            "--chat-panel-width": `${chatPanelWidth}px`,
          } as React.CSSProperties
        }
        className="transition-[padding] duration-300 pr-[var(--chat-panel-width)]"
      >
        <TopBarWrapper>
          <Outlet />
        </TopBarWrapper>
      </div>
      <ChatPanelContainer />
    </WebSocketProvider>
  );
}
