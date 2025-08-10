import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JsonCodeEditor } from "../json/JsonEditor";

export function EntityCreateButton() {
  const [isOpen, setIsOpen] = useState(false);
  const createEntity = useEntityStore((state) => state.createEntity);
  const selectedDevice = useDeviceStore((state) => state.selectedDevice);
  const { register, handleSubmit, reset, control } = useForm<EntityPayload>();

  useEffect(() => {
    if (isOpen && selectedDevice) {
      reset({
        entity_id: `${selectedDevice.device_id}-`,
        friendly_name: "",
        platform: "",
        configuration: "",
      });
    }
  }, [isOpen, selectedDevice, reset]);

  const onSubmit = async (data: EntityPayload) => {
    if (!selectedDevice) return;
    let configPayload: string | null = null;

    try {
      if (data.configuration && data.configuration.trim() !== "") {
        configPayload = JSON.parse(data.configuration);
      }
    } catch (error) {
      console.error("Invalid JSON format:", error);
      return;
    }

    const payload = {
      ...data,
      device_id: selectedDevice.id,
      configuration: configPayload,
    };

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
            <Label htmlFor='platform_update'>Platform</Label>
            <Controller
              control={control}
              name='platform'
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value ?? ""}
                >
                  <SelectTrigger id='platform_update' className='w-full'>
                    <SelectValue placeholder='Select a platform' />
                  </SelectTrigger>
                  <SelectContent className='w-full'>
                    <SelectItem value='MQTT'>MQTT</SelectItem>
                    <SelectItem value='UDP'>UDP</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='configuration_update'>Configuration (JSON)</Label>
            <Controller
              control={control}
              name='configuration'
              render={({ field }) => (
                <JsonCodeEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              )}
            />
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
