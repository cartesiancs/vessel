import { useEffect, useState } from "react";
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
import {
  fetchTurnCredentials,
  clearTurnCache,
  saveTurnConfigToServer,
  getCredentialInfo,
  notifyListeners,
  type TurnCredentialsResponse,
} from "@/features/rtc/turnService";

export function SettingsPage() {
  const { status, isLoading, error, refresh, start, stop } = useTunnelStore();
  const {
    session,
    isLoading: authLoading,
    signInWithGoogle,
    signOut,
  } = useSupabaseAuth();
  const [server, setServer] = useState("");
  const [target, setTarget] = useState("http://127.0.0.1:6174");
  const [localError, setLocalError] = useState<string | null>(null);

  const [turnLoading, setTurnLoading] = useState(false);
  const [turnResult, setTurnResult] = useState<TurnCredentialsResponse | null>(null);
  const [turnError, setTurnError] = useState<string | null>(null);

  const existingCred = getCredentialInfo();
  const isIssued = turnResult
    ? !new Date(turnResult.expiresAt).getTime() || new Date(turnResult.expiresAt).getTime() > Date.now()
    : existingCred !== null && !existingCred.isExpired;
  const isExpired = turnResult
    ? false
    : existingCred !== null && existingCred.isExpired;

  const handleIssueTurn = async () => {
    setTurnLoading(true);
    setTurnError(null);
    setTurnResult(null);
    try {
      clearTurnCache();
      const result = await fetchTurnCredentials();
      await saveTurnConfigToServer({
        iceServers: result.iceServers,
        expiresAt: result.expiresAt,
      });
      setTurnResult(result);
      notifyListeners(result.iceServers);
    } catch (err) {
      setTurnError(err instanceof Error ? err.message : "Failed to issue TURN credentials");
    } finally {
      setTurnLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status.server) setServer(status.server);
    if (status.target) setTarget(status.target);
  }, [status.server, status.target]);

  // const sessionUrl = useMemo(() => {
  //   if (!status.session_id) return null;
  //   if (status.server && status.server.startsWith("ws")) {
  //     try {
  //       const url = new URL(status.server.replace(/^ws/, "http"));
  //       return `${url.protocol}//${status.session_id}.${url.host}`;
  //     } catch {
  //       return null;
  //     }
  //   }
  //   return null;
  // }, [status.session_id, status.server]);

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
      await navigator.clipboard.writeText(status.session_id);
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
              <CardTitle>Vessel Cloud</CardTitle>
              <CardDescription>
                Sign in to connect with Vessel Cloud tunnel servers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {session ? (
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm text-muted-foreground'>
                      Signed in as
                    </span>
                    <span className='font-medium'>{session.user?.email}</span>
                  </div>
                  <Button
                    variant='outline'
                    onClick={signOut}
                    disabled={authLoading}
                  >
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Button onClick={signInWithGoogle} disabled={authLoading}>
                  Sign in with Google
                </Button>
              )}
            </CardContent>
          </Card>

          {session && (
            <Card>
              <CardHeader>
                <CardTitle>TURN Server</CardTitle>
                <CardDescription>
                  Issue Cloudflare TURN credentials for WebRTC relay
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div className='flex items-center gap-3'>
                  {isExpired ? (
                    <Button
                      variant='destructive'
                      onClick={handleIssueTurn}
                      disabled={turnLoading}
                    >
                      {turnLoading ? "Re-issuing..." : "Re-issue TURN Credentials"}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleIssueTurn}
                      disabled={turnLoading || isIssued}
                    >
                      {turnLoading ? "Issuing..." : "Issue TURN Credentials"}
                    </Button>
                  )}
                  {isIssued && (
                    <Badge variant='outline' className='text-green-600'>
                      Issued — expires{" "}
                      {new Date(
                        turnResult?.expiresAt ?? existingCred!.expiresAt,
                      ).toLocaleTimeString()}
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge variant='outline' className='text-red-500'>
                      Expired
                    </Badge>
                  )}
                  {turnError && (
                    <span className='text-sm text-red-500'>{turnError}</span>
                  )}
                </div>
                {isIssued && (
                  <p className='text-xs text-muted-foreground'>
                    {(turnResult?.iceServers ?? existingCred?.iceServers)?.length ?? 0} ICE server(s) cached. Credentials will be applied automatically.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

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
                      Copy session ID
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
