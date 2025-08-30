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
import { AllEntities } from "@/features/entity/AllEntities";
import { AppSidebar } from "@/features/sidebar";
import StatBlock from "@/features/stat";
import { WebSocketProvider } from "@/features/ws/WebSocketProvider";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import ResourceUsage from "@/features/server-resource/resourceUsage";
import { Footer } from "@/features/footer";
import { WebRTCProvider } from "@/features/rtc/WebRTCProvider";

export function DashboardPage() {
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
      <WebRTCProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className='flex h-12 shrink-0 items-center gap-2 border-b px-4'>
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
                    <BreadcrumbPage>Dashboard</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <div className='overflow-scroll gap-4 p-4'>
              <div className='flex flex-1 flex-col'>
                <div className='@container/main flex flex-1 flex-col gap-2'>
                  <div className='flex flex-col gap-4 py-4 md:gap-6 md:py-6'>
                    <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4'>
                      <StatBlock />
                      <ResourceUsage />
                    </div>
                  </div>

                  <div className='flex flex-col gap-4 py-6 md:gap-6 md:py-6'>
                    <AllEntities />
                  </div>
                </div>
              </div>
            </div>
            <Footer />
          </SidebarInset>
        </SidebarProvider>
      </WebRTCProvider>
    </WebSocketProvider>
  );
}
