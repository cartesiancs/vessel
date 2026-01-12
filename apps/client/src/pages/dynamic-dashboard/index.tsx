import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/features/sidebar";
import { Footer } from "@/features/footer";
import { WebRTCProvider } from "@/features/rtc/WebRTCProvider";
import { useNavigate, useParams } from "react-router";
import { useDynamicDashboardStore } from "@/entities/dynamic-dashboard/store";
import { GroupCanvas } from "@/features/dynamic-dashboard/GroupCanvas";
import { useEntitiesData } from "@/features/entity/useEntitiesData";
import { Plus, Copy, Trash2 } from "lucide-react";

export function DynamicDashboardPage() {
  const params = useParams<{ dashboardId?: string }>();
  const navigate = useNavigate();
  const {
    dashboards,
    activeDashboardId,
    setActiveDashboard: setActiveDashboardStore,
    createDashboard,
    deleteDashboard,
    cloneDashboard,
    addGroup,
    deleteGroup,
    loadDashboards,
    hasLoaded,
    isLoading,
  } = useDynamicDashboardStore();
  const setActiveDashboard = setActiveDashboardStore;
  const { entities, streamsState } = useEntitiesData();
  const [editMode, setEditMode] = useState(false);

  const currentDashboard = useMemo(
    () => dashboards.find((d) => d.id === activeDashboardId),
    [dashboards, activeDashboardId],
  );

  useEffect(() => {
    if (!hasLoaded && !isLoading) {
      loadDashboards();
    }
  }, [hasLoaded, isLoading, loadDashboards]);

  useEffect(() => {
    if (!hasLoaded || isLoading) {
      return;
    }

    const sync = async () => {
      const hasDashboards = dashboards.length > 0;
      if (!hasDashboards) {
        const id = await createDashboard();
        if (id) {
          navigate(`/dynamic-dashboard/${id}`, { replace: true });
        }
        return;
      }

      const foundFromParam = dashboards.find(
        (d) => d.id === params.dashboardId,
      );
      const targetId = foundFromParam?.id ?? dashboards[0]?.id;

      // Sync the active dashboard only when it differs.
      if (targetId && activeDashboardId !== targetId) {
        setActiveDashboard(targetId);
      }

      // Keep the URL in sync but avoid navigating to the same id.
      if (targetId && params.dashboardId !== targetId) {
        navigate(`/dynamic-dashboard/${targetId}`, { replace: true });
      }
    };

    sync();
  }, [
    dashboards,
    params.dashboardId,
    activeDashboardId,
    createDashboard,
    navigate,
    setActiveDashboard,
    hasLoaded,
    isLoading,
  ]);

  const handleAddDashboard = async () => {
    const id = await createDashboard();
    if (id) {
      navigate(`/dynamic-dashboard/${id}`);
    }
  };

  const handleSelectDashboard = (id: string) => {
    setActiveDashboard(id);
    navigate(`/dynamic-dashboard/${id}`);
  };

  return (
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
                      value={currentDashboard?.id || undefined}
                      onValueChange={handleSelectDashboard}
                    >
                      <SelectTrigger
                        size='sm'
                        className='w-[200px] focus:ring-0'
                      >
                        <SelectValue placeholder='Select dashboard' />
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
                      variant='outline'
                      size='icon'
                      onClick={handleAddDashboard}
                    >
                      <Plus className='h-4 w-4' />
                    </Button>
                    {currentDashboard && (
                      <>
                        <Button
                          variant='outline'
                          size='icon'
                          onClick={async () => {
                            const id = await cloneDashboard(
                              currentDashboard.id,
                            );
                            if (id) navigate(`/dynamic-dashboard/${id}`);
                          }}
                        >
                          <Copy className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={async () => {
                            const remaining = dashboards.filter(
                              (d) => d.id !== currentDashboard.id,
                            );
                            await deleteDashboard(currentDashboard.id);

                            const nextId = remaining[0]?.id;
                            if (nextId) {
                              navigate(`/dynamic-dashboard/${nextId}`);
                            }
                          }}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </>
                    )}
                  </div>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className='ml-auto flex items-center gap-2'>
              <span className='text-xs text-muted-foreground'>Edit mode</span>
              <Switch checked={editMode} onCheckedChange={setEditMode} />
              <Button
                size='sm'
                variant='secondary'
                onClick={() =>
                  currentDashboard &&
                  addGroup(currentDashboard.id, {
                    title: `Group ${currentDashboard.groups.length + 1}`,
                    cols: 16,
                    rows: 12,
                  })
                }
              >
                Add Group
              </Button>
            </div>
          </header>

          <div className='flex flex-1 flex-col gap-4 overflow-y-auto'>
            {currentDashboard ? (
              <div className='flex flex-col gap-4'>
                {currentDashboard.groups.map((group) => (
                  <GroupCanvas
                    key={group.id}
                    dashboardId={currentDashboard.id}
                    group={group}
                    entities={entities}
                    streamsState={streamsState}
                    editMode={editMode}
                    onDeleteGroup={
                      currentDashboard.groups.length > 1
                        ? () => deleteGroup(currentDashboard.id, group.id)
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <div className='text-sm text-muted-foreground'>
                No dynamic dashboard found. Create one with the + button.
              </div>
            )}
          </div>
          <Footer />
        </SidebarInset>
      </SidebarProvider>
    </WebRTCProvider>
  );
}
