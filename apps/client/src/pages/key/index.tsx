import { useEffect } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MonitorSmartphone } from "lucide-react";
import { useDeviceStore } from "@/entities/device/store";
import { DeviceTokenManager } from "@/features/device-token/DeviceTokenManager";
import { Separator } from "@/components/ui/separator";

export function KeyPage() {
  const { devices, selectedDevice, fetchDevices, selectDevice } =
    useDeviceStore();

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className='flex h-full flex-col'>
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
                <BreadcrumbPage>Key Manager</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className='flex flex-1 overflow-hidden h-[100vh]'>
          <div className='w-64 border-r bg-background p-4'>
            <h2 className='mb-4 text-lg font-semibold tracking-tight'>
              Devices
            </h2>
            <div className='space-y-1'>
              {devices.map((device) => (
                <Button
                  key={device.id}
                  variant='ghost'
                  className={cn(
                    "w-full justify-start",
                    selectedDevice?.id === device.id && "bg-muted",
                  )}
                  onClick={() => selectDevice(device)}
                >
                  <MonitorSmartphone className='mr-2 h-4 w-4' />
                  {device.name || device.device_id}
                </Button>
              ))}
            </div>
          </div>

          <main className='flex-1 overflow-y-auto p-4 md:p-6 h-[100vh]'>
            {selectedDevice ? (
              <div>
                <div className='mb-4'>
                  <h1 className='font-semibold text-lg md:text-2xl'>
                    {selectedDevice.name}
                  </h1>
                  <p className='text-sm text-muted-foreground'>
                    ID: {selectedDevice.device_id}
                  </p>
                </div>
                <DeviceTokenManager deviceId={selectedDevice.id} />
              </div>
            ) : (
              <div className='flex h-full items-center justify-center'>
                <div className='text-center'>
                  <h2 className='text-xl font-medium text-muted-foreground'>
                    Select a device
                  </h2>
                  <p className='text-sm text-muted-foreground'>
                    Choose a device from the list to manage its access token.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
