import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Key } from "lucide-react";
import { DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { DeviceTokenManager } from "@/features/device-token";

interface Props {
  deviceId: number;
}

export function DeviceKeyButton({ deviceId }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Key className='mr-2 h-4 w-4' />
          <span>Key</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Access Token</DialogTitle>
          <DialogDescription>
            Manage the permanent access token for this device.
          </DialogDescription>
        </DialogHeader>
        <DeviceTokenManager deviceId={deviceId} />
      </DialogContent>
    </Dialog>
  );
}
