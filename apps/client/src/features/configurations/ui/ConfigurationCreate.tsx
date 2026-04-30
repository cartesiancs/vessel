import { Controller, useForm } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useConfigStore } from "@/entities/configurations/store";
import { SystemConfigurationPayload } from "@/entities/configurations/types";

export function ConfigurationCreate({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createConfig = useConfigStore((state) => state.createConfig);
  const { register, handleSubmit, reset, control } =
    useForm<SystemConfigurationPayload>({
      defaultValues: {
        key: "",
        value: "",
        description: "",
        enabled: 1,
      },
    });

  const onSubmit = async (data: SystemConfigurationPayload) => {
    await createConfig(data);
    onOpenChange(false);
    reset();
  };

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New System Configuration</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4 py-2'>
          <div className='space-y-2'>
            <Label htmlFor='key'>Key</Label>
            <Input id='key' {...register("key", { required: true })} />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='value'>Value</Label>
            <Textarea
              id='value'
              {...register("value", { required: true })}
              className='break-all'
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='description'>Description</Label>
            <Input id='description' {...register("description")} />
          </div>
          <div className='flex items-center space-x-2'>
            <Controller
              name='enabled'
              control={control}
              render={({ field }) => (
                <Switch
                  id='enabled'
                  checked={field.value === 1}
                  onCheckedChange={(checked) => field.onChange(checked ? 1 : 0)}
                />
              )}
            />
            <Label htmlFor='enabled'>Enabled</Label>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
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
