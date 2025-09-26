-- Your SQL goes here
CREATE TABLE streams (
    ssrc INTEGER PRIMARY KEY NOT NULL,
    topic TEXT NOT NULL,
    device_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(topic, device_id)
);