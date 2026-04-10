import { useMemo } from "react";
import { useDynamicDashboardStore } from "@/entities/dynamic-dashboard/store";
import { GroupCanvas } from "@/features/dynamic-dashboard/GroupCanvas";
import { useEntitiesData } from "@/features/entity/useEntitiesData";

type DynamicDashboardMainPanelProps = {
  /** Which dashboard this column renders (store order / swipe order). */
  dashboardId: string;
};

export function DynamicDashboardMainPanel({
  dashboardId,
}: DynamicDashboardMainPanelProps) {
  const { dashboards } = useDynamicDashboardStore();
  const { entities, streamsState } = useEntitiesData();

  const currentDashboard = useMemo(
    () => dashboards.find((d) => d.id === dashboardId),
    [dashboards, dashboardId],
  );

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden'>
      {currentDashboard?.groups[0] ? (
        <div className='flex min-h-0 flex-1 flex-col'>
          <div className='flex flex-col md:min-h-0 md:flex-1'>
            <GroupCanvas
              dashboardId={currentDashboard.id}
              group={currentDashboard.groups[0]}
              entities={entities}
              streamsState={streamsState}
            />
          </div>
        </div>
      ) : (
        <div className='text-sm text-muted-foreground'>
          No dynamic dashboard found. Create one with the + button or swipe
          sideways for a new canvas.
        </div>
      )}
    </div>
  );
}
