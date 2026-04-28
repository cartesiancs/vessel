import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router";
import { ArrowRight, Loader2, Trash2 } from "lucide-react";
import { DEMO_SERVER_URL, DEMO_TOKEN, isDemoMode } from "@/shared/demo";
import { DefaultAdminPasswordDialog } from "./DefaultAdminPasswordDialog";
import { authenticateWithPassword } from "./api";
import { storage } from "@/lib/storage";
import { parseJwt } from "@/lib/jwt";
import {
  ensureSidecarRunning,
  getDesktopServerUrl,
  isTauri,
  openDesktopSettings,
} from "@/shared/desktop";

const MAX_RECENT_URLS = 5;

function sanitizeServerUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim().replace(/\/$/, "");

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [url, setUrl] = useState("");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showAuthFields, setShowAuthFields] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [serverUrlForDialog, setServerUrlForDialog] = useState("");
  const [isTauriClient] = useState<boolean>(() => isTauri());
  const [isResolvingDesktop, setIsResolvingDesktop] = useState<boolean>(() =>
    isTauri(),
  );
  const [desktopError, setDesktopError] = useState<string | null>(null);
  const navigate = useNavigate();

  const connectToServer = async (targetUrl: string) => {
    if (isDemoMode) {
      storage.setServerUrl(DEMO_SERVER_URL);
      storage.setToken(DEMO_TOKEN);
      toast.success("Demo mode enabled. Loading demo dashboard...");
      navigate("/dashboard");
      return;
    }

    if (!targetUrl) {
      toast.error("Server URL cannot be empty.");
      return;
    }
    setIsLoading(true);
    const processedUrl = targetUrl.replace(/\/$/, "");

    try {
      const response = await fetch(`${processedUrl}/info`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed.");
      }

      const data = await response.json();

      if (
        data.code === 200 &&
        data.id === "vessel-server" &&
        data.status === "success"
      ) {
        toast.success("Connected to server successfully.");

        const updatedUrls = [
          processedUrl,
          ...recentUrls.filter((u) => u !== processedUrl),
        ].slice(0, MAX_RECENT_URLS);

        setRecentUrls(updatedUrls);
        storage.setRecentUrls(updatedUrls);
        storage.setServerUrl(processedUrl);

        setServerUrlForDialog(processedUrl);
        setShowAuthFields(true);
      } else {
        throw new Error("Failed to connect to the server.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to connect to the server.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const removeRecentUrl = (toRemove: string) => {
    const updated = recentUrls.filter((u) => u !== toRemove);
    setRecentUrls(updated);
    storage.setRecentUrls(updated);
    const normalized = url.replace(/\/$/, "");
    if (normalized === toRemove) {
      setUrl("");
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    await connectToServer(url);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const processedUrl = sanitizeServerUrl(url);

    if (!processedUrl) {
      toast.error("Please enter a valid server URL using http or https.");
      setIsLoading(false);
      return;
    }

    try {
      const token = await authenticateWithPassword(processedUrl, {
        id,
        password,
      });

      storage.setToken(token);
      storage.setServerUrl(processedUrl);

      setServerUrlForDialog(processedUrl);

      if (id === "admin" && password === "admin") {
        setIsPasswordDialogOpen(true);
        toast.message("Default admin password detected", {
          description: "Please change the password before continuing.",
        });
        return;
      }

      toast.success("Successfully authenticated.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to authenticate.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const bootstrapDesktop = async () => {
    setDesktopError(null);
    setIsResolvingDesktop(true);
    try {
      // Make sure the sidecar is running, then ask Rust for its base URL.
      await ensureSidecarRunning();
      let baseUrl: string | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        baseUrl = await getDesktopServerUrl();
        if (baseUrl) break;
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!baseUrl) {
        baseUrl = storage.getServerUrl();
      }
      if (!baseUrl) {
        setDesktopError(
          "Could not reach the local Vessel server. Open the tray menu \u2192 Server Settings\u2026 to configure it.",
        );
        return;
      }
      storage.setServerUrl(baseUrl);
      setUrl(baseUrl);
      setShowAuthFields(true);
    } finally {
      setIsResolvingDesktop(false);
    }
  };

  useEffect(() => {
    if (isDemoMode) {
      storage.setServerUrl(DEMO_SERVER_URL);
      storage.setToken(DEMO_TOKEN);
      toast.message("Demo mode active", {
        description: "Using mock data without a backend.",
      });
      navigate("/dashboard");
      return;
    }

    const token = storage.getToken();
    const serverUrl = storage.getServerUrl();

    if (token && serverUrl) {
      const parsed = parseJwt(token);
      if (!parsed?.exp) {
        storage.removeToken();
      } else {
        const now = new Date();
        const exp = new Date(parsed.exp * 1000);
        if (now.getTime() >= exp.getTime()) {
          storage.removeToken();
        } else {
          navigate("/dashboard");
          return;
        }
      }
    }

    if (isTauriClient) {
      void bootstrapDesktop();
      return;
    }

    const storedUrls = storage.getRecentUrls();
    if (storedUrls.length > 0) {
      setRecentUrls(storedUrls);
    }
  }, [navigate, isTauriClient]);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={showAuthFields ? handleAuth : handleConnect}>
        <div className='flex flex-col gap-6'>
          <div className='flex flex-col items-center gap-2'>
            <a
              href='#'
              className='flex flex-col items-center gap-2 font-medium'
            >
              <div className='flex size-12 items-center justify-center rounded-md'>
                <img src='/icon.png' />
              </div>
            </a>
            {/* <h1 className='text-xl font-bold'>Vessel</h1>
            <div className='text-center text-sm'>
              Physical Device Orchestration Platform
            </div> */}
          </div>
          <div className='flex flex-col gap-6'>
            {isTauriClient && isResolvingDesktop ? (
              <div className='flex flex-col items-center gap-2 text-sm text-muted-foreground'>
                <Loader2 className='size-5 animate-spin' />
                Connecting to local server...
              </div>
            ) : isTauriClient && desktopError ? (
              <div className='flex flex-col gap-3'>
                <p className='text-sm text-red-300'>{desktopError}</p>
                <div className='flex gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    className='flex-1'
                    onClick={() => void bootstrapDesktop()}
                  >
                    Retry
                  </Button>
                  <Button
                    type='button'
                    variant='secondary'
                    className='flex-1'
                    onClick={() => void openDesktopSettings()}
                  >
                    Server Settings
                  </Button>
                </div>
              </div>
            ) : !showAuthFields ? (
              <div className='grid gap-3'>
                {/* <Label htmlFor='server-url'>Server</Label> */}
                <div className='flex w-full gap-2'>
                  <Input
                    id='server-url'
                    type='text'
                    placeholder='https://your-server.com'
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isLoading}
                    className='flex-1'
                  />
                  <Button
                    type='submit'
                    size='icon'
                    disabled={isLoading}
                    aria-label='Connect'
                    className='shrink-0'
                  >
                    {isLoading ? (
                      <Loader2 className='size-4 animate-spin' />
                    ) : (
                      <ArrowRight className='size-4' />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className='grid gap-3'>
                  <Label htmlFor='id'>ID</Label>
                  <Input
                    id='id'
                    type='text'
                    placeholder='admin'
                    required
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className='grid gap-3'>
                  <Label htmlFor='password'>Password</Label>
                  <Input
                    id='password'
                    type='password'
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </>
            )}
            {!(isTauriClient && (isResolvingDesktop || desktopError)) &&
              showAuthFields && (
                <Button type='submit' className='w-full' disabled={isLoading}>
                  {isLoading ? "Processing..." : "Auth"}
                </Button>
              )}
          </div>

          {!isTauriClient && recentUrls.length > 0 && !showAuthFields && (
            <div className='flex w-full flex-col gap-2 pt-4'>
              {recentUrls.map((recentUrl) => (
                <div key={recentUrl} className='flex w-full gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={async () => {
                      setUrl(recentUrl);
                      await connectToServer(recentUrl);
                    }}
                    className='min-w-0 flex-1 justify-start truncate text-left text-xs'
                    size='sm'
                  >
                    {recentUrl}
                  </Button>
                  <Button
                    type='button'
                    variant='link'
                    size='icon'
                    className='size-8 shrink-0 text-muted-foreground'
                    onClick={() => removeRecentUrl(recentUrl)}
                    aria-label={`Remove ${recentUrl} from recent servers`}
                  >
                    <Trash2 className='size-4' />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </form>
      {/* <div className='text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4'>
        This software is managed as an open source and can be found on this{" "}
        <a
          href='https://github.com/cartesiancs/vessel'
          target='_blank'
          rel='noopener noreferrer'
        >
          GitHub
        </a>
        .
      </div> */}
      <DefaultAdminPasswordDialog
        open={isPasswordDialogOpen}
        serverUrl={serverUrlForDialog}
        onSuccess={(refreshedToken) => {
          storage.setToken(refreshedToken);
          if (serverUrlForDialog) {
            storage.setServerUrl(serverUrlForDialog);
          }
          setIsPasswordDialogOpen(false);
          toast.success(
            "Password updated. Logging you in with the new password.",
          );
          navigate("/dashboard");
        }}
      />
    </div>
  );
}
