CREATE TABLE recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    stream_ssrc INTEGER NOT NULL,
    topic TEXT NOT NULL,
    device_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'recording',
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    created_by_user_id INTEGER
);

CREATE INDEX idx_recordings_topic ON recordings(topic);
CREATE INDEX idx_recordings_status ON recordings(status);
CREATE INDEX idx_recordings_started_at ON recordings(started_at);
