import { apiClient } from "@/shared/api";
import { User } from "@/entities/user/types";

export type AuthCredentials = {
  id: string;
  password: string;
};

export const authenticateWithPassword = async (
  baseUrl: string,
  credentials: AuthCredentials,
): Promise<string> => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  const response = await fetch(`${normalizedBaseUrl}/api/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error("Wrong ID or password.");
  }

  const data = await response.json();

  if (data.token === "none" || !data.token) {
    throw new Error("Authentication failed. Please check your credentials.");
  }

  return data.token as string;
};

export const fetchAdminUser = async (): Promise<User> => {
  const usersResponse = await apiClient.get<User[]>("/users");
  const adminUser = usersResponse.data.find((user) => user.username === "admin");

  if (!adminUser) {
    throw new Error("Admin user not found on the server.");
  }

  return adminUser;
};

export const updateUserPassword = async (
  userId: number,
  newPassword: string,
): Promise<void> => {
  await apiClient.put(`/users/${userId}`, {
    password: newPassword,
  });
};
