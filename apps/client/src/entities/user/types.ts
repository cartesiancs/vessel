import { Role } from "../role/types";

export type User = {
  id: number;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
  roles: Role[];
};

export type CreateUserPayload = {
  username: string;
  email: string;
  password: string;
};

export type UpdateUserPayload = {
  username?: string;
  email?: string;
  password?: string;
};
