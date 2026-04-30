import { Link, useNavigate } from "react-router";
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
import { Separator } from "@/components/ui/separator";
import {
  Blocks,
  ChevronRight,
  Cloud,
  Code,
  Network,
  ScrollText,
  Server,
  UserCog,
} from "lucide-react";

type Category = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
};

const categories: Category[] = [
  {
    id: "account",
    title: "Account",
    description: "Vessel Cloud, Capsule Server, TURN credentials",
    icon: <Cloud className='h-5 w-5' />,
    to: "/settings/account",
  },
  {
    id: "services",
    title: "Services",
    description: "Code workspace, Tunnel",
    icon: <Code className='h-5 w-5' />,
    to: "/settings/services",
  },
  {
    id: "users",
    title: "Users",
    description: "Manage users and roles",
    icon: <UserCog className='h-5 w-5' />,
    to: "/settings/users",
  },
  {
    id: "networks",
    title: "Networks",
    description: "Network interface status",
    icon: <Network className='h-5 w-5' />,
    to: "/settings/networks",
  },
  {
    id: "integration",
    title: "Integration",
    description: "Home Assistant, ROS2, RTL-SDR",
    icon: <Blocks className='h-5 w-5' />,
    to: "/settings/integration",
  },
  {
    id: "log",
    title: "Log",
    description: "Server logs",
    icon: <ScrollText className='h-5 w-5' />,
    to: "/settings/log",
  },
  {
    id: "config",
    title: "Config",
    description: "System configurations",
    icon: <Server className='h-5 w-5' />,
    to: "/settings/config",
  },
];

export function SettingsPage() {
  const navigate = useNavigate();

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
                <BreadcrumbPage>Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className='flex-1 overflow-y-auto p-4 md:p-6'>
          <div className='flex flex-col mb-4'>
            <h1 className='font-semibold text-lg md:text-2xl'>Settings</h1>
          </div>

          <div className='flex flex-col border divide-y'>
            {categories.map((c) => (
              <button
                key={c.id}
                type='button'
                onClick={() => navigate(c.to)}
                className='flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors'
              >
                <div className='text-muted-foreground'>{c.icon}</div>
                <div className='flex flex-col flex-1 min-w-0'>
                  <span className='font-medium text-sm'>{c.title}</span>
                  <span className='text-xs text-muted-foreground truncate'>
                    {c.description}
                  </span>
                </div>
                <ChevronRight className='h-4 w-4 text-muted-foreground shrink-0' />
              </button>
            ))}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
