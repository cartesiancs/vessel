import { Button } from "@/components/ui/button";
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
    <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-6'>
      <Button size='lg' onClick={handleCreate} className='shrink-0 gap-2'>
        <Plus className='h-5 w-5' />
        Create dynamic dashboard
      </Button>
    </div>
  );
}
