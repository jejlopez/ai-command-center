// Email search — search Gmail by contact/domain and return matching messages.
// Used by Deal Room and Lead Detail to show email history per deal.

import type { FastifyInstance } from "fastify";
import { vault } from "../lib/vault.js";
import { audit } from "../lib/audit.js";
import { assertLimit, recordAction } from "../lib/limits.js";

async function getAccessToken(): Promise<string> {
  const refreshToken = vault.get("gmail.refresh_token");
  const clientId = vault.get("gmail.client_id");
  const clientSecret = vault.get("gmail.client_secret");
  if (!refreshToken || !clientId || !clientSecret) throw new Error("Gmail not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Gmail token refresh failed");
  return (await res.json() as any).access_token;
}

export async function emailSearchRoutes(app: FastifyInstance) {
  // Search Gmail by query — returns message metadata
  app.get("/email/search", async (req, reply) => {
    const { q, max } = req.query as any;
    if (!q) return reply.code(400).send({ error: "q (search query) required" });

    if (vault.isLocked()) return reply.code(423).send({ error: "vault locked" });

    try {
      assertLimit("gmail", "scan");
    } catch (err: any) {
      return reply.code(429).send({ error: err.message });
    }

    try {
      const token = await getAccessToken();
      const maxResults = Math.min(Number(max ?? 10), 20);

      const searchRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!searchRes.ok) throw new Error(`Gmail API ${searchRes.status}`);

      const data = await searchRes.json() as any;
      const messageIds = (data.messages ?? []).map((m: any) => m.id);

      const results = [];
      for (const msgId of messageIds) {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!msgRes.ok) continue;
        const msg = await msgRes.json() as any;
        const headers: Record<string, string> = {};
        for (const h of (msg.payload?.headers ?? [])) {
          headers[h.name] = h.value;
        }
        results.push({
          id: msg.id,
          threadId: msg.threadId,
          from: headers.From ?? "",
          to: headers.To ?? "",
          subject: headers.Subject ?? "",
          date: headers.Date ?? "",
          snippet: msg.snippet ?? "",
          labels: msg.labelIds ?? [],
        });
      }

      recordAction("gmail", "scan");

      return results;
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // Get emails for a specific deal/lead by contact email or domain
  app.get("/email/for-contact", async (req, reply) => {
    const { email, domain, max } = req.query as any;
    if (!email && !domain) return reply.code(400).send({ error: "email or domain required" });

    const searchQuery = email
      ? `from:${email} OR to:${email}`
      : `from:${domain} OR to:${domain}`;

    // Redirect to search
    const url = `/email/search?q=${encodeURIComponent(searchQuery)}&max=${max ?? 10}`;
    return reply.redirect(url);
  });
}
