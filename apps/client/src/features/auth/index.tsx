import { useEffect, useState } from "react";
import { toast } from "sonner";
import Cookies from "js-cookie";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";

const RECENT_URLS_COOKIE = "recent_server_urls";
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
  const navigate = useNavigate();

  const connectToServer = async (targetUrl: string) => {
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
        Cookies.set(RECENT_URLS_COOKIE, JSON.stringify(updatedUrls), {
          expires: 365,
        });
        Cookies.set("server_url", processedUrl, { expires: 1 });

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
      const response = await fetch(`${processedUrl}/api/auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, password }),
      });

      if (!response.ok) {
        throw new Error("Wrong ID or password.");
      }

      const data = await response.json();

      if (data.token === "none") {
        throw new Error(
          "Authentication failed. Please check your credentials.",
        );
      }

      if (data.token) {
        Cookies.set("token", data.token, { expires: 1 / 24 });
        Cookies.set("server_url", processedUrl, { expires: 1 / 24 });
        toast.success("Successfully authenticated.");
        navigate("/dashboard");
      } else {
        throw new Error("Failed to authenticate.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to authenticate.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = Cookies.get("token");
    if (token) {
      navigate("/dashboard");
      return;
    }

    const storedUrls = Cookies.get(RECENT_URLS_COOKIE);
    if (storedUrls) {
      try {
        const parsedUrls = JSON.parse(storedUrls);
        if (Array.isArray(parsedUrls)) {
          setRecentUrls(parsedUrls);
        }
      } catch (error) {
        console.error("Failed to parse recent URLs from cookies.", error);
        Cookies.remove(RECENT_URLS_COOKIE);
      }
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
    </div>
  );
}
