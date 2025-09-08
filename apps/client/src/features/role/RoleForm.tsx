import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePermissionStore } from "@/entities/permission/store";
import { Permission } from "@/entities/permission/types";
import {
  CreateRolePayload,
  Role,
  UpdateRolePayload,
} from "@/entities/role/types";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { FC, useEffect, useState } from "react";

interface RoleFormProps {
  role?: Role;
  onSubmit: (data: CreateRolePayload | UpdateRolePayload) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export const RoleForm: FC<RoleFormProps> = ({
  role,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const [name, setName] = useState(role?.name || "");
  const [description, setDescription] = useState(role?.description || "");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(
    role?.permissions || [],
  );
  const [error, setError] = useState("");
  const [isPermissionsPopoverOpen, setPermissionsPopoverOpen] = useState(false);

  const { permissions, fetchPermissions } = usePermissionStore();

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name) {
      setError("Please enter a role name.");
      return;
    }
    setError("");
    const payload: CreateRolePayload | UpdateRolePayload = {
      name,
      description: description || undefined,
      permission_ids: selectedPermissions.map((p) => p.id),
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className='grid gap-4 py-4'>
        <div className='grid grid-cols-4 items-center gap-4'>
          <Label htmlFor='name' className='text-right'>
            Role Name
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
        <div className='grid grid-cols-4 items-center gap-4'>
          <Label className='text-right'>Permissions</Label>
          <Popover
            open={isPermissionsPopoverOpen}
            onOpenChange={setPermissionsPopoverOpen}
          >
            <PopoverTrigger asChild>
              <Button
                variant='outline'
                role='combobox'
                className='w-full justify-between col-span-3'
              >
                {selectedPermissions.length > 0
                  ? `${selectedPermissions.length} selected`
                  : "Select permissions..."}
                <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-[--radix-popover-trigger-width] p-0'>
              <Command>
                <CommandInput placeholder='Search permissions...' />
                <CommandList>
                  <CommandEmpty>No permissions found.</CommandEmpty>
                  <CommandGroup>
                    {permissions.map((permission) => (
                      <CommandItem
                        key={permission.id}
                        value={permission.name}
                        onSelect={() => {
                          setSelectedPermissions((current) =>
                            current.some((p) => p.id === permission.id)
                              ? current.filter((p) => p.id !== permission.id)
                              : [...current, permission],
                          );
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedPermissions.some(
                              (p) => p.id === permission.id,
                            )
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {permission.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {error && (
          <p className='text-sm text-destructive col-span-4 text-center'>
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onCancel}>
          Cancel
        </Button>
        <Button type='submit' disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
};
