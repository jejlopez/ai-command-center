-- Migration 003: add dispatch task columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS prompt_text   text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result_text   text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at  timestamptz;
