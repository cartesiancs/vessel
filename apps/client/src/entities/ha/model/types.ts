type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export interface HaState {
  entity_id: string;
  state: string;
  attributes: JsonObject;
  last_changed: string;
  last_updated: string;
  context: JsonObject;
}

export interface HaStateStore {
  states: HaState[];
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
  fetchStates: () => Promise<void>;
}
