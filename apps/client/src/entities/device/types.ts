export interface Device {
  id: number;
  device_id: string;
  name: string | null;
  manufacturer: string | null;
  model: string | null;
}

export type DevicePayload = Omit<Device, "id">;
