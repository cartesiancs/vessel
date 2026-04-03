import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useDynamicDashboardStore } from "@/entities/dynamic-dashboard/store";
import { useIntegrationStore } from "@/entities/integrations/store";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router";

type DashboardSwipeHeaderProps = {
  editMode: boolean;
  onEditModeChange: (value: boolean) => void;
};

export function DashboardSwipeHeader({
  editMode,
  onEditModeChange,
}: DashboardSwipeHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    dashboards,
    setActiveDashboard: setActiveDashboardStore,
    deleteDashboard,
    updateDashboardMeta,
  } = useDynamicDashboardStore();
  const setActiveDashboard = setActiveDashboardStore;

  const { isHaConnected, isRos2Connected, isSdrConnected } =
    useIntegrationStore();

  const integrationDashboards = useMemo(() => {
    return [
      { id: "main", name: "Dashboard" },
      isHaConnected && { id: "ha", name: "Home Assistant" },
      isRos2Connected && { id: "ros2", name: "ROS2" },
      isSdrConnected && { id: "sdr", name: "RTL-SDR" },
    ].filter(Boolean) as { id: string; name: string }[];
  }, [isHaConnected, isRos2Connected, isSdrConnected]);

  const initialView = searchParams.get("view") || "main";
  const [selectedDashboard, setSelectedDashboard] = useState(initialView);

  useEffect(() => {
    const view = searchParams.get("view");
    if (view && view !== selectedDashboard) {
      setSelectedDashboard(view);
    }
  }, [searchParams, selectedDashboard]);

  const pathname = location.pathname;
  const n = dashboards.length;

  const isNewDynamicPanel =
    pathname === "/dynamic-dashboard/new" ||
    (pathname === "/dynamic-dashboard" && n === 0);

  const isMainDashboardRoute = pathname === "/dashboard";

  const dynamicHeaderDashboardId = useMemo(() => {
    if (isNewDynamicPanel || isMainDashboardRoute) return null;
    if (pathname === "/dynamic-dashboard" && n > 0) {
      return dashboards[0]?.id ?? null;
    }
    const m = pathname.match(/^\/dynamic-dashboard\/([^/]+)$/);
    if (!m || m[1] === "new") return null;
    return m[1];
  }, [isNewDynamicPanel, isMainDashboardRoute, pathname, n, dashboards]);

  const currentDynamicDashboard = useMemo(
    () => dashboards.find((d) => d.id === dynamicHeaderDashboardId),
    [dashboards, dynamicHeaderDashboardId],
  );

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  const handleAddDashboard = () => {
    navigate("/dynamic-dashboard");
  };

  const handleSelectIntegration = (value: string) => {
    setSelectedDashboard(value);
    setSearchParams({ view: value }, { replace: true });
  };

  const handleSelectDynamicDashboard = (id: string) => {
    setActiveDashboard(id);
    navigate(`/dynamic-dashboard/${id}`);
  };

  const handleDeleteDashboard = async () => {
    if (!currentDynamicDashboard) {
      setDeleteConfirmOpen(false);
      return;
    }

    const remaining = dashboards.filter(
      (d) => d.id !== currentDynamicDashboard.id,
    );
    await deleteDashboard(currentDynamicDashboard.id);
    setDeleteConfirmOpen(false);

    const nextId = remaining[0]?.id;
    if (nextId) {
      navigate(`/dynamic-dashboard/${nextId}`);
    } else {
      navigate("/dynamic-dashboard/new");
    }
  };

  const openRenameDialog = () => {
    if (currentDynamicDashboard) {
      setRenameDraft(currentDynamicDashboard.name);
      setRenameOpen(true);
    }
  };

  const handleRenameSave = () => {
    const name = renameDraft.trim();
    if (!name || !currentDynamicDashboard) return;
    updateDashboardMeta(currentDynamicDashboard.id, { name });
    setRenameOpen(false);
  };

  const showDynamicChrome =
    !isMainDashboardRoute &&
    !isNewDynamicPanel &&
    dynamicHeaderDashboardId != null;

  return (
    <>
      <header className='flex h-12 shrink-0 items-center gap-2 border-b px-4'>
        <SidebarTrigger className='-ml-1' />
        <Separator
          orientation='vertical'
          className='mr-2 data-[orientation=vertical]:h-4'
        />
        {isMainDashboardRoute && (
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
                    onValueChange={handleSelectIntegration}
                  >
                    <SelectTrigger
                      size='sm'
                      className='w-[180px] focus:ring-0'
                    >
                      <SelectValue placeholder='Select a dashboard' />
                    </SelectTrigger>
                    <SelectContent>
                      {integrationDashboards.map((dashboard) => (
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
        )}
        {isNewDynamicPanel && (
          <span className='text-sm font-medium text-muted-foreground'>
            New canvas
          </span>
        )}
        {showDynamicChrome && (
          <>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className='hidden md:block'>
                  <BreadcrumbLink href='#'>/</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className='hidden md:block' />
                <BreadcrumbItem>
                  <div className='flex items-center gap-2'>
                    <Select
                      value={dynamicHeaderDashboardId}
                      onValueChange={handleSelectDynamicDashboard}
                    >
                      <SelectTrigger size='sm' className='w-[200px] focus:ring-0'>
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
                    {currentDynamicDashboard && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            aria-label='Dashboard actions'
                          >
                            <MoreVertical className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='start'>
                          <DropdownMenuItem onSelect={openRenameDialog}>
                            <Pencil className='h-4 w-4' />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant='destructive'
                            onSelect={() => setDeleteConfirmOpen(true)}
                          >
                            <Trash2 className='h-4 w-4' />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className='ml-auto flex items-center gap-2'>
              <span className='text-xs text-muted-foreground'>Edit mode</span>
              <Switch checked={editMode} onCheckedChange={onEditModeChange} />
            </div>
          </>
        )}
      </header>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename dashboard</DialogTitle>
          </DialogHeader>
          <div className='space-y-2 py-2'>
            <Label htmlFor='dashboard-rename-swipe'>Name</Label>
            <Input
              id='dashboard-rename-swipe'
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleRenameSave();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameSave} disabled={!renameDraft.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => setDeleteConfirmOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dashboard?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The dashboard layout will be
              removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDashboard}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
