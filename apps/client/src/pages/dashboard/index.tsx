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

export function DashboardPage() {
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    const token = Cookies.get("token");
    if (token) {
      setWsUrl("ws://127.0.0.1:8080/signal?token=" + token);
    }
  }, []);

  return (
    <WebSocketProvider url={wsUrl || ""}>
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
                  <StatBlock />
                </div>

                <div className='flex flex-col gap-4 py-6 md:gap-6 md:py-6'>
                  <AllEntities />
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </WebSocketProvider>
  );
}
