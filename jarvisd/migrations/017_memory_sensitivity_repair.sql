-- Repair migration: re-ensure memory_nodes.sensitivity column exists.
--
-- Migration 008 originally added this column (Shield Protocol PII tagging),
-- but a later table rebuild on some deployments dropped it. The live schema
-- and schema_version drifted — users saw "table memory_nodes has no column
-- named sensitivity" when calling memory.remember() despite version 8 being
-- marked applied.
--
-- This migration re-adds the column. The runner in db.ts tolerates
-- "duplicate column name" errors on ALTER TABLE ADD COLUMN, so this is
-- safe to apply on DBs where the column already exists.

ALTER TABLE memory_nodes ADD COLUMN sensitivity TEXT NOT NULL DEFAULT 'none';

INSERT OR IGNORE INTO schema_version(version, applied_at)
VALUES (17, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
