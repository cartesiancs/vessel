import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
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
import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import ResourceUsage from "@/features/server-resource/resourceUsage";
import { Footer } from "@/features/footer";
import { WebRTCProvider } from "@/features/rtc/WebRTCProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useConfigStore } from "@/entities/configurations/store";
import { HaDashboard } from "@/features/ha";

export function DashboardPage() {
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [selectedDashboard, setSelectedDashboard] = useState("main");

  const { configurations, fetchConfigs } = useConfigStore();

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const dashboards = useMemo(() => {
    const hasConfig = (key: string) =>
      configurations.some((c) => c.key === key && c.value);

    const isHaConnected =
      hasConfig("home_assistant_url") && hasConfig("home_assistant_token");
    const isRos2Connected = hasConfig("ros2_websocket_url");

    return [
      { id: "main", name: "Dashboard" },
      isHaConnected && { id: "ha", name: "Home Assistant" },
      isRos2Connected && { id: "ros2", name: "ROS2" },
    ].filter(Boolean) as { id: string; name: string }[];
  }, [configurations]);

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

  const handleAddDashboard = () => {};

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
                    <div className='flex items-center gap-2'>
                      <Select
                        value={selectedDashboard}
                        onValueChange={setSelectedDashboard}
                      >
                        <SelectTrigger
                          size='sm'
                          className='w-[180px] focus:ring-0'
                        >
                          <SelectValue placeholder='Select a dashboard' />
                        </SelectTrigger>
                        <SelectContent>
                          {dashboards.map((dashboard) => (
                            <SelectItem key={dashboard.id} value={dashboard.id}>
                              {dashboard.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={handleAddDashboard}
                      >
                        <Plus className='h-4 w-4' />
                      </Button>
                    </div>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <div className='overflow-scroll gap-4 p-4'>
              <div className='flex flex-1 flex-col'>
                {selectedDashboard == "main" && (
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
                )}

                <div className='@container/main flex flex-1 flex-col gap-2'>
                  {selectedDashboard == "ha" && <HaDashboard />}
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
