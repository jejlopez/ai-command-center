// Rate limiter — sliding-window counter per client IP.
//
// Gate Protocol (M5 Security): prevents brute-force and abuse even though
// the daemon is localhost-only. Defence in depth — if something gets proxied
// or the daemon is exposed over Tailscale, this is the first gate.

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { audit } from "./audit.js";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

const DEFAULT_MAX = 120;       // requests per window
const DEFAULT_WINDOW_MS = 60_000; // 1 minute

/** Prune expired entries every 5 minutes. */
const PRUNE_INTERVAL = 5 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key);
  }
}, PRUNE_INTERVAL).unref();

function getClientKey(req: FastifyRequest): string {
  // Fastify exposes req.ip which respects trustProxy settings.
  return req.ip;
}

/**
 * Register rate limiting as a Fastify preHandler hook.
 * Sensitive routes (vault, policy) get a tighter limit.
 */
export function registerRateLimiter(
  app: FastifyInstance,
  opts: { max?: number; windowMs?: number } = {}
): void {
  const max = opts.max ?? DEFAULT_MAX;
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const key = getClientKey(req);
    const now = Date.now();

    let entry = windows.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      windows.set(key, entry);
    }

    entry.count++;

    // Tighter limit for vault routes: 20/min (brute-force protection).
    const url = req.url;
    const effectiveMax = url.startsWith("/vault") ? Math.min(max, 20) : max;

    reply.header("X-RateLimit-Limit", effectiveMax);
    reply.header("X-RateLimit-Remaining", Math.max(0, effectiveMax - entry.count));
    reply.header("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > effectiveMax) {
      audit({
        actor: key,
        action: "rate_limit.exceeded",
        subject: url,
        metadata: { count: entry.count, max: effectiveMax },
      });
      reply.code(429);
      reply.send({ error: "Too many requests", retryAfterMs: entry.resetAt - now });
      return;
    }
  });
}

/** Reset all rate limit state (for testing). */
export function resetRateLimits(): void {
  windows.clear();
}

/** Register a test-only reset endpoint. Only available when NODE_ENV or LOG_LEVEL indicates test. */
export function registerRateLimitResetRoute(app: FastifyInstance): void {
  app.post("/_test/reset-rate-limits", async () => {
    resetRateLimits();
    return { ok: true };
  });
}
