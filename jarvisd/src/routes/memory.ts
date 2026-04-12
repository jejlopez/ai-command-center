import type { FastifyInstance } from "fastify";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { z } from "zod";
import { memory, type NodeKind } from "../lib/memory.js";
import { getEmbedStatus } from "../lib/embeddings.js";
import { db } from "../db/db.js";

const NodeKindEnum = z.enum(["person", "project", "task", "fact", "event", "pref"]);

const RememberBody = z.object({
  kind: NodeKindEnum,
  label: z.string().min(1),
  body: z.string().optional(),
  file: z.string().optional(),
  trust: z.number().min(0).max(1).optional(),
  links: z
    .array(
      z.object({
        toId: z.string(),
        relation: z.string(),
        weight: z.number().optional(),
      })
    )
    .optional(),
});

const RecallQuery = z.object({
  q: z.string().min(1),
  kinds: z.array(NodeKindEnum).optional(),
  limit: z.coerce.number().optional(),
  maxTokens: z.coerce.number().optional(),
  enhanced: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "true" || v === "1"),
});

const ObsidianImportBody = z.object({
  path: z.string().min(1),
  kind: NodeKindEnum.optional(),
  defaultTrust: z.number().min(0).max(1).optional(),
  dryRun: z.boolean().optional(),
});

// ---- Obsidian import helpers ------------------------------------------------

interface ParsedFrontmatter {
  frontmatter: Record<string, string>;
  body: string;
}

function parseFrontmatter(raw: string): ParsedFrontmatter {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { frontmatter: {}, body: raw };
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const val = m[2].trim().replace(/^["'](.*)["']$/, "$1");
    fm[m[1].trim()] = val;
  }
  return { frontmatter: fm, body: raw.slice(match[0].length) };
}

function walkMarkdown(root: string): string[] {
  const out: string[] = [];
  const queue: string[] = [root];
  while (queue.length) {
    const dir = queue.shift()!;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        queue.push(full);
      } else if (st.isFile() && extname(entry).toLowerCase() === ".md") {
        out.push(full);
      }
    }
  }
  return out;
}

const VALID_KINDS: NodeKind[] = [
  "person",
  "project",
  "task",
  "fact",
  "event",
  "pref",
];

function coerceKind(input: string | undefined, fallback: NodeKind): NodeKind {
  if (!input) return fallback;
  const k = input.toLowerCase() as NodeKind;
  return VALID_KINDS.includes(k) ? k : fallback;
}

function coerceTrust(input: string | undefined, fallback: number): number {
  if (!input) return fallback;
  const n = Number(input);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

// ---- Routes -----------------------------------------------------------------

export async function memoryRoutes(app: FastifyInstance): Promise<void> {
  app.post("/memory/remember", async (req, reply) => {
    const parsed = RememberBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    return memory.remember(parsed.data);
  });

  app.get("/memory/recall", async (req, reply) => {
    const parsed = RecallQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    return memory.recall(parsed.data);
  });

  app.get("/memory/embed/status", async () => {
    return getEmbedStatus();
  });

  app.post("/memory/rebuild-indexes", async () => memory.rebuildIndexes());

  app.post("/memory/import/obsidian", async (req, reply) => {
    const parsed = ObsidianImportBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }
    const { path, kind: defaultKind, defaultTrust, dryRun } = parsed.data;

    let st;
    try {
      st = statSync(path);
    } catch (err: any) {
      reply.code(400);
      return { error: `cannot stat path: ${err?.message ?? err}` };
    }
    if (!st.isDirectory()) {
      reply.code(400);
      return { error: "path is not a directory" };
    }

    const files = walkMarkdown(path);
    const result = {
      scanned: files.length,
      imported: 0,
      skipped: 0,
      errors: [] as Array<{ file: string; error: string }>,
    };

    const dedupeStmt = db.prepare(
      "SELECT id FROM memory_nodes WHERE label = ? AND kind = ? LIMIT 1"
    );

    for (const file of files) {
      try {
        const raw = readFileSync(file, "utf8");
        const { frontmatter, body } = parseFrontmatter(raw);

        // Determine kind: frontmatter > request default > "fact".
        const kind = coerceKind(
          frontmatter.kind,
          defaultKind ?? "fact"
        );

        // Determine label: frontmatter.label / id > filename (minus extension).
        const label =
          frontmatter.label ||
          frontmatter.id ||
          basename(file, extname(file));

        const trust = coerceTrust(frontmatter.trust, defaultTrust ?? 0.5);

        // Dedupe by (label, kind).
        const existing = dedupeStmt.get(label, kind) as { id: string } | undefined;
        if (existing) {
          result.skipped++;
          continue;
        }

        if (dryRun) {
          // Don't mutate counts that imply a write happened. Callers can
          // compute the "would-import" count as scanned - skipped - errors.
          continue;
        }

        memory.remember({
          kind,
          label,
          body: body.trim() || undefined,
          trust,
        });
        result.imported++;
      } catch (err: any) {
        result.errors.push({
          file,
          error: err?.message ?? String(err),
        });
      }
    }

    return result;
  });

  app.get<{ Params: { id: string } }>("/memory/:id", async (req, reply) => {
    const node = memory.get(req.params.id);
    if (!node) {
      reply.code(404);
      return { error: "not found" };
    }
    return node;
  });

  app.delete<{ Params: { id: string } }>("/memory/:id", async (req, reply) => {
    const ok = memory.forget(req.params.id);
    if (!ok) {
      reply.code(404);
      return { error: "not found" };
    }
    return { ok: true };
  });

  app.get("/memory", async (req) => {
    const kind = (req.query as any)?.kind;
    return memory.list(kind);
  });
}
