-- Conversation history for the agentic loop.
--
-- Phase 2 replaces stateless /ask/stream with per-session memory. One
-- conversation per session id (X-Session-Id header); messages persist
-- until the 90-day retention window clips them via nightly cron.
--
-- content is JSON-serialized Anthropic ContentBlockParam[] so assistant
-- turns with tool_use blocks round-trip cleanly into messages.stream().

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  title TEXT,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  ts TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  run_id TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_ts ON messages(conversation_id, ts);
CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts);

INSERT OR IGNORE INTO schema_version(version, applied_at)
VALUES (18, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
