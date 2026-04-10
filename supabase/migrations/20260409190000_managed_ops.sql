-- ============================================================
-- Managed Ops: templates, sessions, session events, and vaults
-- ============================================================

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_agents_template_id ON agents(template_id);
CREATE INDEX IF NOT EXISTS idx_agents_session_id ON agents(session_id);
CREATE INDEX IF NOT EXISTS idx_agents_archived_at ON agents(user_id, archived_at);

CREATE TABLE IF NOT EXISTS agent_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'researcher',
  description text NOT NULL DEFAULT '',
  default_model text NOT NULL DEFAULT '',
  system_prompt text NOT NULL DEFAULT '',
  allowed_tools text[] NOT NULL DEFAULT '{}',
  environment_bindings text[] NOT NULL DEFAULT '{}',
  vault_requirements text[] NOT NULL DEFAULT '{}',
  approval_mode text NOT NULL DEFAULT 'review_first',
  spawn_policy text NOT NULL DEFAULT 'ephemeral',
  default_visibility text NOT NULL DEFAULT 'shared',
  can_delegate boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_templates_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_agent_templates_user ON agent_templates(user_id);

ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY agent_templates_user_policy ON agent_templates
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER agent_templates_updated_at BEFORE UPDATE ON agent_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES agent_templates(id) ON DELETE SET NULL,
  root_agent_id text REFERENCES agents(id) ON DELETE SET NULL,
  worker_agent_id text REFERENCES agents(id) ON DELETE SET NULL,
  parent_session_id uuid REFERENCES agent_sessions(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled Session',
  prompt text NOT NULL DEFAULT '',
  launch_mode text NOT NULL DEFAULT 'delegated_run',
  status text NOT NULL DEFAULT 'queued',
  summary text NOT NULL DEFAULT '',
  requested_model text,
  active_worker_count integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  total_cost numeric(10,4) NOT NULL DEFAULT 0,
  tool_call_count integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON agent_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(user_id, status);

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY agent_sessions_user_policy ON agent_sessions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER agent_sessions_updated_at BEFORE UPDATE ON agent_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  worker_agent_id text REFERENCES agents(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  status text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sequence integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer NOT NULL DEFAULT 0,
  token_delta integer NOT NULL DEFAULT 0,
  cost_delta numeric(10,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id, sequence, created_at);
CREATE INDEX IF NOT EXISTS idx_session_events_user ON session_events(user_id, created_at DESC);

ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY session_events_user_policy ON session_events
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS credential_vaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  provider text NOT NULL DEFAULT 'custom',
  secret_refs text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credential_vaults_user_name_unique UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_credential_vaults_user ON credential_vaults(user_id, created_at DESC);

ALTER TABLE credential_vaults ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY credential_vaults_user_policy ON credential_vaults
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER credential_vaults_updated_at BEFORE UPDATE ON credential_vaults
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS vault_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vault_id uuid NOT NULL REFERENCES credential_vaults(id) ON DELETE CASCADE,
  owner_type text NOT NULL,
  owner_id text NOT NULL,
  binding_kind text NOT NULL DEFAULT 'runtime',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_bindings_unique UNIQUE (vault_id, owner_type, owner_id, binding_kind)
);

CREATE INDEX IF NOT EXISTS idx_vault_bindings_user ON vault_bindings(user_id, owner_type, owner_id);

ALTER TABLE vault_bindings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY vault_bindings_user_policy ON vault_bindings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER vault_bindings_updated_at BEFORE UPDATE ON vault_bindings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
