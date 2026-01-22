import { useState } from "react";
import { useNavigate } from "react-router";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

const proFeatures = [
  "Remote Tunnel",
  "Secure Option",
  "Streaming Server (10GB)",
  "Custom Flow",
  "Advanced data sources",
  "1:1 support",
  "Priority access to new features",
];

const freeFeatures = [
  "Self Host",
  "Core Flow",
  "Realtime device orchestration",
  "Community support",
  "GitHub updates",
];

const enterpriseHighlights = [
  "Scope and pricing aligned to your requirements",
  "Security and infrastructure architecture designed together",
  "Dedicated onboarding and ongoing partnership",
];

function PricingPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleProCheckout = async () => {
    if (authLoading) return;

    if (!user) {
      toast.error("Please sign in to subscribe");
      navigate("/login");
      return;
    }

    const productId = import.meta.env.VITE_POLAR_PRO_PRODUCT_ID;
    if (!productId) {
      toast.error("Product configuration is missing");
      return;
    }

    setCheckoutLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: { productId },
        }
      );

      if (error) {
        toast.error(error.message || "Failed to create checkout session");
        return;
      }

      const url = data?.url as string | undefined;
      if (!url) {
        toast.error("Failed to get checkout URL");
        return;
      }

      window.location.assign(url);
    } catch (err) {
      toast.error("An unexpected error occurred");
      console.error("Checkout error:", err);
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background text-foreground">
        <section className="container mx-auto max-w-5xl px-4 pt-24 pb-16 md:pt-28 md:pb-24">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Pricing
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Start Vessel with transparent pricing and tailored support for any
              team size.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:mt-16 md:grid-cols-3">
            <Card className="h-full">
              <CardHeader className="pb-0 space-y-4">
                <CardTitle className="text-xl font-semibold">Free</CardTitle>
                <div className="space-y-1">
                  <div className="text-5xl font-extrabold leading-none">$0</div>
                  <p className="text-sm text-muted-foreground">Per month</p>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-5">
                <ul className="space-y-3 text-base">
                  {freeFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center text-primary">
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="text-base text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button
                  className="h-11 w-full text-base"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      "https://github.com/cartesiancs/vessel",
                      "_blank"
                    )
                  }
                >
                  Start for free
                </Button>
              </CardFooter>
            </Card>

            <Card className="border-primary/15 shadow-lg shadow-primary/5 h-full">
              <CardHeader className="pb-0 space-y-4">
                <CardTitle className="text-xl font-semibold">Pro</CardTitle>
                <div className="space-y-1">
                  <div className="text-5xl font-extrabold leading-none">
                    $21
                  </div>
                  <p className="text-sm text-muted-foreground">Per month</p>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-5">
                <ul className="space-y-3 text-base">
                  {proFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center text-primary">
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="text-base text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button
                  className="h-11 w-full text-base"
                  onClick={handleProCheckout}
                  disabled={checkoutLoading || authLoading}
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    "Continue with Pro"
                  )}
                </Button>
              </CardFooter>
            </Card>

            <Card className="border-primary/15 shadow-lg shadow-primary/5 h-full">
              <CardHeader className="pb-0 space-y-4">
                <CardTitle className="text-xl font-semibold">
                  Enterprise
                </CardTitle>
                <div className="space-y-1">
                  <div className="text-5xl font-extrabold leading-none">
                    Custom
                  </div>
                  <p className="text-sm text-muted-foreground">Per month</p>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-5">
                <ul className="space-y-3 text-base text-white">
                  {enterpriseHighlights.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center text-primary">
                        <Check className="h-4 w-4" />
                      </span>
                      <span className="text-base text-muted-foreground">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button
                  className="h-11 w-full text-base"
                  variant="ghost"
                  onClick={() => {
                    window.location.href = "mailto:info@cartesiancs.com";
                  }}
                >
                  Contact Us
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default PricingPage;
