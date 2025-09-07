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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JsonCodeEditor } from "../json/JsonEditor";
import { EntitySelectTypes } from "./SelectTypes";
import { EntitySelectPlatforms } from "./SelectPlatforms";
import { toast } from "sonner";

export function EntityCreateButton() {
  const [isOpen, setIsOpen] = useState(false);
  const createEntity = useEntityStore((state) => state.createEntity);
  const selectedDevice = useDeviceStore((state) => state.selectedDevice);
  const { register, handleSubmit, reset, watch, control, setValue } =
    useForm<EntityPayload>();

  const entityId = watch("entity_id");

  useEffect(() => {
    if (isOpen && selectedDevice) {
      reset({
        entity_id: `${selectedDevice.device_id}-`,
        friendly_name: "",
        platform: "",
        configuration: "",
        entity_type: "",
      });
    }
  }, [isOpen, selectedDevice, reset]);

  useEffect(() => {
    if (entityId) {
      const friendlyName = entityId
        .split("-")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      setValue("friendly_name", friendlyName);
    }
  }, [entityId, setValue]);

  useEffect(() => {
    if (entityId && entityId.includes(" ")) {
      setValue("entity_id", entityId.replace(/ /g, "-"));
    }
  }, [entityId, setValue]);

  const onSubmit = async (data: EntityPayload) => {
    if (!selectedDevice) return;
    let configPayload: string | null = null;

    try {
      if (data.configuration && data.configuration.trim() !== "") {
        configPayload = JSON.parse(data.configuration);
      }
    } catch (error) {
      console.error("Invalid JSON format:", error);
      toast("Invalid JSON format. Please check the syntax.");

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
            <Label htmlFor='platform_update'>Platform (Protocol)</Label>
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
                    <EntitySelectPlatforms />
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='entity_type'>Type</Label>
            <Controller
              control={control}
              name='entity_type'
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value ?? ""}
                >
                  <SelectTrigger id='entity_type' className='w-full'>
                    <SelectValue placeholder='Select a type' />
                  </SelectTrigger>
                  <SelectContent className='w-full'>
                    <EntitySelectTypes />
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
