import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateUserPayload, UpdateUserPayload } from "@/entities/user/types";
import { PlusCircle } from "lucide-react";
import { FC, useState } from "react";
import { UserForm } from "./userForm";
import { useUserStore } from "@/entities/user/store";

export const AddUser: FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addUser = useUserStore((state) => state.addUser);

  const handleSubmit = async (data: CreateUserPayload | UpdateUserPayload) => {
    setIsSubmitting(true);
    try {
      await addUser(data as CreateUserPayload);
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to add user from component", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <PlusCircle className='mr-2 h-4 w-4' /> Add User
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogHeader className='p-6 pb-0'>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new user.
          </DialogDescription>
        </DialogHeader>
        <DialogContent>
          <UserForm
            onSubmit={handleSubmit}
            onCancel={() => setIsOpen(false)}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export const AddUserDialog: FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ isOpen, onOpenChange }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addUser = useUserStore((state) => state.addUser);

  const handleSubmit = async (data: CreateUserPayload | UpdateUserPayload) => {
    setIsSubmitting(true);
    try {
      await addUser(data as CreateUserPayload);
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to add user from component", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <UserForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};
