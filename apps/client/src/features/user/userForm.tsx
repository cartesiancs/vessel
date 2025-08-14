import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  User,
  CreateUserPayload,
  UpdateUserPayload,
} from "@/entities/user/types";
import { Label } from "@radix-ui/react-label";
import { FC, useState } from "react";

interface UserFormProps {
  user?: User;
  onSubmit: (data: CreateUserPayload | UpdateUserPayload) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export const UserForm: FC<UserFormProps> = ({
  user,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username || !email || (!user && !password)) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    const payload: CreateUserPayload | UpdateUserPayload = {
      username,
      email,
      ...(password && { password }),
    };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className='grid gap-4 py-4'>
        <div className='grid grid-cols-4 items-center gap-4'>
          <Label htmlFor='username' className='text-right'>
            Username
          </Label>
          <Input
            id='username'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className='col-span-3'
          />
        </div>
        <div className='grid grid-cols-4 items-center gap-4'>
          <Label htmlFor='email' className='text-right'>
            Email
          </Label>
          <Input
            id='email'
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className='col-span-3'
          />
        </div>
        <div className='grid grid-cols-4 items-center gap-4'>
          <Label htmlFor='password' className='text-right'>
            Password
          </Label>
          <Input
            id='password'
            type='password'
            placeholder={user ? "Leave blank to keep current password" : ""}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className='col-span-3'
          />
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
