// Conversation history persistence.
//
// One conversation per X-Session-Id. Stores full Anthropic ContentBlockParam[]
// arrays as JSON so assistant turns with tool_use blocks round-trip cleanly
// back into messages.stream(). Truncation is done at load time — we always
// persist the complete history, then return the last-N-turns-or-M-tokens
// window that will actually be sent to Claude.

import type Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { db } from "../db/db.js";
import { audit } from "./audit.js";

export interface ConversationRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
}

export interface MessageRow {
  id: number;
  conversationId: string;
  ts: string;
  role: "user" | "assistant";
  content: Anthropic.ContentBlockParam[] | string;
  runId?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export interface LoadOptions {
  /** Max total turns (user + assistant each count as 1). Default 40. */
  maxTurns?: number;
  /** Rough per-character-to-token estimate cap. Default 12_000 tokens. */
  maxTokens?: number;
  /** If the newest message is older than this, return []. Default 2h (idle break). */
  idleBreakMs?: number;
}

const DEFAULT_MAX_TURNS = 40;
const DEFAULT_MAX_TOKENS = 12_000;
const DEFAULT_IDLE_BREAK_MS = 2 * 60 * 60 * 1000;
const CHARS_PER_TOKEN = 3.5;

function isValidSessionId(id: string): boolean {
  return typeof id === "string" && id.length >= 8 && id.length <= 128 && /^[A-Za-z0-9_-]+$/.test(id);
}

/** Generate a fresh session id. Caller is responsible for persisting it. */
export function newSessionId(): string {
  return randomUUID();
}

function rowToConversation(row: any): ConversationRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title ?? null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

function rowToMessage(row: any): MessageRow {
  let content: MessageRow["content"];
  try {
    const parsed = JSON.parse(row.content);
    content = parsed;
  } catch {
    // Back-compat for rows written as plain strings
    content = row.content;
  }
  return {
    id: row.id,
    conversationId: row.conversation_id,
    ts: row.ts,
    role: row.role,
    content,
    runId: row.run_id ?? undefined,
    tokensIn: row.tokens_in ?? undefined,
    tokensOut: row.tokens_out ?? undefined,
  };
}

export const conversations = {
  /** Get or create a conversation row for a session id. Throws on malformed id. */
  getOrCreate(sessionId: string): ConversationRow {
    if (!isValidSessionId(sessionId)) {
      throw new Error(`invalid session id: must be 8-128 URL-safe chars`);
    }
    const existing = db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(sessionId) as any;
    if (existing) return rowToConversation(existing);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO conversations(id, created_at, updated_at) VALUES (?, ?, ?)`
    ).run(sessionId, now, now);
    audit({ actor: "system", action: "conversation.create", subject: sessionId });
    return {
      id: sessionId,
      createdAt: now,
      updatedAt: now,
      title: null,
      metadata: null,
    };
  },

  get(sessionId: string): ConversationRow | null {
    const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(sessionId) as any;
    return row ? rowToConversation(row) : null;
  },

  /** Append a message; updates the conversation's updated_at touch. */
  append(args: {
    conversationId: string;
    role: "user" | "assistant";
    content: Anthropic.ContentBlockParam[] | string;
    runId?: string;
    tokensIn?: number;
    tokensOut?: number;
  }): MessageRow {
    const now = new Date().toISOString();
    const serialized =
      typeof args.content === "string"
        ? JSON.stringify(args.content)
        : JSON.stringify(args.content);
    const info = db
      .prepare(
        `INSERT INTO messages(conversation_id, ts, role, content, run_id, tokens_in, tokens_out)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        args.conversationId,
        now,
        args.role,
        serialized,
        args.runId ?? null,
        args.tokensIn ?? null,
        args.tokensOut ?? null
      );
    db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
      now,
      args.conversationId
    );
    const row = db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(info.lastInsertRowid) as any;
    return rowToMessage(row);
  },

  /**
   * Load the window of recent messages that will be sent to Claude on the next
   * turn. Applies truncation rules:
   *   - Idle break: if newest message is older than idleBreakMs → return []
   *     (fresh-turn behavior)
   *   - Cap at maxTurns most-recent messages
   *   - Further cap by rough token estimate (chars/3.5)
   *   - Result MUST start with a user role to satisfy the API
   */
  loadRecent(sessionId: string, opts: LoadOptions = {}): MessageRow[] {
    const maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS;
    const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
    const idleMs = opts.idleBreakMs ?? DEFAULT_IDLE_BREAK_MS;

    const rows = db
      .prepare(
        `SELECT * FROM messages
         WHERE conversation_id = ?
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(sessionId, maxTurns) as any[];
    if (rows.length === 0) return [];

    // Idle break — newest message age
    const newestTs = rows[0].ts as string;
    const age = Date.now() - Date.parse(newestTs);
    if (age > idleMs) return [];

    // Reverse to chronological, then trim by token estimate (drop from front)
    const chronological = rows.reverse().map(rowToMessage);
    let totalChars = chronological.reduce((s, m) => s + charsOf(m.content), 0);
    while (chronological.length > 0 && totalChars / CHARS_PER_TOKEN > maxTokens) {
      const dropped = chronological.shift()!;
      totalChars -= charsOf(dropped.content);
    }

    // API requirement: conversation must start with a user turn.
    // If our truncation left an assistant-first window, drop leading assistant
    // messages until the head is 'user'. This prevents a 400 on the next call.
    while (chronological.length > 0 && chronological[0].role !== "user") {
      chronological.shift();
    }
    return chronological;
  },

  /** Fetch all messages for a conversation (no truncation). Used by the UI. */
  listAll(sessionId: string): MessageRow[] {
    const rows = db
      .prepare(
        `SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC`
      )
      .all(sessionId) as any[];
    return rows.map(rowToMessage);
  },

  /** Delete all messages in a conversation, keep the conversation row. */
  clear(sessionId: string): number {
    const info = db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(sessionId);
    audit({
      actor: "user",
      action: "conversation.clear",
      subject: sessionId,
      metadata: { deletedCount: info.changes },
    });
    return info.changes;
  },

  /** Drop the entire conversation (cascades to messages). */
  delete(sessionId: string): boolean {
    const info = db.prepare("DELETE FROM conversations WHERE id = ?").run(sessionId);
    audit({
      actor: "user",
      action: "conversation.delete",
      subject: sessionId,
      metadata: { removed: info.changes > 0 },
    });
    return info.changes > 0;
  },

  /** List conversations, most-recently-updated first. */
  list(limit = 50): ConversationRow[] {
    const rows = db
      .prepare(
        `SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?`
      )
      .all(limit) as any[];
    return rows.map(rowToConversation);
  },

  /**
   * Delete messages older than N days. Returns the deletion count.
   * Does NOT delete the conversation row — an empty conversation is still
   * a valid session users can continue.
   */
  pruneOlderThan(days: number): number {
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
    const info = db.prepare(`DELETE FROM messages WHERE ts < ?`).run(cutoff);
    if (info.changes > 0) {
      audit({
        actor: "system",
        action: "conversation.prune",
        metadata: { olderThanDays: days, deletedCount: info.changes, cutoff },
      });
    }
    return info.changes;
  },
};

function charsOf(content: MessageRow["content"]): number {
  if (typeof content === "string") return content.length;
  // ContentBlockParam[]: rough size proxy — stringify is good enough for
  // token-budget math, overestimates slightly which is safe for truncation.
  try {
    return JSON.stringify(content).length;
  } catch {
    return 0;
  }
}
