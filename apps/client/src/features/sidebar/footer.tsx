import {
  ChevronsUpDown,
  Computer,
  LogOut,
  MessageSquareWarning,
  User,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLogout } from "../auth/hook";
import { useEffect, useState } from "react";
import { parseJwt } from "@/lib/jwt";
import { isDemoMode } from "@/shared/demo";
import { storage } from "@/lib/storage";

const openExternal = (url: string) => {
  import("@tauri-apps/plugin-shell")
    .then(({ open }) => open(url))
    .catch(() => window.open(url, "_blank", "noopener,noreferrer"));
};

export function NavFooter({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const { logout } = useLogout();
  const [userId, setUserId] = useState<string>(isDemoMode ? "demo" : "");

  useEffect(() => {
    if (isDemoMode) return;
    const token = storage.getToken();
    if (token) {
      const parse = parseJwt(token);
      if (parse?.sub && typeof parse.sub === "string") {
        setUserId(parse.sub);
      }
    }
  }, []);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <Avatar className='h-8 w-8 '>
                <AvatarFallback className=''>
                  <User />
                </AvatarFallback>
              </Avatar>
              <div className='grid flex-1 text-left text-sm leading-tight'>
                <span className='truncate font-medium'>{userId}</span>
                <span className='truncate text-xs'>{user.email}</span>
              </div>
              <ChevronsUpDown className='ml-auto size-4' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-56  z-[999999]'
            side={isMobile ? "bottom" : "right"}
            align='end'
            sideOffset={4}
          >
            <DropdownMenuLabel className='p-0 font-normal'>
              <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
                <Avatar className='h-8 w-8 '>
                  <AvatarImage src={user.avatar} alt={userId} />
                  <AvatarFallback className=''>
                    <User />
                  </AvatarFallback>
                </Avatar>
                <div className='grid flex-1 text-left text-sm leading-tight'>
                  <span className='truncate font-medium'>{userId}</span>
                  <span className='truncate text-xs'>{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() =>
                  openExternal("https://github.com/cartesiancs/vessel")
                }
              >
                <Computer />
                GitHub
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  openExternal("https://github.com/cartesiancs/vessel/issues")
                }
              >
                <MessageSquareWarning />
                Report
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
