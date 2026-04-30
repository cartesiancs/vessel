import { create } from "zustand";
import { getRoles, createRole, updateRole, deleteRole } from "./api";
import { Role, CreateRolePayload, UpdateRolePayload } from "./types";

type RoleState = {
  roles: Role[];
  isLoading: boolean;
  error: string | null;
  fetchRoles: () => Promise<void>;
  addRole: (data: CreateRolePayload) => Promise<void>;
  editRole: (id: number, data: UpdateRolePayload) => Promise<void>;
  removeRole: (id: number) => Promise<void>;
};

export const useRoleStore = create<RoleState>((set) => ({
  roles: [],
  isLoading: false,
  error: null,
  fetchRoles: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getRoles();
      set({ roles: response.data, isLoading: false });
    } catch (error) {
      set({ error: "Failed to fetch roles.", isLoading: false });
      console.error(error);
    }
  },
  addRole: async (data) => {
    try {
      await createRole(data);
      await useRoleStore.getState().fetchRoles();
    } catch (error) {
      const errorMessage = "Failed to add role.";
      set({ error: errorMessage });
      console.error(error);
      throw new Error(errorMessage);
    }
  },
  editRole: async (id, data) => {
    try {
      await updateRole(id, data);
      await useRoleStore.getState().fetchRoles();
    } catch (error) {
      const errorMessage = "Failed to update role.";
      set({ error: errorMessage });
      console.error(error);
      throw new Error(errorMessage);
    }
  },
  removeRole: async (id) => {
    try {
      await deleteRole(id);
      set((state) => ({
        roles: state.roles.filter((role) => role.id !== id),
      }));
    } catch (error) {
      const errorMessage = "Failed to delete role.";
      set({ error: errorMessage });
      console.error(error);
      throw new Error(errorMessage);
    }
  },
}));
