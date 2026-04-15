-- Sync support: unique indexes for Pipedrive upserts + sync_state table

CREATE UNIQUE INDEX IF NOT EXISTS idx_deals_user_pipedrive ON deals(user_id, pipedrive_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_pipedrive ON contacts(user_id, pipedrive_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_user_pipedrive ON leads(user_id, pipedrive_id);

ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS pipedrive_id int;
CREATE UNIQUE INDEX IF NOT EXISTS idx_followups_user_pipedrive ON follow_ups(user_id, pipedrive_id);

ALTER TABLE deals ADD COLUMN IF NOT EXISTS pipedrive_id int;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS sync_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  resource text not null,
  last_sync timestamptz,
  last_status text,
  error_msg text,
  backoff_until timestamptz,
  UNIQUE(user_id, provider, resource)
);
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "syncstate_owner" ON sync_state FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
