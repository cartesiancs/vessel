import { useEffect, useMemo, useState } from "react";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTunnelStore } from "@/entities/tunnel/store";

export function SettingsPage() {
  const { status, isLoading, error, refresh, start, stop } = useTunnelStore();
  const [server, setServer] = useState("");
  const [target, setTarget] = useState("http://127.0.0.1:3000");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status.server) setServer(status.server);
    if (status.target) setTarget(status.target);
  }, [status.server, status.target]);

  const sessionUrl = useMemo(() => {
    if (!status.session_id) return null;
    if (status.server && status.server.startsWith("ws")) {
      try {
        const url = new URL(status.server.replace(/^ws/, "http"));
        return `${url.protocol}//${status.session_id}.${url.host}`;
      } catch {
        return null;
      }
    }
    return null;
  }, [status.session_id, status.server]);

  const handleToggle = async (checked: boolean) => {
    setLocalError(null);
    if (checked) {
      if (!server || !target) {
        setLocalError("Enter tunnel server URL and target.");
        return;
      }
      try {
        await start(server, target);
      } catch (err) {
        setLocalError(
          err instanceof Error ? err.message : "Failed to start tunnel.",
        );
      }
    } else {
      try {
        await stop();
      } catch (err) {
        setLocalError(
          err instanceof Error ? err.message : "Failed to stop tunnel.",
        );
      }
    }
  };

  const copySession = async () => {
    if (status.session_id) {
      await navigator.clipboard.writeText(status.session_id);
    }
  };

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
                <BreadcrumbPage>Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className='flex-1 overflow-y-auto p-4 md:p-6 space-y-4'>
          <div className='flex flex-col'>
            <h1 className='font-semibold text-lg md:text-2xl'>Settings</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tunnel</CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center justify-between rounded-lg border px-3 py-2'>
                <div className='flex flex-col'>
                  <span className='font-medium'>Tunnel Connection</span>
                </div>
                <Switch
                  checked={status.active}
                  disabled={isLoading}
                  onCheckedChange={handleToggle}
                />
              </div>

              <div className='grid gap-3 md:grid-cols-2'>
                <div className='space-y-1'>
                  <Label htmlFor='server'>
                    Tunnel server URL (wss://…/agent)
                  </Label>
                  <Input
                    id='server'
                    placeholder='wss://tunnel.example.com/agent'
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    disabled={isLoading || status.active}
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='target'>Local target URL</Label>
                  <Input
                    id='target'
                    placeholder='http://127.0.0.1:3000'
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    disabled={isLoading || status.active}
                  />
                </div>
              </div>

              <div className='flex items-center gap-3 flex-wrap'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-muted-foreground'>Session</span>
                  {status.session_id ? (
                    <Badge variant='outline' className='font-mono'>
                      {status.session_id}
                    </Badge>
                  ) : (
                    <Badge variant='secondary'>None</Badge>
                  )}
                </div>
                {status.session_id && (
                  <div className='flex items-center gap-2'>
                    <Button size='sm' variant='outline' onClick={copySession}>
                      Copy session ID
                    </Button>
                    {sessionUrl && (
                      <Badge variant='secondary' className='font-mono'>
                        {sessionUrl}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={refresh}
                  disabled={isLoading}
                >
                  Refresh status
                </Button>
                {(error || localError) && (
                  <span className='text-sm text-red-500'>
                    {localError ?? error}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
