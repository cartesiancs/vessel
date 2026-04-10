import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
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
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type SubscriptionStatus = "loading" | "active" | "pending" | "error";

const MAX_POLLS = 10;
const POLL_INTERVAL = 2000;

export default function CheckoutSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>("loading");

  const checkoutId = searchParams.get("checkout_id");
  const pollCountRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);

  const checkSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error checking subscription:", error);
        setStatus("error");
        return;
      }

      if (data) {
        setStatus("active");
        return;
      }

      pollCountRef.current += 1;

      if (pollCountRef.current < MAX_POLLS) {
        timeoutRef.current = window.setTimeout(
          checkSubscription,
          POLL_INTERVAL,
        );
      } else {
        setStatus("pending");
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setStatus("error");
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    pollCountRef.current = 0;
    checkSubscription();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, authLoading, navigate]);

  const handleRetry = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    pollCountRef.current = 0;
    setStatus("loading");
    checkSubscription();
  };

  if (authLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className='min-h-screen pt-20 px-4'>
        <div className='max-w-lg mx-auto mt-16'>
          <Card className='bg-black'>
            <CardHeader className='text-center'>
              {status === "loading" && (
                <>
                  <div className='flex justify-center mb-4'>
                    <Loader2 className='h-12 w-12 animate-spin text-primary' />
                  </div>
                  <CardTitle className='text-2xl'>
                    Processing your subscription
                  </CardTitle>
                  <CardDescription>
                    Please wait while we confirm your payment...
                  </CardDescription>
                </>
              )}

              {status === "active" && (
                <>
                  <div className='flex justify-center mb-4'>
                    <CheckCircle2 className='h-12 w-12 text-green-500' />
                  </div>
                  <CardTitle className='text-2xl'>
                    Subscription activated!
                  </CardTitle>
                  <CardDescription>
                    Thank you for subscribing to Vessel Pro
                  </CardDescription>
                </>
              )}

              {status === "pending" && (
                <>
                  <div className='flex justify-center mb-4'>
                    <Loader2 className='h-12 w-12 text-yellow-500' />
                  </div>
                  <CardTitle className='text-2xl'>
                    Payment is being processed
                  </CardTitle>
                  <CardDescription>
                    Your subscription will be activated shortly. You can check
                    your status in the dashboard.
                  </CardDescription>
                </>
              )}

              {status === "error" && (
                <>
                  <div className='flex justify-center mb-4'>
                    <XCircle className='h-12 w-12 text-red-500' />
                  </div>
                  <CardTitle className='text-2xl'>
                    Something went wrong
                  </CardTitle>
                  <CardDescription>
                    We couldn't verify your subscription. Please contact support
                    if this issue persists.
                  </CardDescription>
                </>
              )}
            </CardHeader>
            <CardContent className='space-y-4'>
              {checkoutId && (
                <p className='text-xs text-center text-muted-foreground'>
                  Checkout ID: {checkoutId}
                </p>
              )}

              <div className='flex flex-col gap-3'>
                <Button
                  onClick={() => navigate("/dashboard")}
                  className='w-full'
                >
                  Go to Dashboard
                </Button>
                {(status === "pending" || status === "error") && (
                  <Button
                    variant='outline'
                    onClick={handleRetry}
                    className='w-full'
                  >
                    Check again
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
