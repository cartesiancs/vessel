import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserStore } from "@/entities/user/store";
import {
  User,
  UpdateUserPayload,
  CreateUserPayload,
} from "@/entities/user/types";
import { Edit } from "lucide-react";
import { FC, useState } from "react";
import { UserForm } from "./userForm";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface EditUserProps {
  user: User;
}

export const EditUser: FC<EditUserProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const editUser = useUserStore((state) => state.editUser);

  const handleSubmit = async (data: UpdateUserPayload) => {
    setIsSubmitting(true);
    try {
      await editUser(user.id, data);
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to edit user from component", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DropdownMenuItem onSelect={() => setIsOpen(true)}>
        <Edit className='mr-2 h-4 w-4' />
        <span>Edit</span>
      </DropdownMenuItem>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader className='p-6 pb-0'>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update the user's details.</DialogDescription>
          </DialogHeader>
          <UserForm
            user={user}
            onSubmit={handleSubmit}
            onCancel={() => setIsOpen(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export const EditUserDialog: FC<{
  user: User | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ user, isOpen, onOpenChange }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const editUser = useUserStore((state) => state.editUser);

  if (!user) return null;

  const handleSubmit = async (data: CreateUserPayload | UpdateUserPayload) => {
    setIsSubmitting(true);
    try {
      await editUser(user.id, data as UpdateUserPayload);
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to edit user from component", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <UserForm
          user={user}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};
