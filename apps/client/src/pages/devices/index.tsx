import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/features/sidebar";
import {
  INTEGRATION_DEVICE_ID,
  INTEGRATION_ENTITY_ID,
} from "@/features/integration/constants";
import { useDeviceStore } from "@/entities/device/store";
import { useEntityStore } from "@/entities/entity/store";
import { DeviceList } from "@/widgets/device-list/DeviceList";
import { EntityList } from "@/widgets/entity-list/EntityList";

export function DevicePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const configureParam = searchParams.get("configure");

  const { devices, isLoading: devicesLoading, selectDevice } = useDeviceStore();
  const { entities, isLoading: entitiesLoading, setAutoOpenEntityId } =
    useEntityStore();
  const hasAutoConfigured = useRef(false);

  useEffect(() => {
    if (!configureParam || hasAutoConfigured.current) return;
    if (devicesLoading || entitiesLoading) return;
    if (devices.length === 0 || entities.length === 0) return;

    const targetDeviceId = INTEGRATION_DEVICE_ID[configureParam];
    const targetEntityId = INTEGRATION_ENTITY_ID[configureParam];
    if (!targetDeviceId) {
      setSearchParams({}, { replace: true });
      return;
    }

    const targetDevice = devices.find((d) => d.device_id === targetDeviceId);
    if (!targetDevice) {
      setSearchParams({}, { replace: true });
      return;
    }

    selectDevice(targetDevice);

    const targetEntity = targetEntityId
      ? entities.find((e) => e.entity_id === targetEntityId && e.device_id === targetDevice.id)
      : entities.find((e) => e.device_id === targetDevice.id);
    const firstEntity = targetEntity;
    if (firstEntity) {
      setAutoOpenEntityId(firstEntity.id);
    }

    hasAutoConfigured.current = true;
    setSearchParams({}, { replace: true });
  }, [
    configureParam,
    devices,
    entities,
    devicesLoading,
    entitiesLoading,
    selectDevice,
    setAutoOpenEntityId,
    setSearchParams,
  ]);

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
              <BreadcrumbItem className='hidden md:block'>
                <BreadcrumbLink href='#'>/</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className='hidden md:block' />
              <BreadcrumbItem>
                <BreadcrumbPage>Devices</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className='flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6'>
          <div className='grid auto-rows-max items-start gap-4 md:gap-8 lg:grid-cols-2'>
            <DeviceList />
            <EntityList />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
