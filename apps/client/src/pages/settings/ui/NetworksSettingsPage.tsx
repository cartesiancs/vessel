import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/ui/sidebar";
import { AppSidebar } from "@/features/sidebar";
import { Separator } from "@/shared/ui/separator";
import { Badge } from "@/shared/ui/badge";
import { Globe, Radio, Bluetooth, Zap } from "lucide-react";

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

interface NetworkCardProps {
  icon: React.ReactNode;
  name: string;
  status: "online" | "offline" | "coming-soon";
}

function NetworkCard({ icon, name, status }: NetworkCardProps) {
  return (
    <div className='flex items-center justify-between border p-4'>
      <div className='flex items-center gap-3'>
        <div className='text-muted-foreground'>{icon}</div>
        <span className='font-medium text-sm'>{name}</span>
      </div>
      {status === "online" && (
        <Badge variant='default' className='!bg-green-600 !text-white'>
          Online
        </Badge>
      )}
      {status === "offline" && <Badge variant='destructive'>Offline</Badge>}
      {status === "coming-soon" && <Badge variant='outline'>Coming Soon</Badge>}
    </div>
  );
}

export function NetworksSettingsPage() {
  const isOnline = useOnlineStatus();

  return (
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
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to='/dashboard'>/</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to='/settings'>Settings</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Networks</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className='flex-1 overflow-y-auto p-4 md:p-6'>
          <div className='flex flex-col mb-4'>
            <h1 className='font-semibold text-lg md:text-2xl'>Networks</h1>
            <p className='text-muted-foreground text-sm'>
              Monitor network interface status.
            </p>
          </div>

          <div className='flex flex-col gap-2'>
            <NetworkCard
              icon={<Globe className='h-4 w-4' />}
              name='Internet'
              status={isOnline ? "online" : "offline"}
            />
            <NetworkCard
              icon={<Radio className='h-4 w-4' />}
              name='LoRa Network'
              status='coming-soon'
            />
            <NetworkCard
              icon={<Bluetooth className='h-4 w-4' />}
              name='BLE'
              status='coming-soon'
            />
            <NetworkCard
              icon={<Zap className='h-4 w-4' />}
              name='Zigbee'
              status='coming-soon'
            />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
