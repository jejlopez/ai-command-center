-- M5 Shield Protocol: add sensitivity column to memory_nodes for PII tagging.
ALTER TABLE memory_nodes ADD COLUMN sensitivity TEXT NOT NULL DEFAULT 'none';

INSERT OR IGNORE INTO schema_version(version, applied_at)
VALUES (8, datetime('now'));
