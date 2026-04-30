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
import { RecordingsList } from "@/features/recording";
import { AppSidebar } from "@/features/sidebar";

export function RecordingsPage() {
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
                <BreadcrumbLink href='#'>/</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Recordings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className='flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6'>
          <RecordingsList />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
