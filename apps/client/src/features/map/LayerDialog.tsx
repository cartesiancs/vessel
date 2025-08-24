import { Button } from "@/components/ui/button";
import {
  DialogHeader,
  DialogFooter,
  DialogTrigger,
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMapDataStore } from "@/entities/map/store";
import { MapLayer, LayerPayload } from "@/entities/map/types";
import { useState, useEffect } from "react";

interface LayerDialogProps {
  children: React.ReactNode;
  layer?: MapLayer;
}

export function LayerDialog({ children, layer }: LayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { addLayer, editLayer } = useMapDataStore();

  useEffect(() => {
    if (layer) {
      setName(layer.name);
      setDescription(layer.description || "");
    } else {
      setName("");
      setDescription("");
    }
  }, [layer, open]);

  const handleSubmit = () => {
    const payload: LayerPayload = { name, description };
    if (layer) {
      editLayer(layer.id, payload);
    } else {
      addLayer(payload);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className='sm:max-w-[425px] z-[999999]'>
        <DialogHeader>
          <DialogTitle>{layer ? "Edit Layer" : "Create New Layer"}</DialogTitle>
        </DialogHeader>
        <div className='grid gap-4 py-4'>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='name' className='text-right'>
              Name
            </Label>
            <Input
              id='name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              className='col-span-3'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='description' className='text-right'>
              Description
            </Label>
            <Input
              id='description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className='col-span-3'
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
