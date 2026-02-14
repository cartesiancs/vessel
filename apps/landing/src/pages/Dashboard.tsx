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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, CheckCircle2, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cancelSubscription } from "@/lib/billing";
import { toast } from "sonner";
import { useUsageData } from "@/hooks/useUsageData";
import { UsageCharts } from "@/components/UsageCharts";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const { data: usageData, loading: usageLoading } = useUsageData(user);

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
          .select("status, cancel_at_period_end, current_period_end")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        setIsSubscribed(!!data);
        if (data) {
          setCancelAtPeriodEnd(data.cancel_at_period_end ?? false);
          setCurrentPeriodEnd(data.current_period_end ?? null);
        }
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

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in again to cancel your subscription");
        return;
      }

      await cancelSubscription(session.access_token);
      toast.success("Subscription cancelled successfully");
      setIsSubscribed(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel subscription",
      );
    } finally {
      setCancelLoading(false);
    }
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
                  <div className='space-y-4'>
                    <div className='flex items-center gap-3'>
                      <div>
                        <p className='font-semibold flex items-center gap-2'>
                          Pro Plan
                          {cancelAtPeriodEnd ? (
                            <span className='text-xs font-normal text-amber-500'>
                              Cancelling
                            </span>
                          ) : (
                            <CheckCircle2 className='h-4 w-4 text-green-500' />
                          )}
                        </p>
                        <p className='text-sm text-muted-foreground'>
                          {cancelAtPeriodEnd && currentPeriodEnd
                            ? `Ends on ${new Date(currentPeriodEnd).toLocaleDateString()}`
                            : "Active subscription"}
                        </p>
                      </div>
                    </div>
                    {cancelAtPeriodEnd ? (
                      <p className='text-sm text-amber-500'>
                        Your subscription will be cancelled at the end of the current billing period.
                      </p>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant='outline'
                            className='w-full text-destructive hover:text-destructive'
                            disabled={cancelLoading}
                          >
                            {cancelLoading ? (
                              <>
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                Cancelling...
                              </>
                            ) : (
                              "Cancel Subscription"
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Cancel Subscription
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel your subscription?
                              You will lose access to Pro features at the end of
                              the current billing period.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              Keep Subscription
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleCancelSubscription}
                            className='bg-red-500 text-white hover:bg-destructive/90'
                          >
                            Yes, Cancel
                          </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
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

          <div className='mt-8'>
            <h2 className='text-2xl font-bold mb-6'>Usage</h2>
            <UsageCharts data={usageData} loading={usageLoading} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
