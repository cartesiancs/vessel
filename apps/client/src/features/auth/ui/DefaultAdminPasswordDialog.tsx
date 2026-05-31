import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  authenticateWithPassword,
  fetchAdminUser,
  updateUserPassword,
} from "../api";

type DefaultAdminPasswordDialogProps = {
  open: boolean;
  serverUrl: string;
  onSuccess: (token: string) => void;
};

export function DefaultAdminPasswordDialog({
  open,
  serverUrl,
  onSuccess,
}: DefaultAdminPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmNewPassword) {
      toast.error("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (newPassword === "admin") {
      toast.error("Please choose a password other than the default.");
      return;
    }

    if (!serverUrl) {
      toast.error("Missing server URL. Please reconnect to the server first.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const adminUser = await fetchAdminUser();

      await updateUserPassword(adminUser.id, newPassword);

      const refreshedToken = await authenticateWithPassword(serverUrl, {
        id: adminUser.username,
        password: newPassword,
      });

      setNewPassword("");
      setConfirmNewPassword("");
      toast.success("Password updated. Logging you in with the new password.");
      onSuccess(refreshedToken);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update the admin password.",
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Update Admin Password</DialogTitle>
          <DialogDescription>
            Default admin credentials were used. Please set a new password to
            continue.
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4 py-4'>
          <div className='grid gap-2'>
            <Label htmlFor='new-password'>New password</Label>
            <Input
              id='new-password'
              type='password'
              autoComplete='new-password'
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isUpdatingPassword}
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='confirm-password'>Confirm new password</Label>
            <Input
              id='confirm-password'
              type='password'
              autoComplete='new-password'
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              disabled={isUpdatingPassword}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type='button'
            className='w-full'
            onClick={handlePasswordChange}
            disabled={isUpdatingPassword}
          >
            {isUpdatingPassword ? "Updating..." : "Update password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
