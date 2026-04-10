import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FcGoogle } from "react-icons/fc";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, signInWithGoogle } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  const handleSignIn = async () => {
    setSigningIn(true);
    await signInWithGoogle();
  };

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-background'>
        <p className='text-muted-foreground'>Loading...</p>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-background px-4'>
      <Card className='w-full max-w-md bg-black py-10'>
        <CardHeader className='text-center'>
          <div className='flex justify-center mb-4'>
            <img src='/icon.png' alt='Logo' className='w-12 invert' />
          </div>
          <CardTitle className='text-2xl'>Welcome to Vessel</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant='outline'
            className='w-full'
            size='lg'
            onClick={handleSignIn}
            disabled={signingIn}
          >
            {signingIn ? (
              <>
                <Loader2 className='mr-2 h-5 w-5 animate-spin' />
                Signing in...
              </>
            ) : (
              <>
                <FcGoogle className='mr-2 h-5 w-5' />
                Continue with Google
              </>
            )}
          </Button>
          <p className='text-center text-sm text-muted-foreground mt-6'>
            By signing in, you agree to our{" "}
            <a
              href='/privacy-policy'
              className='underline hover:text-foreground'
            >
              Privacy Policy
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
