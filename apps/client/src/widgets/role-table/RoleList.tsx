import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useRoleStore } from "@/entities/role/store";
import { Role } from "@/entities/role/types";
import {
  AddRoleDialog,
  DeleteRoleDialog,
  EditRoleDialog,
} from "@/features/role/RoleDialogs";
import { Edit, MoreHorizontal, PlusCircle, Trash2 } from "lucide-react";
import { FC, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export const RoleTable: FC = () => {
  const { roles, isLoading, error, fetchRoles } = useRoleStore();
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<number | null>(null);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return (
    <>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Role Management</h1>
          <p className='text-muted-foreground'>
            Manage user roles and their permissions.
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <PlusCircle className='mr-2 h-4 w-4' /> Add Role
        </Button>
      </div>
      {isLoading && <div className='text-center p-8'>Loading roles...</div>}
      {!isLoading && error && (
        <div className='text-center p-8 text-destructive'>{error}</div>
      )}
      {!isLoading && !error && (
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className='text-right'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.length > 0 ? (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className='font-medium'>{role.name}</TableCell>
                    <TableCell>{role.description}</TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1'>
                        {(role.permissions ?? []).map((p) => (
                          <Badge key={p.id} variant='secondary'>
                            {p.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className='text-right'>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' className='h-8 w-8 p-0'>
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onSelect={() => setEditingRole(role)}
                          >
                            <Edit className='mr-2 h-4 w-4' />
                            <span>Edit</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setDeletingRoleId(role.id)}
                            className='text-red-500 focus:text-red-500'
                          >
                            <Trash2 className='mr-2 h-4 w-4 text-red-500 focus:text-red-500' />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className='h-24 text-center'>
                    No roles found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AddRoleDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditRoleDialog
        role={editingRole}
        isOpen={!!editingRole}
        onOpenChange={() => setEditingRole(null)}
      />
      <DeleteRoleDialog
        roleId={deletingRoleId}
        isOpen={!!deletingRoleId}
        onOpenChange={() => setDeletingRoleId(null)}
      />
    </>
  );
};
