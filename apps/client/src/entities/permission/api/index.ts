import { apiClient } from "@/shared/api";
import { Permission } from "./types";

export const getPermissions = () => apiClient.get<Permission[]>("/permissions");
