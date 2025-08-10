import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil } from "lucide-react";
import { useEntityStore } from "@/entities/entity/store";
import { Entity, EntityPayload } from "@/entities/entity/types";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  entity: Entity;
}

type EntityFormValues = Omit<EntityPayload, "configuration"> & {
  configuration: string;
};

export function EntityUpdateButton({ entity }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const updateEntity = useEntityStore((state) => state.updateEntity);
  const { register, handleSubmit, control } = useForm<EntityFormValues>({
    defaultValues: {
      entity_id: entity.entity_id,
      device_id: entity.device_id,
      friendly_name: entity.friendly_name ?? "",
      platform: entity.platform ?? "",
      configuration: entity.configuration
        ? JSON.stringify(entity.configuration, null, 2)
        : "",
    },
  });

  const onSubmit = async (data: EntityFormValues) => {
    setJsonError(null);
    let configPayload: string | null = null;

    try {
      if (data.configuration && data.configuration.trim() !== "") {
        configPayload = JSON.parse(data.configuration);
      }
    } catch (error) {
      console.error("Invalid JSON format:", error);
      setJsonError("Invalid JSON format. Please check the syntax.");
      return;
    }

    const finalPayload: EntityPayload = {
      ...data,
      configuration: configPayload,
    };

    await updateEntity(entity.id, finalPayload);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Pencil className='mr-2 h-4 w-4' />
          <span>Edit</span>
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Entity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 py-2'>
          <div className='space-y-2'>
            <Label htmlFor='entity_id_update'>Entity ID</Label>
            <Input
              id='entity_id_update'
              {...register("entity_id", { required: true })}
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='friendly_name_update'>Friendly Name</Label>
            <Input id='friendly_name_update' {...register("friendly_name")} />
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
            <Textarea
              id='configuration_update'
              rows={8}
              placeholder='{ "topic": "home/livingroom/light" }'
              {...register("configuration")}
              className='font-mono text-sm'
            />
            {jsonError && <p className='text-sm text-red-500'>{jsonError}</p>}
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
