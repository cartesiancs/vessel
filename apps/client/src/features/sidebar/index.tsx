import * as React from "react";

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
  SidebarRail,
} from "@/components/ui/sidebar";
import { AccountSwitcher } from "../account-switcher";
import { useLocation, useNavigate } from "react-router";
import {
  Key,
  LayoutDashboard,
  MonitorSmartphone,
  ScrollText,
  Server,
  UserCog,
  Workflow,
  Map,
  Blocks,
  CircleDashed,
} from "lucide-react";
import { NavFooter } from "./footer";
import { isElectron } from "@/lib/electron";

const data = {
  versions: ["main"],
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
          title: "Servers",
          url: "/servers",
          icon: <Server />,
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
          title: "Key Manager",
          url: "/key",
          icon: <Key />,
        },
        {
          title: "Devices",
          url: "/devices",
          icon: <MonitorSmartphone />,
        },
      ],
    },
    {
      title: "Setting",
      url: "#",
      items: [
        {
          title: "Users",
          url: "/users",
          icon: <UserCog />,
        },
        {
          title: "Integration",
          url: "/integration",
          icon: <Blocks />,
        },
        {
          title: "Setup",
          url: "/setup",
          icon: <CircleDashed />,
        },
        {
          title: "Logs",
          url: "/log",
          icon: <ScrollText />,
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const currentPath = location.pathname;
  const navigate = useNavigate();

  return (
    <Sidebar
      {...props}
      style={{
        top: isElectron() ? "34px" : "0",
        height: isElectron() ? "calc(100% - 34px)" : "100%",
      }}
    >
      <SidebarHeader>
        <AccountSwitcher
          versions={data.versions}
          defaultVersion={data.versions[0]}
        />
      </SidebarHeader>
      <SidebarContent>
        {data.navMain.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = currentPath === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
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
