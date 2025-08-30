import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Flow, { FlowHeader, FlowSidebar } from "@/features/flow/Flow";
import { AppSidebar } from "@/features/sidebar";
import { WebSocketProvider } from "@/features/ws/WebSocketProvider";
import { Separator } from "@radix-ui/react-separator";
import Cookies from "js-cookie";
import { useState, useEffect } from "react";

export function FlowPage() {
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
        <AppSidebar />
        <SidebarInset>
          <header className='flex h-12 shrink-0 items-center gap-2 border-b px-4 justify-between'>
            <div className='flex shrink-0 items-center gap-2'>
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
                    <BreadcrumbPage>Flow</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

            <FlowHeader />
          </header>
          <div className='flex flex-1 flex-row'>
            <FlowSidebar />
            <Flow />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </WebSocketProvider>
  );
}
