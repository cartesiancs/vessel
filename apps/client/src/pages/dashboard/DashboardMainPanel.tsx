import { AllEntities } from "@/features/entity/AllEntities";
import StatBlock from "@/features/stat";
import ResourceUsage from "@/features/server-resource/resourceUsage";
import { HaDashboard } from "@/features/ha";
import { SdrDashboard } from "@/features/sdr/SdrDashboard";
import { Ros2Dashboard } from "@/features/ros2/Ros2Dashboard";

export type DashboardMainPanelContentView = "main" | "ha" | "ros2" | "sdr";

type DashboardMainPanelProps = {
  contentView?: DashboardMainPanelContentView;
};

export function DashboardMainPanel({
  contentView = "main",
}: DashboardMainPanelProps) {
  return (
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
  );
}
