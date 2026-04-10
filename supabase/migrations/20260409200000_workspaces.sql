-- ============================================================
-- Migration: Multi-workspace support with full data isolation
-- ============================================================

-- ── Workspaces Table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#00D9C8',
  description text DEFAULT '',
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY workspaces_user_policy ON workspaces
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Add workspace_id to isolated tables ─────────────────────────

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);

ALTER TABLE connected_systems
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_connected_systems_workspace ON connected_systems(workspace_id);

ALTER TABLE mcp_servers
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_mcp_servers_workspace ON mcp_servers(workspace_id);

ALTER TABLE shared_directives
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_shared_directives_workspace ON shared_directives(workspace_id);

ALTER TABLE knowledge_namespaces
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_knowledge_namespaces_workspace ON knowledge_namespaces(workspace_id);

-- ── Update unique constraints to workspace scope ────────────────

ALTER TABLE connected_systems
  DROP CONSTRAINT IF EXISTS connected_systems_user_integration_unique;

DO $$ BEGIN
  ALTER TABLE connected_systems
    ADD CONSTRAINT connected_systems_workspace_integration_unique
    UNIQUE (workspace_id, integration_key);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE mcp_servers
  DROP CONSTRAINT IF EXISTS mcp_servers_user_id_url_key;

DO $$ BEGIN
  ALTER TABLE mcp_servers
    ADD CONSTRAINT mcp_servers_workspace_url_unique
    UNIQUE (workspace_id, url);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Backfill: create default workspace per user ─────────────────

INSERT INTO workspaces (user_id, name, color, is_default)
SELECT DISTINCT
  a.user_id,
  COALESCE(
    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = a.user_id),
    'Default'
  ) || ' Command',
  '#00D9C8',
  true
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM workspaces w
  WHERE w.user_id = a.user_id AND w.is_default = true
);

-- ── Backfill: assign orphaned rows to default workspace ─────────

UPDATE agents a
SET workspace_id = w.id
FROM workspaces w
WHERE a.workspace_id IS NULL
  AND w.user_id = a.user_id
  AND w.is_default = true;

UPDATE tasks t
SET workspace_id = w.id
FROM workspaces w
WHERE t.workspace_id IS NULL
  AND w.user_id = t.user_id
  AND w.is_default = true;

UPDATE connected_systems cs
SET workspace_id = w.id
FROM workspaces w
WHERE cs.workspace_id IS NULL
  AND w.user_id = cs.user_id
  AND w.is_default = true;

UPDATE mcp_servers ms
SET workspace_id = w.id
FROM workspaces w
WHERE ms.workspace_id IS NULL
  AND w.user_id = ms.user_id
  AND w.is_default = true;

UPDATE shared_directives sd
SET workspace_id = w.id
FROM workspaces w
WHERE sd.workspace_id IS NULL
  AND w.user_id = sd.user_id
  AND w.is_default = true;

UPDATE knowledge_namespaces kn
SET workspace_id = w.id
FROM workspaces w
WHERE kn.workspace_id IS NULL
  AND w.user_id = kn.user_id
  AND w.is_default = true;
