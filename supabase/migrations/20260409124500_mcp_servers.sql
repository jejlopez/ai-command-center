CREATE TABLE IF NOT EXISTS mcp_servers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  url         text NOT NULL,
  status      text NOT NULL DEFAULT 'configured',
  tool_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, url)
);

CREATE INDEX IF NOT EXISTS idx_mcp_servers_user ON mcp_servers(user_id);

ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY mcp_servers_user_policy ON mcp_servers
    FOR ALL
    TO authenticated
    USING ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER mcp_servers_updated_at BEFORE UPDATE ON mcp_servers
    FOR EACH ROW EXECUTE FUNCTION set_timestamp_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
