import { useEffect, useState } from "react";
import { Copy, Check, Key, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { useDeviceTokenStore } from "@/entities/device-token/store";

interface Props {
  deviceId: number;
}

export function DeviceTokenManager({ deviceId }: Props) {
  const {
    tokenInfo,
    newToken,
    isLoading,
    fetchTokenInfo,
    issueToken,
    revokeToken,
    clearNewToken,
  } = useDeviceTokenStore();
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (deviceId) {
      fetchTokenInfo(deviceId);
    }
  }, [deviceId, fetchTokenInfo]);

  const handleCopy = () => {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Access Token</CardTitle>
          <CardDescription>
            Manage the permanent access token for this device.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {tokenInfo ? (
            <div className='flex items-center justify-between p-3 border rounded-lg'>
              <div>
                <p className='font-semibold'>Token is active</p>
                <p className='text-sm text-muted-foreground'>
                  Created at: {new Date(tokenInfo.created_at).toLocaleString()}
                </p>
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => issueToken(deviceId)}
                  disabled={isLoading}
                >
                  <RefreshCw className='mr-2 h-4 w-4' />
                  Re-issue
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant='destructive'
                      size='sm'
                      disabled={isLoading}
                    >
                      Revoke
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently revoke the access token. The
                        device will no longer be able to connect.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => revokeToken(deviceId)}>
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className='flex items-center justify-between p-3 border rounded-lg bg-muted/50'>
              <div>
                <p className='font-semibold text-muted-foreground'>
                  No active token
                </p>
                <p className='text-sm text-muted-foreground'>
                  Issue a new token to allow this device to connect.
                </p>
              </div>
              <Button onClick={() => issueToken(deviceId)} disabled={isLoading}>
                <Key className='mr-2 h-4 w-4' />
                Issue Token
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!newToken} onOpenChange={() => clearNewToken()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Access Token Generated</DialogTitle>
            <DialogDescription>
              <Badge variant='destructive' className='my-2'>
                <AlertTriangle className='mr-2 h-4 w-4' />
                Store this token securely. It will not be shown again.
              </Badge>
            </DialogDescription>
          </DialogHeader>
          <div className='relative my-4'>
            <pre className='p-4 bg-muted rounded-md font-mono text-sm break-all'>
              {newToken}
            </pre>
            <Button
              size='icon'
              variant='ghost'
              className='absolute top-2 right-2 h-8 w-8'
              onClick={handleCopy}
            >
              {isCopied ? (
                <Check className='h-4 w-4 text-green-500' />
              ) : (
                <Copy className='h-4 w-4' />
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => clearNewToken()}>
              I have copied the token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
