export interface DeviceToken {
  id: number;
  device_id: number;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface IssuedTokenResponse {
  message: string;
  token: string;
}
