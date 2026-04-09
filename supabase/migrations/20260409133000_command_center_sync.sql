-- ============================================================
-- Command Center sync layer
-- - Persist commander preferences in user_settings
-- - Persist connected systems dock metadata
-- - Add real sources for intelligence surfaces
-- ============================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS command_style text NOT NULL DEFAULT 'hybrid',
  ADD COLUMN IF NOT EXISTS alert_posture text NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start text NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end text NOT NULL DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS notification_route text NOT NULL DEFAULT 'command_center',
  ADD COLUMN IF NOT EXISTS commander_persona text NOT NULL DEFAULT 'founder',
  ADD COLUMN IF NOT EXISTS trusted_write_mode text NOT NULL DEFAULT 'review_first',
  ADD COLUMN IF NOT EXISTS approval_doctrine text NOT NULL DEFAULT 'risk_weighted',
  ADD COLUMN IF NOT EXISTS human_hourly_rate numeric(10,2) NOT NULL DEFAULT 42;

CREATE TABLE IF NOT EXISTS connected_systems (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_key text NOT NULL,
  display_name text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'connected',
  identifier text,
  capabilities text[] NOT NULL DEFAULT '{}',
  last_verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connected_systems_user_integration_unique UNIQUE (user_id, integration_key)
);

CREATE INDEX IF NOT EXISTS idx_connected_systems_user ON connected_systems(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_systems_status ON connected_systems(user_id, status);

ALTER TABLE connected_systems ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY connected_systems_user_policy ON connected_systems
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER connected_systems_updated_at BEFORE UPDATE ON connected_systems
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS knowledge_namespaces (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  vectors integer NOT NULL DEFAULT 0,
  size_label text NOT NULL DEFAULT '0 MB',
  last_sync_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  agents text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_namespaces_user ON knowledge_namespaces(user_id);

ALTER TABLE knowledge_namespaces ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY knowledge_namespaces_user_policy ON knowledge_namespaces
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER knowledge_namespaces_updated_at BEFORE UPDATE ON knowledge_namespaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS shared_directives (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'all',
  applied_to text[] NOT NULL DEFAULT '{}',
  content text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  icon text NOT NULL DEFAULT 'ShieldCheck',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_directives_user ON shared_directives(user_id);

ALTER TABLE shared_directives ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY shared_directives_user_policy ON shared_directives
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER shared_directives_updated_at BEFORE UPDATE ON shared_directives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS system_recommendations (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rec_type text NOT NULL DEFAULT 'optimization',
  title text NOT NULL,
  description text NOT NULL,
  impact text NOT NULL DEFAULT 'normal',
  savings_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_recommendations_user ON system_recommendations(user_id);

ALTER TABLE system_recommendations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY system_recommendations_user_policy ON system_recommendations
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER system_recommendations_updated_at BEFORE UPDATE ON system_recommendations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
