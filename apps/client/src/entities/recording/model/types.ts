export interface Recording {
  id: number;
  stream_ssrc: number;
  topic: string;
  device_id: string;
  media_type: "audio" | "video";
  filename: string;
  file_path: string;
  file_size: number;
  duration_ms: number;
  status: RecordingStatus;
  started_at: string;
  ended_at: string | null;
  created_by_user_id: number | null;
}

export type RecordingStatus = "recording" | "completed" | "failed";

export interface StartRecordingRequest {
  topic: string;
}

export interface StartRecordingResponse {
  id: number;
  topic: string;
  status: string;
}

export interface ActiveRecordingInfo {
  topic: string;
  recording_id: number;
}

export interface TopicRecordingStatus {
  is_recording: boolean;
  recording_id: number | null;
}
