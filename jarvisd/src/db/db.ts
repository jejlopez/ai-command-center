import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import * as sqliteVec from "sqlite-vec";

export const JARVIS_HOME = process.env.JARVIS_HOME ?? join(homedir(), ".jarvis");
export const DB_PATH = join(JARVIS_HOME, "jarvis.db");
const MIGRATIONS_DIR = resolve(import.meta.dirname, "..", "..", "migrations");

// Keep in sync with EMBED_DIMS in lib/embeddings.ts — nomic-embed-text = 768.
const VEC_DIMS = 768;

mkdirSync(JARVIS_HOME, { recursive: true });
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Load the sqlite-vec extension before any statement preparation so the rest
// of the module can rely on vec0 virtual tables existing. If the extension
// fails to load (missing prebuilt, unsupported platform, etc.) we log and
// continue — memory recall will degrade to FTS5 only.
export let vectorSupport = false;
try {
  sqliteVec.load(db);
  vectorSupport = true;
} catch (err: any) {
  console.warn(
    `[db] sqlite-vec extension failed to load (${err?.message ?? err}); ` +
      `vector search disabled, falling back to FTS5-only recall`
  );
}

// Run migrations at module-load time so any importer that prepares statements
// against schema tables (e.g. audit.ts) can rely on those tables existing.
runMigrationsSync();

export function runMigrations(): void {
  runMigrationsSync();
}

function ensureVectorTables(): void {
  if (!vectorSupport) return;
  try {
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS memory_vectors USING vec0(
         node_id TEXT PRIMARY KEY,
         embedding float[${VEC_DIMS}]
       )`
    );
  } catch (err: any) {
    console.warn(
      `[db] failed to create memory_vectors vec0 table: ${err?.message ?? err}`
    );
    vectorSupport = false;
  }
}

function runMigrationsSync(): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_version (
       version INTEGER PRIMARY KEY,
       applied_at TEXT NOT NULL
     );`
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = Number(file.split("_")[0]);
    const row = db
      .prepare("SELECT version FROM schema_version WHERE version = ?")
      .get(version);
    if (row) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    db.exec(sql);
    console.log(`[db] applied migration ${file}`);
  }

  ensureVectorTables();
}

export { VEC_DIMS };
