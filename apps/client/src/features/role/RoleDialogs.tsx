import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreateRolePayload,
  Role,
  UpdateRolePayload,
} from "@/entities/role/types";
import { FC, useState } from "react";
import { RoleForm } from "./RoleForm";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { useRoleStore } from "@/entities/role/store";

// Add Role Dialog
export const AddRoleDialog: FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ isOpen, onOpenChange }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addRole = useRoleStore((state) => state.addRole);

  const handleSubmit = async (data: CreateRolePayload | UpdateRolePayload) => {
    setIsSubmitting(true);
    try {
      await addRole(data as CreateRolePayload);
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to add role from component", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Role</DialogTitle>
        </DialogHeader>
        <RoleForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};

// Edit Role Dialog
export const EditRoleDialog: FC<{
  role: Role | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ role, isOpen, onOpenChange }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const editRole = useRoleStore((state) => state.editRole);

  if (!role) return null;

  const handleSubmit = async (data: CreateRolePayload | UpdateRolePayload) => {
    setIsSubmitting(true);
    try {
      await editRole(role.id, data as UpdateRolePayload);
      onOpenChange(false);
    } catch (e) {
      console.error("Failed to edit role from component", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Role</DialogTitle>
        </DialogHeader>
        <RoleForm
          role={role}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};

// Delete Role Dialog
export const DeleteRoleDialog: FC<{
  roleId: number | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ roleId, isOpen, onOpenChange }) => {
  const removeRole = useRoleStore((state) => state.removeRole);

  const handleDelete = async () => {
    if (roleId) {
      await removeRole(roleId);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the role.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant='destructive' onClick={handleDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
