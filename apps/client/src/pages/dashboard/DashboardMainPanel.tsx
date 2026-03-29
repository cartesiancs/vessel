import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AllEntities } from "@/features/entity/AllEntities";
import StatBlock from "@/features/stat";
import { useEffect, useMemo, useState } from "react";
import ResourceUsage from "@/features/server-resource/resourceUsage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useIntegrationStore } from "@/entities/integrations/store";
import { HaDashboard } from "@/features/ha";
import { SdrDashboard } from "@/features/sdr/SdrDashboard";
import { Ros2Dashboard } from "@/features/ros2/Ros2Dashboard";
import { useNavigate, useSearchParams } from "react-router";

export type DashboardMainPanelContentView = "main" | "ha" | "ros2" | "sdr";

type DashboardMainPanelProps = {
  contentView?: DashboardMainPanelContentView;
};

export function DashboardMainPanel({
  contentView = "main",
}: DashboardMainPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get("view") || "main";
  const [selectedDashboard, setSelectedDashboard] = useState(initialView);
  const navigate = useNavigate();

  const { isHaConnected, isRos2Connected, isSdrConnected } =
    useIntegrationStore();

  const dashboards = useMemo(() => {
    return [
      { id: "main", name: "Dashboard" },
      isHaConnected && { id: "ha", name: "Home Assistant" },
      isRos2Connected && { id: "ros2", name: "ROS2" },
      isSdrConnected && { id: "sdr", name: "RTL-SDR" },
    ].filter(Boolean) as { id: string; name: string }[];
  }, [isHaConnected, isRos2Connected, isSdrConnected]);

  useEffect(() => {
    const view = searchParams.get("view");
    if (view && view !== selectedDashboard) {
      setSelectedDashboard(view);
    }
  }, [searchParams, selectedDashboard]);

  const handleAddDashboard = () => {
    navigate("/dynamic-dashboard");
  };

  const handleSelect = (value: string) => {
    setSelectedDashboard(value);
    setSearchParams({ view: value }, { replace: true });
  };

  return (
    <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
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
                <Select value={selectedDashboard} onValueChange={handleSelect}>
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
                <Button variant='ghost' size='icon' onClick={handleAddDashboard}>
                  <Plus className='h-4 w-4' />
                </Button>
              </div>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden'>
        <div className='overflow-scroll gap-4 p-4'>
          <div className='flex flex-1 flex-col'>
            {contentView === "main" && (
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
              {contentView === "ha" && <HaDashboard />}
              {contentView === "ros2" && <Ros2Dashboard />}
              {contentView === "sdr" && <SdrDashboard />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
