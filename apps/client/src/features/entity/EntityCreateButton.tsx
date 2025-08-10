import { useEffect, useState } from "react";
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
import { useDeviceStore } from "@/entities/device/store";
import { useEntityStore } from "@/entities/entity/store";
import { EntityPayload } from "@/entities/entity/types";

export function EntityCreateButton() {
  const [isOpen, setIsOpen] = useState(false);
  const createEntity = useEntityStore((state) => state.createEntity);
  const selectedDevice = useDeviceStore((state) => state.selectedDevice);
  const { register, handleSubmit, reset } = useForm<EntityPayload>();

  useEffect(() => {
    if (isOpen && selectedDevice) {
      reset({
        entity_id: `${selectedDevice.device_id}-`,
        friendly_name: "",
        platform: "",
      });
    }
  }, [isOpen, selectedDevice, reset]);

  const onSubmit = async (data: EntityPayload) => {
    if (!selectedDevice) return;
    const payload = { ...data, device_id: selectedDevice.id };
    await createEntity(payload);
    setIsOpen(false);
  };

  if (!selectedDevice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size='sm'>
          <PlusCircle className='h-4 w-4 mr-2' />
          New Entity
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Entity for {selectedDevice.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 py-2'>
          <div className='space-y-2'>
            <Label htmlFor='entity_id_create'>Entity ID</Label>
            <Input
              id='entity_id_create'
              {...register("entity_id", { required: true })}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='friendly_name_create'>Friendly Name</Label>
            <Input id='friendly_name_create' {...register("friendly_name")} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='platform_create'>Platform</Label>
            <Input id='platform_create' {...register("platform")} />
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
