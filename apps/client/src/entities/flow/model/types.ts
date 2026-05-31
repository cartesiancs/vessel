export interface Flow {
  id: number;
  name: string;
  description: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface FlowPayload {
  name: string;
  description?: string;
  enabled?: number;
}

export interface FlowVersion {
  id: number;
  flow_id: number;
  version: number;
  graph_json: string;
  comment: string | null;
  created_at: string;
}

export interface FlowVersionPayload {
  graph_json: string;
  comment?: string;
}
