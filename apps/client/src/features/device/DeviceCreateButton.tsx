import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle } from "lucide-react";
import { DevicePayload } from "@/entities/device/types";
import { useDeviceStore } from "@/entities/device/store";

export function DeviceCreateButton() {
  const [isOpen, setIsOpen] = useState(false);
  const createDevice = useDeviceStore((state) => state.createDevice);
  const { register, handleSubmit, reset } = useForm<DevicePayload>();

  const onSubmit = async (data: DevicePayload) => {
    await createDevice(data);
    reset();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size='sm'>
          <PlusCircle className='h-4 w-4 mr-2' />
          New Device
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Device</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 py-2'>
          <div className='space-y-2'>
            <Label htmlFor='device_id'>Device ID</Label>
            <Input
              id='device_id'
              {...register("device_id", { required: true })}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='name'>Name</Label>
            <Input id='name' {...register("name")} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='manufacturer'>Manufacturer</Label>
            <Input id='manufacturer' {...register("manufacturer")} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='model'>Model</Label>
            <Input id='model' {...register("model")} />
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type='submit'>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
