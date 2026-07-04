import { apiClient } from "@/shared/api";
import { User } from "@/entities/user";

export type AuthCredentials = {
  id: string;
  password: string;
};

export type AuthTokens = {
  token: string;
  refreshToken: string | null;
  expiresIn: number | null;
};

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/$/, "");

export const authenticateWithPassword = async (
  baseUrl: string,
  credentials: AuthCredentials,
): Promise<AuthTokens> => {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/auth`, {
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

  return {
    token: data.token as string,
    refreshToken: (data.refreshToken as string) ?? null,
    expiresIn: (data.expiresIn as number) ?? null,
  };
};

// Uses raw fetch (not apiClient) to avoid recursing through the 401
// refresh interceptor.
export const refreshAccessToken = async (
  baseUrl: string,
  refreshToken: string,
): Promise<AuthTokens> => {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh session.");
  }

  const data = await response.json();

  if (!data.token) {
    throw new Error("Failed to refresh session.");
  }

  return {
    token: data.token as string,
    refreshToken: (data.refreshToken as string) ?? null,
    expiresIn: (data.expiresIn as number) ?? null,
  };
};

// Best-effort server-side revocation of the refresh token family.
export const logoutSession = async (
  baseUrl: string,
  refreshToken: string,
): Promise<void> => {
  try {
    await fetch(`${normalizeBaseUrl(baseUrl)}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Local cleanup proceeds regardless of server reachability.
  }
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
