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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import { useConfigStore } from "../store";
import { SystemConfigurationPayload } from "../types";

export function ConfigurationCreateButton() {
  const [isOpen, setIsOpen] = useState(false);
  const createConfig = useConfigStore((state) => state.createConfig);
  const { register, handleSubmit, reset } = useForm<SystemConfigurationPayload>(
    {
      defaultValues: {
        key: "",
        value: "",
        description: "",
        enabled: 1,
      },
    },
  );

  const onSubmit = async (data: SystemConfigurationPayload) => {
    await createConfig(data);
    setIsOpen(false);
    reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size={"sm"} variant='outline'>
          <PlusCircle className='mr-2 h-4 w-4' />
          Add Configuration
        </Button>
      </DialogTrigger>
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
              defaultChecked={true}
            />
            <Label htmlFor='enabled'>Enabled</Label>
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
