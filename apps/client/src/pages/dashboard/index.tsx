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
import AudioReceiver from "@/features/rtc/audio";
import { AppSidebar } from "@/features/sidebar";

export function DashboardPage() {
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
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className='overflow-scroll gap-4 p-4'>
          <div className='flex flex-1 flex-col gap-4  overflow-scroll'>
            <AudioReceiver />
            <div className='bg-muted/50 min-h-[100vh] flex-1 rounded-xl md:min-h-min' />
          </div>
          <div className='bg-muted/50 h-[600px] flex-1 rounded-xl' />
          <div className='bg-muted/50 h-[600px] flex-1 rounded-xl' />
          <div className='bg-muted/50 h-[600px] flex-1 rounded-xl' />
          <div className='bg-muted/50 h-[600px] flex-1 rounded-xl' />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
