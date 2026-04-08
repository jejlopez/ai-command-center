-- ============================================================
-- Migration 002: agents, tasks, activity_log
-- Scope: Fleet Operations vertical slice
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE agent_status AS ENUM ('processing', 'idle', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE agent_role AS ENUM ('commander', 'researcher', 'ui-agent', 'qa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE spawn_pattern AS ENUM ('fan-out', 'sequential', 'persistent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE response_length AS ENUM ('short', 'medium', 'long', 'unlimited');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('pending', 'running', 'completed', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE log_type AS ENUM ('SYS', 'NET', 'OK', 'ERR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Agents ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agents (
  id                  text PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                text NOT NULL,
  model               text NOT NULL,
  status              agent_status NOT NULL DEFAULT 'idle',
  role                agent_role NOT NULL,
  parent_id           text REFERENCES agents(id) ON DELETE SET NULL,
  can_spawn           boolean NOT NULL DEFAULT false,
  spawn_pattern       spawn_pattern NOT NULL DEFAULT 'sequential',
  task_completion     integer NOT NULL DEFAULT 0,
  token_burn          integer[] DEFAULT '{}',
  latency_ms          integer NOT NULL DEFAULT 0,
  color               text NOT NULL DEFAULT '#60a5fa',
  temperature         numeric(3,2) DEFAULT 0.7,
  response_length     response_length DEFAULT 'medium',
  system_prompt       text DEFAULT '',
  skills              text[] DEFAULT '{}',
  subagents           text[] DEFAULT '{}',
  total_tokens        integer DEFAULT 0,
  total_cost          numeric(10,4) DEFAULT 0,
  success_rate        integer DEFAULT 0,
  task_count          integer DEFAULT 0,
  uptime_ms           bigint DEFAULT 0,
  last_heartbeat      timestamptz,
  restart_count       integer DEFAULT 0,
  error_message       text,
  error_stack         text,
  last_restart        timestamptz,
  token_history_24h   integer[] DEFAULT '{}',
  latency_history_24h integer[] DEFAULT '{}',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_user ON agents(user_id);

-- ── Tasks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  status        task_status NOT NULL DEFAULT 'pending',
  parent_id     text REFERENCES tasks(id) ON DELETE SET NULL,
  agent_id      text REFERENCES agents(id) ON DELETE SET NULL,
  agent_name    text NOT NULL,
  duration_ms   integer DEFAULT 0,
  cost_usd      numeric(10,4) DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);

-- ── Activity Log ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_log (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp     timestamptz NOT NULL DEFAULT now(),
  type          log_type NOT NULL,
  message       text NOT NULL,
  agent_id      text REFERENCES agents(id) ON DELETE SET NULL,
  parent_log_id bigint REFERENCES activity_log(id) ON DELETE SET NULL,
  tokens        integer DEFAULT 0,
  duration_ms   integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_agent ON activity_log(agent_id);

-- ── Row Level Security ───────────────────────────────────────────

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY agents_user_policy ON agents
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY tasks_user_policy ON tasks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY activity_log_user_policy ON activity_log
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Updated_at triggers ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agents_updated_at BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Add agent FK to pending_reviews (deferred from migration 001) ─

DO $$ BEGIN
  ALTER TABLE pending_reviews
    ADD CONSTRAINT fk_pending_reviews_agent
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
