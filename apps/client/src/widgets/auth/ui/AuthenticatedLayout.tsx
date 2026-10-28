import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { WebSocketProvider } from "@/features/ws";
import { FlowUiEventBridge } from "@/features/ws";
import { TopBarWrapper } from "./TopBarWrapper";
import { isDemoMode } from "@/shared/config/demo";
import { storage } from "@/shared/lib/storage";
import { ensureFreshToken } from "@/shared/lib/session";
import {
  ChatPanelContainer,
  useChatStore,
  PANEL_WIDTH,
} from "@/features/llm-chat";
import { useIsMobile } from "@/shared/lib/hooks/use-mobile";
import { useConfigStore } from "@/entities/configurations";
import { isTauri, type SidecarStatus } from "@/shared/lib/desktop";

/**
 * Signaling URL for the stored server. Rotates the access token first if it is missing or
 * expiring, because the WebSocket handshake authenticates with the ?token= query.
 */
async function buildSignalUrl(): Promise<string | null> {
  const serverUrlString = storage.getServerUrl();
  const token = await ensureFreshToken();
  if (!token || !serverUrlString) {
    return null;
  }
  try {
    const url = new URL(serverUrlString);
    const wsProto = url.protocol === "https:" ? "wss" : "ws";
    return `${wsProto}://${url.host}/signal?token=${token}`;
  } catch {
    console.error("Invalid server_url in storage:", serverUrlString);
    return null;
  }
}

export function AuthenticatedLayout() {
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (isDemoMode) {
      setWsUrl("ws://demo.vessel.local/mock");
      return;
    }

    let cancelled = false;

    void (async () => {
      const url = await buildSignalUrl();
      if (cancelled) return;
      if (!url) {
        navigate("/auth", { replace: true });
        return;
      }
      setWsUrl(url);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, reloadKey]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const dispose = await listen<SidecarStatus>(
          "sidecar-restarted",
          (event) => {
            const next = event.payload?.base_url;
            if (next) {
              storage.setServerUrl(next);
            }
            setWsUrl(null);
            setReloadKey((k) => k + 1);
          },
        );
        if (cancelled) {
          dispose();
        } else {
          unlisten = dispose;
        }
      } catch (err) {
        console.warn("Failed to subscribe to sidecar-restarted", err);
      }
    })();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    if (!wsUrl) return;
    void useConfigStore.getState().fetchConfigs();
  }, [wsUrl]);

  const isOpen = useChatStore((s) => s.isOpen);
  const isMobile = useIsMobile();

  if (!wsUrl) {
    return <div></div>;
  }

  // Disable content push on mobile
  const chatPanelWidth = isOpen && !isMobile ? PANEL_WIDTH : 0;

  return (
    <WebSocketProvider
      url={wsUrl}
      resolveUrl={isDemoMode ? undefined : buildSignalUrl}
    >
      <FlowUiEventBridge />
      <div
        style={
          {
            "--chat-panel-width": `${chatPanelWidth}px`,
          } as React.CSSProperties
        }
        className='transition-[padding] duration-300 pr-[var(--chat-panel-width)]'
      >
        <TopBarWrapper>
          <Outlet />
        </TopBarWrapper>
      </div>
      <ChatPanelContainer />
    </WebSocketProvider>
  );
}
