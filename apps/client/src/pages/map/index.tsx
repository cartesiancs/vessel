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
import { MapView } from "@/features/map";
import { EntityDetailsPanel } from "@/features/map/EntityDetailsPanel";
import { LayerSidebar } from "@/features/map/LayerSidebar";
import { MapToolbar } from "@/features/map/MapToolbar";
import { AppSidebar } from "@/features/sidebar";

export function MapPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className='flex h-12 shrink-0 items-center gap-2 border-b px-4 fixed w-full bg-background/60 backdrop-blur-md z-[999]'>
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
                <BreadcrumbPage>Map</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className='flex-1 p-0 overflow-hidden'>
          <LayerSidebar />
          <MapToolbar />
          <MapView />
          <EntityDetailsPanel />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
