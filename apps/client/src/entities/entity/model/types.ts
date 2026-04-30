export interface Entity {
  id: number;
  entity_id: string;
  device_id: number | null;
  friendly_name: string | null;
  platform: string | null;
  configuration: string | null;
  entity_type: string | null;
}

interface DynamicConfig {
  [key: string]: unknown;
}

export interface State {
  state_id: number;
  metadata_id: number;
  state: string;
  attributes: string | null;
  last_changed: string;
  last_updated: string;
  created: string;
}

export interface EntityAll {
  id: number;
  entity_id: string;
  device_id: number;
  friendly_name: string;
  platform: string;
  configuration: DynamicConfig | null;
  state: State | null;
  entity_type: string | null;
}

export type EntityPayload = Omit<Entity, "id">;
