import { useState } from "react";
import { useForm } from "react-hook-form";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useConfigStore } from "@/entities/configurations/store";
import {
  SystemConfiguration,
  SystemConfigurationPayload,
} from "@/entities/configurations/types";

interface Props {
  config: SystemConfiguration;
}

export function ConfigurationActionButton({ config }: Props) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { updateConfig, deleteConfig } = useConfigStore();

  const { register, handleSubmit } = useForm<SystemConfigurationPayload>({
    defaultValues: {
      key: config.key,
      value: config.value,
      description: config.description ?? "",
      enabled: config.enabled,
    },
  });

  const onUpdate = async (data: SystemConfigurationPayload) => {
    await updateConfig(config.id, data);
    setIsEditOpen(false);
  };

  const onDelete = async () => {
    await deleteConfig(config.id);
    setIsDeleteOpen(false);
  };

  return (
    <>
      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='ghost' className='h-8 w-8 p-0'>
              <span className='sr-only'>Open menu</span>
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DialogTrigger asChild>
              <DropdownMenuItem>
                <Pencil className='mr-2 h-4 w-4' />
                <span>Edit</span>
              </DropdownMenuItem>
            </DialogTrigger>
            <DropdownMenuItem
              onClick={() => setIsDeleteOpen(true)}
              className='text-red-600'
            >
              <Trash2 className='mr-2 h-4 w-4 text-red-600' />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit: {config.key}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onUpdate)} className='space-y-4 py-2'>
            <div className='space-y-2'>
              <Label htmlFor='key'>Key</Label>
              <Input id='key' {...register("key", { required: true })} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='value'>Value</Label>
              <Textarea id='value' {...register("value", { required: true })} />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='description'>Description</Label>
              <Input id='description' {...register("description")} />
            </div>
            <div className='flex items-center space-x-2'>
              <Switch
                id='enabled'
                {...register("enabled")}
                defaultChecked={config.enabled ? true : false}
              />
              <Label htmlFor='enabled'>Enabled</Label>
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type='submit'>Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              <span className='font-bold'> {config.key} </span>
              configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
