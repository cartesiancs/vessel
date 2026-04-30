import { useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
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
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import { useConfigStore } from "@/entities/configurations/store";
import {
  CODE_SERVICE_CONFIG_KEY,
  getCodeServiceEnabled,
} from "@/entities/configurations/codeService";

export function ServicesSettingsPage() {
  const { status, isLoading, error, refresh, start, stop } = useTunnelStore();
  const { session } = useSupabaseAuth();
  const [server, setServer] = useState(
    "wss://agent.tunnel.cartesiancs.com/agent",
  );
  const [target, setTarget] = useState("http://127.0.0.1:6174");
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    configurations,
    fetchConfigs,
    createConfig,
    updateConfig,
    isLoading: configsLoading,
  } = useConfigStore();
  const codeConfigRow = configurations.find(
    (c) => c.key === CODE_SERVICE_CONFIG_KEY,
  );
  const codeServiceEnabled = getCodeServiceEnabled(configurations);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status.server) setServer(status.server);
    if (status.target) setTarget(status.target);
  }, [status.server, status.target]);

  const handleCodeServiceToggle = async (on: boolean) => {
    try {
      if (codeConfigRow) {
        await updateConfig(codeConfigRow.id, {
          key: codeConfigRow.key,
          value: codeConfigRow.value,
          enabled: on ? 1 : 0,
          description: codeConfigRow.description,
        });
      } else if (on) {
        await createConfig({
          key: CODE_SERVICE_CONFIG_KEY,
          value: "1",
          enabled: 1,
          description: "Enable the Code workspace (file browser and editor).",
        });
      }
      toast.success(on ? "Code workspace enabled" : "Code workspace disabled");
    } catch {
      toast.error("Failed to update Code workspace setting");
    }
  };

  const handleToggle = async (checked: boolean) => {
    setLocalError(null);
    if (checked) {
      if (!server || !target) {
        setLocalError("Enter tunnel server URL and target.");
        return;
      }
      try {
        await start(server, target, session?.access_token);
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
      const url = `https://${status.session_id}.tunnel.cartesiancs.com/auth`;
      await navigator.clipboard.writeText(url);
      toast.success("Tunnel URL copied", {
        description: url,
      });
    }
  };

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
                <BreadcrumbLink asChild>
                  <Link to='/settings'>Settings</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Services</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className='flex-1 overflow-y-auto p-4 md:p-6 space-y-4'>
          <div className='flex flex-col'>
            <h1 className='font-semibold text-lg md:text-2xl'>Services</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Code workspace</CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent>
              <div className='flex items-center justify-between border px-3 py-2'>
                <div className='flex flex-col gap-0.5'>
                  <span className='font-medium'>Code service</span>
                </div>
                <Switch
                  checked={codeServiceEnabled}
                  disabled={configsLoading}
                  onCheckedChange={(v) => void handleCodeServiceToggle(v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tunnel</CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center justify-between border px-3 py-2'>
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
                    placeholder='http://127.0.0.1:6174'
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
                      Copy tunnel URL
                    </Button>
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
