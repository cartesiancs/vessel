import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CreateItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: "file" | "folder";
  onCreate: (name: string) => Promise<void>;
}

export const CreateItemDialog: React.FC<CreateItemDialogProps> = ({
  isOpen,
  onClose,
  itemType,
  onCreate,
}) => {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    await onCreate(name.trim());
    setIsLoading(false);
    onClose();
    setName("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New {itemType}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Enter ${itemType} name...`}
            className='my-4'
            autoFocus
          />
          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isLoading || !name.trim()}>
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
