export interface Entity {
  id: number;
  entity_id: string;
  device_id: number | null;
  friendly_name: string | null;
  platform: string | null;
  configuration: string | null;
}

export type EntityPayload = Omit<Entity, "id">;
