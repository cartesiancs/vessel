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
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useUserStore } from "@/entities/user/store";
import { Trash2 } from "lucide-react";
import { FC, useState } from "react";

interface DeleteUserProps {
  userId: number;
}

export const DeleteUser: FC<DeleteUserProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const removeUser = useUserStore((state) => state.removeUser);

  const handleConfirm = async () => {
    try {
      await removeUser(userId);
    } catch (e) {
      console.error("Failed to delete user from component", e);
    }
  };

  return (
    <>
      <DropdownMenuItem
        onSelect={() => setIsOpen(true)}
        className='text-destructive focus:text-destructive'
      >
        <Trash2 className='mr-2 h-4 w-4' />
        <span>Delete</span>
      </DropdownMenuItem>
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsOpen(false)} />
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={() => {
                handleConfirm();
                setIsOpen(false);
              }}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export const DeleteUserDialog: FC<{
  userId: number | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ userId, isOpen, onOpenChange }) => {
  const removeUser = useUserStore((state) => state.removeUser);

  if (!userId) return null;

  const handleConfirm = async () => {
    try {
      await removeUser(userId);
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to delete user from component", e);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the user.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Close
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
