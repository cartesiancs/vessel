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
import { Pencil } from "lucide-react";
import { useEntityStore } from "@/entities/entity/store";
import { Entity, EntityPayload } from "@/entities/entity/types";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface Props {
  entity: Entity;
}

export function EntityUpdateButton({ entity }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const updateEntity = useEntityStore((state) => state.updateEntity);
  const { register, handleSubmit } = useForm<EntityPayload>({
    defaultValues: {
      entity_id: entity.entity_id,
      device_id: entity.device_id,
      friendly_name: entity.friendly_name ?? "",
      platform: entity.platform ?? "",
    },
  });

  const onSubmit = async (data: EntityPayload) => {
    await updateEntity(entity.id, data);
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
            <Input id='platform_update' {...register("platform")} />
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
