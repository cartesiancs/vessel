import { EntityAll } from "../entity/types";

export interface Device {
  id: number;
  device_id: string;
  name: string | null;
  manufacturer: string | null;
  model: string | null;
}

export interface DeviceWithEntity {
  id: number;
  device_id: string;
  name: string | null;
  manufacturer: string | null;
  model: string | null;
  entities: EntityAll[];
}

export type DevicePayload = Omit<Device, "id">;
