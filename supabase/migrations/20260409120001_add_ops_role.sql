-- ============================================================
-- Migration: Add 'ops' to agent_role enum
-- Purpose: Ops role exists in UI (CreateAgentModal) but not in DB enum
-- Risk: low (additive only)
-- ============================================================

ALTER TYPE agent_role ADD VALUE IF NOT EXISTS 'ops';
