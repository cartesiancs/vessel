export type TunnelStatus = {
  active: boolean;
  session_id?: string | null;
  server?: string | null;
  target?: string | null;
};

export type StartTunnelRequest = {
  server: string;
  target: string;
  access_token?: string;
};

export type StartTunnelResponse = {
  session_id: string;
};
