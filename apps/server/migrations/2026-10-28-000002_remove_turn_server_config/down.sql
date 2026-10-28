INSERT INTO system_configurations (key, value, enabled, description)
SELECT 'turn_server_config', '{}', 0, 'Removed: Vessel no longer uses TURN servers'
WHERE NOT EXISTS (SELECT 1 FROM system_configurations WHERE key = 'turn_server_config');
