-- Workspace-aware scratchpad notes for Mission Control

CREATE TABLE IF NOT EXISTS scratchpad_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  note_date date NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, note_date)
);

CREATE INDEX IF NOT EXISTS idx_scratchpad_notes_user ON scratchpad_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_scratchpad_notes_workspace_date ON scratchpad_notes(workspace_id, note_date DESC);

ALTER TABLE scratchpad_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scratchpad_notes_user_policy ON scratchpad_notes;
CREATE POLICY scratchpad_notes_user_policy ON scratchpad_notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS scratchpad_notes_updated_at ON scratchpad_notes;
CREATE TRIGGER scratchpad_notes_updated_at
  BEFORE UPDATE ON scratchpad_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
