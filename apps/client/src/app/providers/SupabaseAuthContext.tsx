import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/shared/lib/supabase";

const isTauri = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

type SupabaseAuthContextType = {
  session: Session | null;
  accessToken: string | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextType | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const handleDeepLink = useCallback(async (urls: string[]) => {
    for (const url of urls) {
      if (url.startsWith("vessel://auth/callback")) {
        const hashIndex = url.indexOf("#");
        if (hashIndex === -1) continue;

        const hash = url.slice(hashIndex + 1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Failed to set session:", error);
          } else if (data.session) {
            setSession(data.session);
          }
        }
      }
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    if (isTauri()) {
      import("@tauri-apps/api/event")
        .then(({ listen }) => {
          if (!mounted) return;
          listen<string[]>("deep-link-opened", (event) => {
            handleDeepLink(event.payload);
          })
            .then((fn) => {
              if (mounted) {
                unlisten = fn;
              } else {
                fn();
              }
            })
            .catch((err) => {
              console.error("Failed to listen for deep link:", err);
            });
        })
        .catch((err) => {
          console.error("Failed to import @tauri-apps/api/event:", err);
        });
    }

    return () => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleDeepLink]);

  const signInWithGoogle = useCallback(async () => {
    if (isTauri()) {
      // Tauri: use deep link and open in external browser
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "vessel://auth/callback",
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error("OAuth error:", error);
        return;
      }

      if (data.url) {
        try {
          const { open } = await import("@tauri-apps/plugin-shell");
          await open(data.url);
        } catch (err) {
          console.error("Failed to open URL:", err);
        }
      }
    } else {
      // Web browser: redirect in same window, Supabase handles the callback automatically
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/settings`,
        },
      });

      if (error) {
        console.error("OAuth error:", error);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out error:", error);
    } else {
      setSession(null);
    }
  }, []);

  return (
    <SupabaseAuthContext.Provider
      value={{
        session,
        accessToken: session?.access_token ?? null,
        isLoading,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const context = useContext(SupabaseAuthContext);
  if (!context) {
    throw new Error(
      "useSupabaseAuth must be used within a SupabaseAuthProvider",
    );
  }
  return context;
}
