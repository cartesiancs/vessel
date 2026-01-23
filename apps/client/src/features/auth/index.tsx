import { useEffect, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { DEMO_SERVER_URL, DEMO_TOKEN, isDemoMode } from "@/shared/demo";
import { DefaultAdminPasswordDialog } from "./DefaultAdminPasswordDialog";
import { authenticateWithPassword } from "./api";
import { storage } from "@/lib/storage";

const MAX_RECENT_URLS = 5;

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
        toast.success("Connected to server successfully. Please authenticate.");

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

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    await connectToServer(url);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const processedUrl = url.replace(/\/$/, "");

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

  useEffect(() => {
    const token = storage.getToken();
    if (token) {
      navigate("/dashboard");
      return;
    }

    if (isDemoMode) {
      storage.setServerUrl(DEMO_SERVER_URL);
      storage.setToken(DEMO_TOKEN);
      toast.message("Demo mode active", {
        description: "Using mock data without a backend.",
      });
      navigate("/dashboard");
      return;
    }

    const storedUrls = storage.getRecentUrls();
    if (storedUrls.length > 0) {
      setRecentUrls(storedUrls);
    }
  }, [navigate]);

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
            <h1 className='text-xl font-bold'>Vessel</h1>
            <div className='text-center text-sm'>
              Physical Device Orchestration Platform
            </div>
          </div>
          <div className='flex flex-col gap-6'>
            {!showAuthFields ? (
              <div className='grid gap-3'>
                <Label htmlFor='server-url'>Server</Label>
                <Input
                  id='server-url'
                  type='text'
                  placeholder='https://your-server.com'
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isLoading}
                />
                {recentUrls.length > 0 && (
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='text-muted-foreground text-xs'>
                      Recent:
                    </span>
                    {recentUrls.map((recentUrl) => (
                      <Badge
                        key={recentUrl}
                        variant='outline'
                        className='cursor-pointer'
                        onClick={async () => {
                          setUrl(recentUrl);
                          await connectToServer(recentUrl);
                        }}
                      >
                        {recentUrl}
                      </Badge>
                    ))}
                  </div>
                )}
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
            <Button type='submit' className='w-full' disabled={isLoading}>
              {isLoading
                ? "Processing..."
                : showAuthFields
                ? "Connect (Auth)"
                : "Connect"}
            </Button>
          </div>
        </div>
      </form>
      <div className='text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4'>
        This software is managed as an open source and can be found on this{" "}
        <a
          href='https://github.com/cartesiancs/vessel'
          target='_blank'
          rel='noopener noreferrer'
        >
          GitHub
        </a>
        .
      </div>
      <DefaultAdminPasswordDialog
        open={isPasswordDialogOpen}
        serverUrl={serverUrlForDialog}
        onSuccess={(refreshedToken) => {
          storage.setToken(refreshedToken);
          if (serverUrlForDialog) {
            storage.setServerUrl(serverUrlForDialog);
          }
          setIsPasswordDialogOpen(false);
          toast.success("Password updated. Logging you in with the new password.");
          navigate("/dashboard");
        }}
      />
    </div>
  );
}
