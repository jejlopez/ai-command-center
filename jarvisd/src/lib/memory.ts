import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { db, JARVIS_HOME, vectorSupport, VEC_DIMS } from "../db/db.js";
import { audit } from "./audit.js";
import { bus } from "./events.js";
import { embed, getEmbedStatus, type EmbedStatus } from "./embeddings.js";
import { tagText, type SensitivityLevel } from "./tagger.js";
import { assertPathWithin } from "./sanitize.js";

const VAULT_DIR = join(JARVIS_HOME, "vault");
mkdirSync(VAULT_DIR, { recursive: true });

export type NodeKind = "person" | "project" | "task" | "fact" | "event" | "pref";

export interface MemoryNode {
  id: string;
  kind: NodeKind;
  label: string;
  body: string | null;
  filePath: string | null;
  trust: number;
  sensitivity: SensitivityLevel;
  createdAt: string;
  updatedAt: string;
}

export interface RememberInput {
  kind: NodeKind;
  label: string;
  body?: string;
  file?: string;        // relative path under vault dir, e.g. "brain/people/alex.md"
  trust?: number;       // 0..1
  links?: Array<{ toId: string; relation: string; weight?: number }>;
}

export interface RecallQuery {
  q: string;
  kinds?: NodeKind[];
  limit?: number;
  maxTokens?: number;   // budget: stop when compiled text >= this
  enhanced?: boolean;   // when true, populate hits + embedStatus
}

export type RecallSource = "vector" | "fts" | "graph" | "hybrid";

export interface RecallHit {
  nodeId: string;
  score: number;
  via: RecallSource;
}

export interface RecallResult {
  compiled: string;                 // compact fact block for the LLM
  tokenEstimate: number;
  nodes: MemoryNode[];
  related: Array<{ src: string; dst: string; relation: string }>;
  hits?: RecallHit[];
  embedStatus?: EmbedStatus;
}

const DEFAULT_TRUST = 0.5;

// Trust decays 5% per 30 days since the node was last updated. Never goes
// below 0.05 — we keep a residual floor so old facts can still surface with
// low confidence. Applied lazily at read time (no schema writes).
function decayTrust(storedTrust: number, updatedAtIso: string): number {
  const ageMs = Date.now() - Date.parse(updatedAtIso);
  if (!Number.isFinite(ageMs) || ageMs <= 0) return storedTrust;
  const periods = ageMs / (30 * 24 * 60 * 60 * 1000);
  const decay = Math.pow(0.95, periods);
  const decayed = storedTrust * decay;
  return Math.max(0.05, Number(decayed.toFixed(4)));
}

// Per-kind TTL in days. Events auto-expire after 90 days; everything else
// persists until explicitly forgotten.
const TTL_DAYS: Partial<Record<NodeKind, number>> = {
  event: 90,
};

function isExpired(row: { kind: NodeKind; updated_at: string }): boolean {
  const ttl = TTL_DAYS[row.kind];
  if (!ttl) return false;
  const age = Date.now() - Date.parse(row.updated_at);
  return age > ttl * 24 * 60 * 60 * 1000;
}

function toNode(row: any): MemoryNode {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    body: row.body,
    filePath: row.file_path,
    trust: decayTrust(row.trust, row.updated_at),
    sensitivity: (row.sensitivity as SensitivityLevel) ?? "none",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Very rough — 4 chars ≈ 1 token.
function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

function writeVaultFile(relPath: string, kind: NodeKind, label: string, body: string, trust: number): void {
  const full = assertPathWithin(VAULT_DIR, relPath);
  mkdirSync(dirname(full), { recursive: true });
  const frontmatter = [
    "---",
    `id: ${label}`,
    `kind: ${kind}`,
    `trust: ${trust}`,
    `updated: ${new Date().toISOString()}`,
    "---",
    "",
  ].join("\n");
  writeFileSync(full, frontmatter + body, "utf8");
}

function deleteVaultFile(relPath: string): void {
  try {
    const full = assertPathWithin(VAULT_DIR, relPath);
    unlinkSync(full);
  } catch {
    // tolerate missing file or path traversal attempt
  }
}

// ---- FTS5 + vector index helpers -------------------------------------------

function ftsInsert(nodeId: string, label: string, body: string | null): void {
  try {
    db.prepare(
      "INSERT INTO memory_fts5(node_id, label, body) VALUES (?, ?, ?)"
    ).run(nodeId, label, body ?? "");
  } catch (err: any) {
    console.warn(`[memory] fts5 insert failed for ${nodeId}: ${err?.message ?? err}`);
  }
}

function ftsDelete(nodeId: string): void {
  try {
    db.prepare("DELETE FROM memory_fts5 WHERE node_id = ?").run(nodeId);
  } catch (err: any) {
    console.warn(`[memory] fts5 delete failed for ${nodeId}: ${err?.message ?? err}`);
  }
}

function vectorToBuffer(vec: number[]): Buffer {
  const f32 = new Float32Array(vec);
  return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
}

async function writeVector(nodeId: string, text: string): Promise<boolean> {
  if (!vectorSupport) return false;
  const vec = await embed(text);
  if (!vec) return false;
  if (vec.length !== VEC_DIMS) {
    console.warn(
      `[memory] embedding dim mismatch for ${nodeId}: got ${vec.length}, expected ${VEC_DIMS}`
    );
    return false;
  }
  try {
    db.prepare(
      "INSERT OR REPLACE INTO memory_vectors(node_id, embedding) VALUES (?, ?)"
    ).run(nodeId, vectorToBuffer(vec));
    return true;
  } catch (err: any) {
    console.warn(`[memory] vector insert failed for ${nodeId}: ${err?.message ?? err}`);
    return false;
  }
}

function vectorDelete(nodeId: string): void {
  if (!vectorSupport) return;
  try {
    db.prepare("DELETE FROM memory_vectors WHERE node_id = ?").run(nodeId);
  } catch (err: any) {
    console.warn(`[memory] vector delete failed for ${nodeId}: ${err?.message ?? err}`);
  }
}

// Escape a query for FTS5 MATCH — quote tokens and drop anything that would
// break the parser. Cheap and cheerful; good enough for short user queries.
function sanitizeFts(q: string): string {
  const tokens = q
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replace(/"/g, '""')}"`);
  return tokens.join(" OR ");
}

// ---- Public API -------------------------------------------------------------

export const memory = {
  remember(input: RememberInput): MemoryNode {
    const id = randomUUID();
    const now = new Date().toISOString();
    const trust = input.trust ?? DEFAULT_TRUST;

    // Shield Protocol: auto-tag sensitivity from content.
    const tag = tagText(`${input.label} ${input.body ?? ""}`);
    const sensitivity = tag.level;

    db.prepare(
      `INSERT INTO memory_nodes(id, kind, label, body, file_path, trust, sensitivity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.kind, input.label, input.body ?? null, input.file ?? null, trust, sensitivity, now, now);

    if (input.file && input.body) {
      writeVaultFile(input.file, input.kind, input.label, input.body, trust);
    }

    if (input.links?.length) {
      const stmt = db.prepare(
        `INSERT INTO memory_edges(src_id, dst_id, relation, ts, weight, source)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const l of input.links) {
        stmt.run(id, l.toId, l.relation, now, l.weight ?? 1.0, "remember");
      }
    }

    // FTS5 index (synchronous, best-effort).
    ftsInsert(id, input.label, input.body ?? null);

    // Vector index (async, best-effort — fire and forget so the HTTP handler
    // returns promptly). Any failure leaves the node in FTS5-only mode.
    const embedText = `${input.label}${input.body ? ` ${input.body}` : ""}`;
    void writeVector(id, embedText);

    db.prepare(
      `INSERT INTO memory_access_log(ts, op, node_id, actor, reason)
       VALUES (?, 'remember', ?, 'system', ?)`
    ).run(now, id, `kind=${input.kind}`);

    audit({
      actor: "system",
      action: "memory.remember",
      subject: id,
      metadata: { kind: input.kind, label: input.label, trust },
    });

    const node = toNode(
      db.prepare("SELECT * FROM memory_nodes WHERE id = ?").get(id)
    );

    bus.emit("memory.remembered", {
      nodeId: id,
      kind: input.kind,
      label: input.label,
    });

    return node;
  },

  forget(id: string): boolean {
    const row = db.prepare("SELECT * FROM memory_nodes WHERE id = ?").get(id) as any;
    if (!row) return false;
    if (row.file_path) deleteVaultFile(row.file_path);
    db.prepare("DELETE FROM memory_edges WHERE src_id = ? OR dst_id = ?").run(id, id);
    db.prepare("DELETE FROM memory_nodes WHERE id = ?").run(id);
    ftsDelete(id);
    vectorDelete(id);
    db.prepare(
      `INSERT INTO memory_access_log(ts, op, node_id, actor, reason)
       VALUES (?, 'forget', ?, 'user', NULL)`
    ).run(new Date().toISOString(), id);
    audit({ actor: "user", action: "memory.forget", subject: id });
    return true;
  },

  async rebuildIndexes(): Promise<{ fts: number; vectors: number; errors: number }> {
    const rows = db.prepare("SELECT * FROM memory_nodes").all() as any[];
    let fts = 0;
    let vectors = 0;
    let errors = 0;

    // Wipe FTS5 and rebuild.
    try {
      db.exec("DELETE FROM memory_fts5");
    } catch (err: any) {
      console.warn(`[memory] fts5 wipe failed: ${err?.message ?? err}`);
      errors++;
    }

    for (const r of rows) {
      try {
        ftsInsert(r.id, r.label, r.body);
        fts++;
      } catch {
        errors++;
      }
    }

    if (vectorSupport) {
      try {
        db.exec("DELETE FROM memory_vectors");
      } catch (err: any) {
        console.warn(`[memory] vectors wipe failed: ${err?.message ?? err}`);
        errors++;
      }
      for (const r of rows) {
        const text = `${r.label}${r.body ? ` ${r.body}` : ""}`;
        const ok = await writeVector(r.id, text);
        if (ok) vectors++;
      }
    }

    return { fts, vectors, errors };
  },

  async recall(query: RecallQuery): Promise<RecallResult> {
    const limit = query.limit ?? 20;
    const maxTokens = query.maxTokens ?? 2000;
    const enhanced = query.enhanced === true;

    // Score bucket: nodeId -> { score, via }.
    const scores = new Map<string, { score: number; via: Set<RecallSource> }>();

    const bump = (nodeId: string, score: number, via: RecallSource) => {
      const existing = scores.get(nodeId);
      if (existing) {
        existing.score = Math.max(existing.score, score);
        existing.via.add(via);
      } else {
        scores.set(nodeId, { score, via: new Set<RecallSource>([via]) });
      }
    };

    // ---- Vector path ----
    let embedStatus: EmbedStatus | undefined;
    if (enhanced) {
      embedStatus = await getEmbedStatus();
    }

    if (vectorSupport) {
      const qvec = await embed(query.q);
      if (qvec && qvec.length === VEC_DIMS) {
        try {
          const vrows = db
            .prepare(
              `SELECT node_id, distance
               FROM memory_vectors
               WHERE embedding MATCH ?
                 AND k = 20`
            )
            .all(vectorToBuffer(qvec)) as Array<{ node_id: string; distance: number }>;
          for (const v of vrows) {
            // sqlite-vec returns L2 distance by default. Map to a 0..1 score
            // that decreases with distance. Clamp to keep it well-behaved.
            const score = 1 / (1 + Math.max(0, v.distance));
            bump(v.node_id, score, "vector");
          }
        } catch (err: any) {
          console.warn(`[memory] vector recall failed: ${err?.message ?? err}`);
        }
      }
    }

    // ---- FTS5 path ----
    const ftsQuery = sanitizeFts(query.q);
    if (ftsQuery.length > 0) {
      try {
        const frows = db
          .prepare(
            `SELECT node_id, bm25(memory_fts5) AS bm25
             FROM memory_fts5
             WHERE memory_fts5 MATCH ?
             LIMIT 20`
          )
          .all(ftsQuery) as Array<{ node_id: string; bm25: number }>;
        for (const f of frows) {
          // bm25 is smaller-is-better and can be negative. Normalize via
          // 1 / (1 + max(0, bm25)) so great matches approach 1.
          const score = 1 / (1 + Math.max(0, f.bm25));
          bump(f.node_id, score, "fts");
        }
      } catch (err: any) {
        console.warn(`[memory] fts5 recall failed: ${err?.message ?? err}`);
      }
    }

    // ---- Graph boost ----
    // Exact label match (case-insensitive) gets +0.2; its 1-hop neighbours get +0.1.
    const exactRows = db
      .prepare("SELECT id FROM memory_nodes WHERE lower(label) = lower(?)")
      .all(query.q) as Array<{ id: string }>;
    for (const e of exactRows) {
      bump(e.id, (scores.get(e.id)?.score ?? 0) + 0.2, "graph");
      const neighbours = db
        .prepare(
          "SELECT dst_id AS id FROM memory_edges WHERE src_id = ? UNION SELECT src_id AS id FROM memory_edges WHERE dst_id = ?"
        )
        .all(e.id, e.id) as Array<{ id: string }>;
      for (const n of neighbours) {
        bump(n.id, (scores.get(n.id)?.score ?? 0) + 0.1, "graph");
      }
    }

    // ---- Kind filter + rank ----
    const ranked = Array.from(scores.entries())
      .map(([nodeId, s]) => {
        const via: RecallSource =
          s.via.size > 1 ? "hybrid" : (Array.from(s.via)[0] as RecallSource);
        return { nodeId, score: s.score, via };
      })
      .sort((a, b) => b.score - a.score);

    // Hydrate + kind filter in one pass, preserving rank order.
    const kindSet = query.kinds?.length ? new Set(query.kinds) : null;
    const nodes: MemoryNode[] = [];
    const hits: RecallHit[] = [];
    const seen = new Set<string>();
    for (const r of ranked) {
      if (seen.has(r.nodeId)) continue;
      const row = db
        .prepare("SELECT * FROM memory_nodes WHERE id = ?")
        .get(r.nodeId) as any;
      if (!row) continue;
      if (kindSet && !kindSet.has(row.kind)) continue;
      nodes.push(toNode(row));
      hits.push(r);
      seen.add(r.nodeId);
      if (nodes.length >= limit) break;
    }

    // ---- Fallback: if nothing matched, LIKE-search so tests and bare
    // installs still return something. ----
    if (nodes.length === 0) {
      const like = `%${query.q}%`;
      const kindFilter = query.kinds?.length
        ? ` AND kind IN (${query.kinds.map(() => "?").join(",")})`
        : "";
      const params: any[] = [like, like];
      if (query.kinds?.length) params.push(...query.kinds);
      params.push(limit);
      const likeRows = db
        .prepare(
          `SELECT * FROM memory_nodes
           WHERE (label LIKE ? OR body LIKE ?)${kindFilter}
           ORDER BY trust DESC, updated_at DESC
           LIMIT ?`
        )
        .all(...params) as any[];
      for (const row of likeRows) {
        nodes.push(toNode(row));
        hits.push({ nodeId: row.id, score: 0.05, via: "fts" });
      }
    }

    // ---- Walk 1 hop for related edges ----
    const ids = nodes.map((n) => n.id);
    let related: Array<{ src: string; dst: string; relation: string }> = [];
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      related = db
        .prepare(
          `SELECT src_id AS src, dst_id AS dst, relation
           FROM memory_edges
           WHERE src_id IN (${placeholders}) OR dst_id IN (${placeholders})
           LIMIT 100`
        )
        .all(...ids, ...ids) as any[];
    }

    // ---- Compile a compact fact block, respecting token budget ----
    const parts: string[] = [];
    let total = 0;
    for (const n of nodes) {
      const line = `- [${n.kind}] ${n.label}${n.body ? `: ${n.body}` : ""} (trust=${n.trust.toFixed(2)})`;
      const t = estimateTokens(line);
      if (total + t > maxTokens) break;
      parts.push(line);
      total += t;

      if (!n.body && n.filePath) {
        const full = join(VAULT_DIR, n.filePath);
        if (existsSync(full)) {
          const md = readFileSync(full, "utf8");
          const stripped = md.replace(/^---[\s\S]*?---\s*/, "").trim();
          const snippet = stripped.slice(0, 400);
          const st = estimateTokens(snippet);
          if (total + st <= maxTokens) {
            parts.push(`  ${snippet}`);
            total += st;
          }
        }
      }
    }

    const compiled = parts.join("\n");

    db.prepare(
      `INSERT INTO memory_access_log(ts, op, node_id, actor, reason)
       VALUES (?, 'recall', NULL, 'system', ?)`
    ).run(new Date().toISOString(), `q="${query.q}" hits=${nodes.length}`);

    audit({
      actor: "system",
      action: "memory.recall",
      metadata: { q: query.q, hits: nodes.length, tokens: total },
    });

    const result: RecallResult = { compiled, tokenEstimate: total, nodes, related };
    if (enhanced) {
      result.hits = hits;
      result.embedStatus = embedStatus;
    }
    return result;
  },

  get(id: string): MemoryNode | null {
    const row = db.prepare("SELECT * FROM memory_nodes WHERE id = ?").get(id) as any;
    return row ? toNode(row) : null;
  },

  list(kind?: NodeKind, limit = 50): MemoryNode[] {
    const rows = kind
      ? (db.prepare("SELECT * FROM memory_nodes WHERE kind = ? ORDER BY updated_at DESC LIMIT ?").all(kind, limit) as any[])
      : (db.prepare("SELECT * FROM memory_nodes ORDER BY updated_at DESC LIMIT ?").all(limit) as any[]);
    // Filter out TTL-expired rows (lazy cleanup on read).
    return rows.filter((r) => !isExpired(r)).map(toNode);
  },
};

export { VAULT_DIR };
