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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { AccountSwitcher } from "../account-switcher";
import { useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  MonitorSmartphone,
  Workflow,
  Map,
  CircleDashed,
  Code,
  RadioTower,
  ChevronDown,
  ChevronRight,
  Video,
} from "lucide-react";
import { NavFooter } from "./footer";
import { isElectron } from "@/lib/electron";
import { useDynamicDashboardStore } from "@/entities/dynamic-dashboard/store";
import { useIntegrationStore } from "@/entities/integrations/store";
import { useConfigStore } from "@/entities/configurations/store";
import { getCodeServiceEnabled } from "@/entities/configurations/codeService";
import {
  ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const CONTROLS_OPEN_KEY = "controls-menu-open";
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

  const [controlsOpen, setControlsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const saved = localStorage.getItem(CONTROLS_OPEN_KEY);
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

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
    try {
      localStorage.setItem(CONTROLS_OPEN_KEY, controlsOpen ? "true" : "false");
    } catch {
      // ignore storage write errors
    }
  }, [controlsOpen]);

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
      style={{
        top: isElectron() ? "34px" : "0",
        height: isElectron() ? "calc(100% - 34px)" : "100%",
      }}
    >
      <SidebarHeader>
        <AccountSwitcher />
      </SidebarHeader>
      <SidebarContent ref={scrollRef} onScroll={handleScroll}>
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
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        onClick={() => {
                          if (isControls) {
                            setControlsOpen((prev) => !prev);
                            navigate(item.url);
                          } else {
                            navigate(item.url);
                          }
                        }}
                      >
                        <span>
                          {item.icon} {item.title}
                          {isControls && (
                            <span className='ml-auto flex items-center'>
                              {controlsOpen ? (
                                <ChevronDown className='h-4 w-4 text-muted-foreground' />
                              ) : (
                                <ChevronRight className='h-4 w-4 text-muted-foreground' />
                              )}
                            </span>
                          )}
                        </span>
                      </SidebarMenuButton>

                      {isControls && controlsOpen && (
                        <SidebarMenuSub>
                          {controlViews.map((view) => {
                            const subActive =
                              currentPath === "/dashboard" &&
                              dashboardView === view.id;
                            return (
                              <SidebarMenuSubItem key={view.id}>
                                <SidebarMenuSubButton
                                  isActive={subActive}
                                  onClick={() => {
                                    navigate(`/dashboard?view=${view.id}`);
                                  }}
                                >
                                  <span className='truncate'>{view.name}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                          {dashboards.map((db) => {
                            const subActive =
                              currentPath === `/dynamic-dashboard/${db.id}` ||
                              (currentPath.startsWith("/dynamic-dashboard") &&
                                activeDashboardId === db.id);
                            return (
                              <SidebarMenuSubItem key={db.id}>
                                <SidebarMenuSubButton
                                  isActive={subActive}
                                  onClick={() => {
                                    setActiveDashboard(db.id);
                                    navigate(`/dynamic-dashboard/${db.id}`);
                                  }}
                                >
                                  <span className='truncate'>{db.name}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
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
