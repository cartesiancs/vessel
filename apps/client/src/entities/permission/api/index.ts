import { apiClient } from "@/shared/api";
import { Permission } from "../model/types";

export const getPermissions = () => apiClient.get<Permission[]>("/permissions");
