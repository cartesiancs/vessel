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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfigurationCreateButton } from "@/features/configurations/ui/ConfigurationCreateButton";
import { ConfigurationActionButton } from "@/features/configurations/ui/ConfigurationActionButton";
import { Separator } from "@/components/ui/separator";
import { useConfigStore } from "@/entities/configurations/store";

export function ServersPage() {
  const { configurations, fetchConfigs, isLoading, error } = useConfigStore();

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className='flex-1 min-w-0 h-full flex flex-col'>
        <header className='flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4'>
          <SidebarTrigger className='-ml-1' />
          <Separator
            orientation='vertical'
            className='mr-2 data-[orientation=vertical]:h-4'
          />
          <Breadcrumb className='hidden md:flex'>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href='/dashboard'>/</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>System Configurations</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className='ml-auto'>
            <ConfigurationCreateButton />
          </div>
        </header>

        <main className='flex-1 overflow-y-auto p-4 md:p-6'>
          <div className='flex items-center mb-4'>
            <h1 className='font-semibold text-lg md:text-2xl'>
              Configurations
            </h1>
          </div>

          {isLoading && <div>Loading configurations...</div>}
          {error && <div className='text-red-500'>{error}</div>}

          {!isLoading && !error && (
            <div className='border shadow-sm rounded-lg overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[200px] min-w-[200px]'>
                      Key
                    </TableHead>
                    <TableHead className='min-w-[250px]'>Value</TableHead>
                    <TableHead className='w-[200px] min-w-[200px]'>
                      Description
                    </TableHead>
                    <TableHead className='w-[100px] min-w-[100px]'>
                      Status
                    </TableHead>
                    <TableHead className='sticky right-0 bg-background w-[100px] min-w-[100px] text-right'>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configurations.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell className='font-mono'>{config.key}</TableCell>
                      <TableCell className='font-mono max-w-xs truncate'>
                        {config.value}
                      </TableCell>
                      <TableCell>{config.description}</TableCell>
                      <TableCell>
                        <Badge variant={config.enabled ? "default" : "outline"}>
                          {config.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className='sticky right-0 bg-background text-right'>
                        <ConfigurationActionButton config={config} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
