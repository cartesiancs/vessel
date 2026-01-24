import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle2, Crown, User } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setSubscriptionLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from("billing_subscriptions")
          .select("status")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        setIsSubscribed(!!data);
      } catch (err) {
        console.error("Error checking subscription:", err);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    if (!loading && user) {
      checkSubscription();
    }
  }, [user, loading]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background'>
        <p className='text-muted-foreground'>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Navbar />
      <main className='min-h-screen bg-background pt-20 px-4'>
        <div className='max-w-4xl mx-auto'>
          <div className='flex items-center justify-between mb-8'>
            <h1 className='text-3xl font-bold'>Dashboard</h1>
            <Button
              variant='outline'
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Signing out...
                </>
              ) : (
                "Sign Out"
              )}
            </Button>
          </div>

          <div className='grid gap-6 md:grid-cols-2'>
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Your account information</CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {user.user_metadata?.avatar_url && !avatarError ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt='Profile'
                    className='w-16 h-16 rounded-full'
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className='w-16 h-16 rounded-full bg-muted flex items-center justify-center'>
                    <User className='w-8 h-8 text-muted-foreground' />
                  </div>
                )}
                <div>
                  <p className='text-sm text-muted-foreground'>Name</p>
                  <p className='font-medium'>
                    {user.user_metadata?.full_name || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className='text-sm text-muted-foreground'>Email</p>
                  <p className='font-medium'>{user.email}</p>
                </div>
                <div>
                  <p className='text-sm text-muted-foreground'>User ID</p>
                  <p className='font-mono text-sm text-muted-foreground'>
                    {user.id}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
                <CardDescription>Your current plan</CardDescription>
              </CardHeader>
              <CardContent>
                {subscriptionLoading ? (
                  <div className='flex items-center gap-2 text-muted-foreground'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    <span>Checking subscription...</span>
                  </div>
                ) : isSubscribed ? (
                  <div className='flex items-center gap-3'>
                    <div>
                      <p className='font-semibold flex items-center gap-2'>
                        Pro Plan
                        <CheckCircle2 className='h-4 w-4 text-green-500' />
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        Active subscription
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className='space-y-3'>
                    <p className='text-muted-foreground'>
                      You are currently on the Free plan.
                    </p>
                    <Button
                      variant='outline'
                      className='w-full'
                      onClick={() => navigate("/pricing")}
                    >
                      Upgrade to Pro
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
                <CardDescription>Useful resources</CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                <Button
                  variant='outline'
                  className='w-full justify-start'
                  onClick={() => window.open("/docs/introduction", "_blank")}
                >
                  Documentation
                </Button>
                <Button
                  variant='outline'
                  className='w-full justify-start'
                  onClick={() =>
                    window.open(
                      "https://github.com/cartesiancs/vessel",
                      "_blank",
                    )
                  }
                >
                  GitHub Repository
                </Button>
                <Button
                  variant='outline'
                  className='w-full justify-start'
                  onClick={() => navigate("/pricing")}
                >
                  Pricing Plans
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
