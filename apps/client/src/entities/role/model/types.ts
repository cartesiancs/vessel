import { Permission } from "@/entities/permission";

export type Role = {
  id: number;
  name: string;
  description: string | null;
  permissions?: Permission[];
};

export type CreateRolePayload = {
  name: string;
  description?: string;
  permission_ids: number[];
};

export type UpdateRolePayload = Partial<CreateRolePayload>;
