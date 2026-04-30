import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRoleStore } from "@/entities/role/store";
import { Role } from "@/entities/role/types";
import { assignRoleToUser, revokeRoleFromUser } from "@/entities/user/api";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { FC, useEffect, useState } from "react";
import { toast } from "sonner";

interface UserRoleAssignerProps {
  userId?: number | null;
  initialRoles: Role[];
}

export const UserRoleAssigner: FC<UserRoleAssignerProps> = ({
  userId,
  initialRoles,
}) => {
  const { roles, fetchRoles } = useRoleStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(initialRoles);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    setSelectedRoles(initialRoles);
  }, [initialRoles]);

  if (userId == null) {
    return null;
  }

  const handleSelect = async (role: Role) => {
    if (isSubmitting) return;

    const isSelected = selectedRoles.some((r) => r.id === role.id);
    const optimisticState = isSelected
      ? selectedRoles.filter((r) => r.id !== role.id)
      : [...selectedRoles, role];

    setSelectedRoles(optimisticState);
    setIsSubmitting(true);

    try {
      if (isSelected) {
        await revokeRoleFromUser(userId, role.id);
        toast.success(`Role "${role.name}" has been revoked.`);
      } else {
        await assignRoleToUser(userId, role.id);
        toast.success(`Role "${role.name}" has been assigned.`);
      }
    } catch (error) {
      console.error("Failed to update user role:", error);
      toast.error("Failed to update role. Please try again.");
      setSelectedRoles(selectedRoles);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={isOpen}
          className='w-full justify-between col-span-3'
          disabled={isSubmitting}
        >
          {selectedRoles.length > 0
            ? `${selectedRoles.length} selected`
            : "Select roles..."}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[--radix-popover-trigger-width] p-0'>
        <Command>
          <CommandInput placeholder='Search roles...' />
          <CommandList>
            <CommandEmpty>No roles found.</CommandEmpty>
            <CommandGroup>
              {roles.map((role) => (
                <CommandItem
                  key={role.id}
                  value={role.name}
                  onSelect={() => handleSelect(role)}
                  disabled={isSubmitting}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedRoles.some((r) => r.id === role.id)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  {role.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
