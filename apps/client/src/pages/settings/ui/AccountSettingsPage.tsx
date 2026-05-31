import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/breadcrumb";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/ui/sidebar";
import { AppSidebar } from "@/features/sidebar";
import { Separator } from "@/shared/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { useSupabaseAuth } from "@/app/providers/SupabaseAuthContext";
import {
  fetchTurnCredentials,
  clearTurnCache,
  saveTurnConfigToServer,
  getCredentialInfo,
  isTurnCredentialError,
  notifyListeners,
  type TurnCredentialsResponse,
  type TurnUsage,
} from "@/features/rtc";
import { useChatStore } from "@/features/llm-chat";
import { storage } from "@/shared/lib/storage";

function formatTurnQuotaUsage(usage: TurnUsage | null): string | null {
  if (!usage?.quotaBytes) return null;

  const usedGb = (usage.totalBytes / 1024 ** 3).toFixed(2);
  const quotaGb = (usage.quotaBytes / 1024 ** 3).toFixed(2);
  const resetsAt = usage.periodEnd
    ? new Date(usage.periodEnd).toLocaleString()
    : null;

  return resetsAt
    ? `${usedGb} GB / ${quotaGb} GB used. Quota resets ${resetsAt}.`
    : `${usedGb} GB / ${quotaGb} GB used this period.`;
}

export function AccountSettingsPage() {
  const {
    session,
    isLoading: authLoading,
    signInWithGoogle,
    signOut,
  } = useSupabaseAuth();

  const { updateCapsuleUrl } = useChatStore();
  const [capsuleUrl, setCapsuleUrl] = useState(
    storage.getCapsuleUrl() ||
      import.meta.env.VITE_CAPSULE_URL ||
      "http://localhost:3000",
  );
  const [capsuleSaved, setCapsuleSaved] = useState(false);

  const handleSaveCapsuleUrl = () => {
    updateCapsuleUrl(capsuleUrl);
    setCapsuleSaved(true);
    toast.success("Capsule URL updated");
    setTimeout(() => setCapsuleSaved(false), 2000);
  };

  const [turnLoading, setTurnLoading] = useState(false);
  const [turnResult, setTurnResult] = useState<TurnCredentialsResponse | null>(
    null,
  );
  const [turnError, setTurnError] = useState<string | null>(null);
  const [turnErrorUsage, setTurnErrorUsage] = useState<TurnUsage | null>(null);

  const existingCred = getCredentialInfo();
  const isIssued = turnResult
    ? !new Date(turnResult.expiresAt).getTime() ||
      new Date(turnResult.expiresAt).getTime() > Date.now()
    : existingCred !== null && !existingCred.isExpired;
  const isExpired = turnResult
    ? false
    : existingCred !== null && existingCred.isExpired;

  const handleIssueTurn = async () => {
    setTurnLoading(true);
    setTurnError(null);
    setTurnErrorUsage(null);
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
      if (isTurnCredentialError(err)) {
        setTurnError(err.message);
        setTurnErrorUsage(err.usage ?? null);
      } else {
        setTurnError(
          err instanceof Error
            ? err.message
            : "Failed to issue TURN credentials",
        );
      }
    } finally {
      setTurnLoading(false);
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
                <BreadcrumbPage>Account</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <main className='flex-1 overflow-y-auto p-4 md:p-6 space-y-4'>
          <div className='flex flex-col'>
            <h1 className='font-semibold text-lg md:text-2xl'>Account</h1>
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

          <Card>
            <CardHeader>
              <CardTitle>Capsule Server</CardTitle>
              <CardDescription>
                Configure the Capsule AI server URL for chat and image analysis
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='space-y-1'>
                <Label htmlFor='capsule-url'>Capsule Server URL</Label>
                <div className='flex gap-2'>
                  <Input
                    id='capsule-url'
                    placeholder='http://localhost:3000'
                    value={capsuleUrl}
                    onChange={(e) => setCapsuleUrl(e.target.value)}
                  />
                  <Button onClick={handleSaveCapsuleUrl}>
                    {capsuleSaved ? "Saved" : "Save"}
                  </Button>
                </div>
              </div>
              <p className='text-xs text-muted-foreground'>
                Default:{" "}
                {import.meta.env.VITE_CAPSULE_URL || "http://localhost:3000"}
              </p>
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
                      {turnLoading
                        ? "Re-issuing..."
                        : "Re-issue TURN Credentials"}
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
                    <div className='space-y-1'>
                      <span className='text-sm text-red-500'>{turnError}</span>
                      {turnErrorUsage && (
                        <p className='text-xs text-muted-foreground'>
                          {formatTurnQuotaUsage(turnErrorUsage)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {isIssued && (
                  <p className='text-xs text-muted-foreground'>
                    {(turnResult?.iceServers ?? existingCred?.iceServers)
                      ?.length ?? 0}{" "}
                    ICE server(s) cached. Credentials will be applied
                    automatically.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
