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
import { useUserStore } from "@/entities/user/store";
import { User } from "@/entities/user/types";
import { AddUserDialog } from "@/features/user/userAdd";
import { DeleteUserDialog } from "@/features/user/userDelete";
import { EditUserDialog } from "@/features/user/userEdit";
import { Edit, MoreHorizontal, PlusCircle, Trash2 } from "lucide-react";
import { FC, useEffect, useState } from "react";

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "N/A";
  try {
    const formattedString = dateString.includes(" ")
      ? dateString.replace(" ", "T")
      : dateString;
    const date = new Date(formattedString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleString();
  } catch (error) {
    console.error("Invalid date format:", error);
    return dateString;
  }
};

export const UserTable: FC = () => {
  const { users, isLoading, error, fetchUsers } = useUserStore(
    (state) => state,
  );
  const [isAddDialogOpen, setAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <>
      <div className='p-4 md:p-8'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              User Management
            </h1>
            <p className='text-muted-foreground'>
              A list of all users in the system.
            </p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <PlusCircle className='mr-2 h-4 w-4' /> Add User
          </Button>
        </div>
        {isLoading && <div className='text-center p-8'>Loading users...</div>}
        {!isLoading && error && (
          <div className='text-center p-8 text-destructive'>{error}</div>
        )}
        {!isLoading && !error && (
          <div className='rounded-lg border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Updated At</TableHead>
                  <TableHead className='text-right'></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className='font-medium'>
                        {user.username}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{formatDate(user.created_at)}</TableCell>
                      <TableCell>{formatDate(user.updated_at)}</TableCell>
                      <TableCell className='text-right'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' className='h-8 w-8 p-0'>
                              <span className='sr-only'>Open menu</span>
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onSelect={() => setEditingUser(user)}
                            >
                              <Edit className='mr-2 h-4 w-4' />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => setDeletingUserId(user.id)}
                              className='text-red-500 focus:text-red-500'
                            >
                              <Trash2 className='mr-2 h-4 w-4 text-red-500' />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className='h-24 text-center'>
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AddUserDialog isOpen={isAddDialogOpen} onOpenChange={setAddDialogOpen} />
      <EditUserDialog
        user={editingUser}
        isOpen={!!editingUser}
        onOpenChange={() => setEditingUser(null)}
      />
      <DeleteUserDialog
        userId={deletingUserId}
        isOpen={!!deletingUserId}
        onOpenChange={() => setDeletingUserId(null)}
      />
    </>
  );
};
