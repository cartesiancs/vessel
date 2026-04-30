import { create } from "zustand";
import { getUsers, createUser, updateUser, deleteUser } from "./api";
import { User, CreateUserPayload, UpdateUserPayload } from "./types";

type UserState = {
  users: User[];
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  addUser: (data: CreateUserPayload) => Promise<void>;
  editUser: (id: number, data: UpdateUserPayload) => Promise<void>;
  removeUser: (id: number) => Promise<void>;
};

export const useUserStore = create<UserState>((set) => ({
  users: [],
  isLoading: false,
  error: null,
  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getUsers();
      set({ users: response.data, isLoading: false });
    } catch (error) {
      set({ error: "Failed to fetch users.", isLoading: false });
      console.error(error);
    }
  },
  addUser: async (data) => {
    try {
      await createUser(data);
      // After adding, refresh the list
      await useUserStore.getState().fetchUsers();
    } catch (error) {
      set({ error: "Failed to add user." });
      console.error(error);
      throw error; // re-throw to be caught in the component
    }
  },
  editUser: async (id, data) => {
    try {
      await updateUser(id, data);
      await useUserStore.getState().fetchUsers();
    } catch (error) {
      set({ error: "Failed to update user." });
      console.error(error);
      throw error;
    }
  },
  removeUser: async (id) => {
    try {
      await deleteUser(id);
      set((state) => ({
        users: state.users.filter((user) => user.id !== id),
      }));
    } catch (error) {
      set({ error: "Failed to delete user." });
      console.error(error);
      throw error;
    }
  },
}));
