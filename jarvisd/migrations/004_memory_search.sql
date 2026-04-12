-- JARVIS OS — M3 batch 1: semantic memory search
-- Keyword FTS5 index for memory nodes (contentless, we manage rows explicitly).
-- The vector virtual table (memory_vectors) is created in code after
-- sqliteVec.load(db) runs — it can't safely be declared here because the
-- sqlite-vec extension must be loaded first.

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts5 USING fts5(
  node_id UNINDEXED,
  label,
  body,
  tokenize = 'porter unicode61'
);

INSERT OR IGNORE INTO schema_version(version, applied_at)
VALUES (4, datetime('now'));
