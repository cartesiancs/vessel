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
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useDynamicDashboardStore } from "@/entities/dynamic-dashboard/store";
import { GroupCanvas } from "@/features/dynamic-dashboard/GroupCanvas";
import { useEntitiesData } from "@/features/entity/useEntitiesData";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
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

type DynamicDashboardMainPanelProps = {
  /** Which dashboard this column renders (store order / swipe order). */
  dashboardId: string;
};

export function DynamicDashboardMainPanel({
  dashboardId,
}: DynamicDashboardMainPanelProps) {
  const navigate = useNavigate();
  const {
    dashboards,
    setActiveDashboard: setActiveDashboardStore,
    deleteDashboard,
    updateDashboardMeta,
  } = useDynamicDashboardStore();
  const setActiveDashboard = setActiveDashboardStore;
  const { entities, streamsState } = useEntitiesData();
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  const currentDashboard = useMemo(
    () => dashboards.find((d) => d.id === dashboardId),
    [dashboards, dashboardId],
  );

  // const handleAddDashboard = async () => {
  //   const id = await createDashboard();
  //   if (id) {
  //     navigate(`/dynamic-dashboard/${id}`);
  //   }
  // };

  const handleSelectDashboard = (id: string) => {
    setActiveDashboard(id);
    navigate(`/dynamic-dashboard/${id}`);
  };

  const handleDeleteDashboard = async () => {
    if (!currentDashboard) {
      setDeleteConfirmOpen(false);
      return;
    }

    const remaining = dashboards.filter((d) => d.id !== currentDashboard.id);
    await deleteDashboard(currentDashboard.id);
    setDeleteConfirmOpen(false);

    const nextId = remaining[0]?.id;
    if (nextId) {
      navigate(`/dynamic-dashboard/${nextId}`);
    } else {
      navigate("/dynamic-dashboard/new");
    }
  };

  const openRenameDialog = () => {
    if (currentDashboard) {
      setRenameDraft(currentDashboard.name);
      setRenameOpen(true);
    }
  };

  const handleRenameSave = () => {
    const name = renameDraft.trim();
    if (!name || !currentDashboard) return;
    updateDashboardMeta(currentDashboard.id, { name });
    setRenameOpen(false);
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
                <Select
                  value={dashboardId}
                  onValueChange={handleSelectDashboard}
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
                {/* <Button
                  variant='outline'
                  size='icon'
                  onClick={handleAddDashboard}
                >
                  <Plus className='h-4 w-4' />
                </Button> */}
                {currentDashboard && (
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
          <Switch checked={editMode} onCheckedChange={setEditMode} />
        </div>
      </header>

      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden'>
        {currentDashboard?.groups[0] ? (
          <div className='flex min-h-0 flex-1 flex-col'>
            <div className='flex flex-col md:min-h-0 md:flex-1'>
              <GroupCanvas
                dashboardId={currentDashboard.id}
                group={currentDashboard.groups[0]}
                entities={entities}
                streamsState={streamsState}
                editMode={editMode}
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

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename dashboard</DialogTitle>
          </DialogHeader>
          <div className='space-y-2 py-2'>
            <Label htmlFor='dashboard-rename'>Name</Label>
            <Input
              id='dashboard-rename'
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
            <Button
              onClick={handleRenameSave}
              disabled={!renameDraft.trim()}
            >
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
    </div>
  );
}
