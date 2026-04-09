-- ============================================================
-- Migration: Add is_ephemeral flag to agents
-- Purpose: Support temporary agents that auto-cleanup after task completion
-- Risk: low (additive, non-destructive, default false)
-- ============================================================

ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_ephemeral boolean NOT NULL DEFAULT false;

-- Partial index for cleanup queries — only indexes ephemeral agents
CREATE INDEX IF NOT EXISTS idx_agents_ephemeral
  ON agents(is_ephemeral) WHERE is_ephemeral = true;
