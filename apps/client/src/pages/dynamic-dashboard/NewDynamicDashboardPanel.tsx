import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDynamicDashboardStore } from "@/entities/dynamic-dashboard/store";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router";

export function NewDynamicDashboardPanel() {
  const navigate = useNavigate();
  const createDashboard = useDynamicDashboardStore((s) => s.createDashboard);

  const handleCreate = async () => {
    const id = await createDashboard();
    if (id) {
      navigate(`/dynamic-dashboard/${id}`, { replace: true });
    }
  };

  return (
    <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
      <header className='flex h-12 shrink-0 items-center gap-2 border-b px-4'>
        <SidebarTrigger className='-ml-1' />
        <Separator
          orientation='vertical'
          className='mr-2 data-[orientation=vertical]:h-4'
        />
        <span className='text-sm font-medium text-muted-foreground'>
          New canvas
        </span>
      </header>
      <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-6'>
        <p className='max-w-sm shrink-0 text-center text-sm text-muted-foreground'>
          Create an empty dynamic dashboard. You can add widgets after it opens.
        </p>
        <Button size='lg' onClick={handleCreate} className='shrink-0 gap-2'>
          <Plus className='h-5 w-5' />
          Create dynamic dashboard
        </Button>
      </div>
    </div>
  );
}
