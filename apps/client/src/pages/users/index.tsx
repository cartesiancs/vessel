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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppSidebar } from "@/features/sidebar";
import { RoleTable } from "@/widgets/role-table/RoleList";
import { UserTable } from "@/widgets/user-table/UserList";

export function UsersPage() {
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
                <BreadcrumbPage>Users</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className='flex-1 overflow-y-auto p-4 md:p-6'>
          <Tabs defaultValue='user-list' className='w-full'>
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='user-list'>Users</TabsTrigger>
              <TabsTrigger value='role'>Roles</TabsTrigger>
            </TabsList>
            <TabsContent value='user-list' className='mt-4'>
              <UserTable />
            </TabsContent>
            <TabsContent value='role' className='mt-4'>
              <RoleTable />
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
