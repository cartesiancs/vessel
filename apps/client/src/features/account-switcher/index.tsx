import * as React from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { useNavigate } from "react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { VesselLogo } from "@/components/icon/Logo";
import { storage, type ServerConnection } from "@/lib/storage";
import { hardNavigateToDashboard } from "@/lib/resetStores";
import { isTauri } from "@/shared/desktop";

function displayName(server: ServerConnection): string {
  if (server.name) return server.name;
  try {
    return new URL(server.url).host;
  } catch {
    return server.url;
  }
}

function useServers() {
  const subscribe = React.useCallback(
    (cb: () => void) => storage.subscribeServers(cb),
    [],
  );
  const servers = React.useSyncExternalStore(
    subscribe,
    () => storage.getServers(),
    () => [],
  );
  const active = React.useSyncExternalStore(
    subscribe,
    () => storage.getActiveServer(),
    () => null,
  );
  return { servers, active };
}

export function AccountSwitcher() {
  const { servers, active } = useServers();
  const navigate = useNavigate();
  const desktop = isTauri();

  const headerLabel = active ? displayName(active) : "main";

  const switchTo = (id: string) => {
    if (active?.id === id) return;
    storage.setActiveServer(id);
    hardNavigateToDashboard();
  };

  const remove = (id: string) => {
    const wasActive = active?.id === id;
    storage.removeServer(id);
    if (wasActive) {
      const remaining = storage.getServers();
      if (remaining.length > 0) {
        hardNavigateToDashboard();
      } else {
        navigate("/auth", { replace: true });
      }
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='bg-background text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center'>
                <VesselLogo />
              </div>
              <div className='flex min-w-0 flex-col gap-0.5 leading-none'>
                <span className='font-medium'>Server</span>
                <span className='truncate text-[12px] text-neutral-400'>
                  {headerLabel}
                </span>
              </div>
              <ChevronsUpDown className='ml-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width)'
            align='start'
          >
            {servers.length === 0 && (
              <DropdownMenuItem disabled>No servers</DropdownMenuItem>
            )}
            {servers.map((server) => {
              const isActive = active?.id === server.id;
              return (
                <DropdownMenuItem
                  key={server.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    switchTo(server.id);
                  }}
                  className='flex items-center gap-2'
                >
                  <span className='flex-1 truncate'>
                    @{displayName(server)}
                  </span>
                  {isActive && <Check className='size-4 shrink-0' />}
                  {!desktop && (
                    <button
                      type='button'
                      aria-label={`Remove ${displayName(server)}`}
                      className='p-0.5 text-muted-foreground hover:text-foreground'
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        remove(server.id);
                      }}
                    >
                      <X className='size-3.5' />
                    </button>
                  )}
                </DropdownMenuItem>
              );
            })}
            {!desktop && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => navigate("/auth?add=1")}
                  className='flex items-center gap-2'
                >
                  <Plus className='size-4' />
                  Add server
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
