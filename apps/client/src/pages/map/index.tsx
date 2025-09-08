import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { MapView } from "@/features/map";
import { EntityDetailsPanel } from "@/features/map/EntityDetailsPanel";
import { LayerSidebar } from "@/features/map/LayerSidebar";
import { MapToolbar } from "@/features/map/MapToolbar";
import { WebRTCProvider } from "@/features/rtc/WebRTCProvider";
import { AppSidebar } from "@/features/sidebar";
import { WebSocketProvider } from "@/features/ws/WebSocketProvider";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";

export function MapPage() {
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    const token = Cookies.get("token");
    const urlString = Cookies.get("server_url");
    if (urlString) {
      const url = new URL(urlString);
      const result = url.host;
      if (token) {
        setWsUrl(`ws://${result}/signal?token=${token}`);
      }
    }
  }, []);

  return (
    <WebSocketProvider url={wsUrl || ""}>
      <SidebarProvider>
        <WebRTCProvider>
          <AppSidebar />
          <SidebarInset>
            <header className='flex h-12 shrink-0 items-center gap-2 border-b px-4 fixed w-full bg-background/60 backdrop-blur-md z-[999]'>
              <SidebarTrigger className='-ml-1' />
              <Separator
                orientation='vertical'
                className='mr-2 data-[orientation=vertical]:h-4'
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className='hidden md:block'>
                    <BreadcrumbLink href='#'>/</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className='hidden md:block' />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Map</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <main className='flex-1 p-0 overflow-hidden'>
              <LayerSidebar />
              <MapToolbar />
              <MapView />
              <EntityDetailsPanel />
            </main>
          </SidebarInset>
        </WebRTCProvider>
      </SidebarProvider>
    </WebSocketProvider>
  );
}
