import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Trash2 } from "lucide-react";
import { useEntityStore } from "@/entities/entity/store";

interface Props {
  entityId: number;
}

export function EntityDeleteButton({ entityId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const deleteEntity = useEntityStore((state) => state.deleteEntity);

  const handleDelete = async () => {
    await deleteEntity(entityId);
    setIsOpen(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <Button
        asChild
        variant='ghost'
        size='icon'
        onClick={() => setIsOpen(true)}
      >
        <span>
          <Trash2 className='h-4 w-4 text-red-500' />
        </span>
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            entity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className='bg-red-600 hover:bg-red-700'
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
