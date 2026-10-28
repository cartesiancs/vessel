import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shared/ui/sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import { AccountSwitcher } from "../../account-switcher";
import { useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  MonitorSmartphone,
  Workflow,
  Map,
  CircleDashed,
  Code,
  RadioTower,
  Video,
} from "lucide-react";
import { NavFooter } from "./footer";
import { isElectron } from "@/shared/lib/electron";
import { useDynamicDashboardStore } from "@/entities/dynamic-dashboard";
import { useIntegrationStore } from "@/entities/integrations";
import { useConfigStore } from "@/entities/configurations";
import { getCodeServiceEnabled } from "@/entities/configurations";
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const SIDEBAR_SCROLL_KEY = "sidebar-scroll-top";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "#",
      items: [
        {
          title: "Controls",
          url: "/dashboard",
          icon: <LayoutDashboard />,
        },
        {
          title: "Flow",
          url: "/flow",
          icon: <Workflow />,
        },
        {
          title: "Map",
          url: "/map",
          icon: <Map />,
        },
      ],
    },
    {
      title: "Devices",
      url: "#",
      items: [
        {
          title: "Devices",
          url: "/devices",
          icon: <MonitorSmartphone />,
        },
        {
          title: "Recordings",
          url: "/recordings",
          icon: <Video />,
        },
      ],
    },
    {
      title: "Services",
      url: "#",
      items: [
        {
          title: "Code",
          url: "/code",
          icon: <Code />,
        },
      ],
    },
    {
      title: "Setting",
      url: "#",
      items: [
        {
          title: "Setup",
          url: "/setup",
          icon: <CircleDashed />,
        },
        {
          title: "Settings",
          url: "/settings",
          icon: <RadioTower />,
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const currentPath = location.pathname;
  const navigate = useNavigate();
  const {
    dashboards,
    loadDashboards,
    hasLoaded,
    isLoading,
    setActiveDashboard,
    activeDashboardId,
  } = useDynamicDashboardStore();
  const { isHaConnected, isRos2Connected, isSdrConnected, fetchStatus } =
    useIntegrationStore();
  const { configurations, fetchConfigs } = useConfigStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  const navMain = useMemo(() => {
    const codeOn = getCodeServiceEnabled(configurations);
    return data.navMain
      .map((group) => {
        if (group.title !== "Services") {
          return group;
        }
        const items = group.items.filter(
          (item) => item.title !== "Code" || codeOn,
        );
        if (items.length === 0) {
          return null;
        }
        return { ...group, items };
      })
      .filter((g): g is (typeof data.navMain)[number] => g !== null);
  }, [configurations]);

  const [controlsFlyoutOpen, setControlsFlyoutOpen] = useState(false);

  const dashboardView = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("view") || "main";
  }, [location.search]);

  const controlViews = useMemo(() => {
    return [
      { id: "main", name: "Dashboard" },
      isHaConnected && { id: "ha", name: "Home Assistant" },
      isRos2Connected && { id: "ros2", name: "ROS2" },
      isSdrConnected && { id: "sdr", name: "RTL-SDR" },
    ].filter(Boolean) as { id: string; name: string }[];
  }, [isHaConnected, isRos2Connected, isSdrConnected]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(el.scrollTop));
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
    if (saved !== null) {
      requestAnimationFrame(() => {
        el.scrollTop = Number(saved);
      });
    }
  }, [currentPath]);

  useEffect(() => {
    if (!hasLoaded && !isLoading) {
      loadDashboards();
    }
  }, [hasLoaded, isLoading, loadDashboards]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  return (
    <Sidebar
      {...props}
      collapsible='icon'
      style={{
        top: isElectron() ? "34px" : "0",
        height: isElectron() ? "calc(100% - 34px)" : "100%",
      }}
    >
      <SidebarHeader>
        <AccountSwitcher />
      </SidebarHeader>
      <SidebarContent
        ref={scrollRef}
        onScroll={handleScroll}
        className='justify-center'
      >
        {navMain.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isControls = item.url === "/dashboard";
                  const isActive =
                    currentPath === item.url ||
                    (isControls &&
                      currentPath.startsWith("/dynamic-dashboard"));

                  if (isControls) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <Popover
                          open={controlsFlyoutOpen}
                          onOpenChange={setControlsFlyoutOpen}
                        >
                          <PopoverTrigger asChild>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              onMouseEnter={() => setControlsFlyoutOpen(true)}
                              onClick={() => navigate(item.url)}
                            >
                              <span>
                                {item.icon} {item.title}
                              </span>
                            </SidebarMenuButton>
                          </PopoverTrigger>
                          <PopoverContent
                            side='right'
                            align='start'
                            sideOffset={8}
                            className='w-56 p-1'
                            onMouseEnter={() => setControlsFlyoutOpen(true)}
                            onMouseLeave={() => setControlsFlyoutOpen(false)}
                          >
                            <div className='px-2 py-1.5 text-xs font-medium text-muted-foreground'>
                              {item.title}
                            </div>
                            <div className='flex flex-col'>
                              {controlViews.map((view) => {
                                const subActive =
                                  currentPath === "/dashboard" &&
                                  dashboardView === view.id;
                                return (
                                  <button
                                    key={view.id}
                                    type='button'
                                    data-active={subActive}
                                    className='flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground'
                                    onClick={() => {
                                      navigate(`/dashboard?view=${view.id}`);
                                      setControlsFlyoutOpen(false);
                                    }}
                                  >
                                    <span className='truncate'>{view.name}</span>
                                  </button>
                                );
                              })}
                              {dashboards.map((db) => {
                                const subActive =
                                  currentPath ===
                                    `/dynamic-dashboard/${db.id}` ||
                                  (currentPath.startsWith(
                                    "/dynamic-dashboard",
                                  ) &&
                                    activeDashboardId === db.id);
                                return (
                                  <button
                                    key={db.id}
                                    type='button'
                                    data-active={subActive}
                                    className='flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground'
                                    onClick={() => {
                                      setActiveDashboard(db.id);
                                      navigate(`/dynamic-dashboard/${db.id}`);
                                      setControlsFlyoutOpen(false);
                                    }}
                                  >
                                    <span className='truncate'>{db.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                        onClick={() => navigate(item.url)}
                      >
                        <span>
                          {item.icon} {item.title}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavFooter
          user={{
            name: "Manager",
            email: "none",
            avatar: "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
