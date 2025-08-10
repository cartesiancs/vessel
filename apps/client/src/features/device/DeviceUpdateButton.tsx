import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { useDeviceStore } from "@/entities/device/store";
import { Device, DevicePayload } from "@/entities/device/types";

interface Props {
  device: Device;
}

export function DeviceUpdateButton({ device }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const updateDevice = useDeviceStore((state) => state.updateDevice);
  const { register, handleSubmit } = useForm<DevicePayload>({
    defaultValues: {
      device_id: device.device_id,
      name: device.name ?? "",
      manufacturer: device.manufacturer ?? "",
      model: device.model ?? "",
    },
  });

  const onSubmit = async (data: DevicePayload) => {
    await updateDevice(device.id, data);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Button
        asChild
        variant='ghost'
        size='icon'
        onClick={() => setIsOpen(true)}
      >
        <span>
          <Pencil className='h-4 w-4' />
        </span>
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Device</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 py-2'>
          <div className='space-y-2'>
            <Label htmlFor='device_id_edit'>Device ID</Label>
            <Input
              id='device_id_edit'
              {...register("device_id", { required: true })}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='name_edit'>Name</Label>
            <Input id='name_edit' {...register("name")} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='manufacturer_edit'>Manufacturer</Label>
            <Input id='manufacturer_edit' {...register("manufacturer")} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='model_edit'>Model</Label>
            <Input id='model_edit' {...register("model")} />
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type='submit'>Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
