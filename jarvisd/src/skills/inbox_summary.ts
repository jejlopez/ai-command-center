import { randomUUID } from "node:crypto";
import { audit } from "../lib/audit.js";
import { listRecentMessages, gmailStatus } from "../lib/providers/gmail.js";
import { route, estimateCostUsd } from "../lib/router.js";
import { callAnthropic } from "../lib/providers/anthropic.js";
import { callOllama } from "../lib/providers/ollama.js";
import { recordCost } from "../lib/cost.js";
import { vault } from "../lib/vault.js";

export interface InboxSummary {
  generatedAt: string;
  count: number;
  text: string;
  messages: Array<{ from?: string; subject?: string; snippet: string }>;
  model: string;
  costUsd: number;
}

export async function summarizeInbox(max = 10): Promise<InboxSummary> {
  const status = gmailStatus();
  if (!status.linked) {
    throw new Error(status.error ?? "gmail not linked");
  }

  const runId = randomUUID();
  audit({ actor: "skill:inbox_summary", action: "inbox.start", subject: runId });

  const messages = await listRecentMessages(max);
  const condensed = messages.map((m) => ({
    from: m.from,
    subject: m.subject,
    snippet: m.snippet,
  }));

  const prompt = condensed
    .map((m, i) => `[${i + 1}] From: ${m.from}\nSubject: ${m.subject}\nSnippet: ${m.snippet}`)
    .join("\n\n");

  // Route: summary → Haiku, but fallback to local if vault locked / no key.
  let decision = route({ kind: "summary" });
  if (decision.provider === "anthropic" && (vault.isLocked() || !vault.get("anthropic_api_key"))) {
    decision = { provider: "ollama", model: "jarvis:latest", reason: "anthropic unavailable, falling back to local" };
  }

  const result =
    decision.provider === "ollama"
      ? await callOllama({
          model: decision.model,
          maxTokens: 300,
          system: "You are JARVIS. Give the user a crisp, 3-bullet summary of their inbox. No preamble.",
          prompt,
        })
      : await callAnthropic({
          model: decision.model,
          maxTokens: 300,
          system: "You are JARVIS. Give the user a crisp, 3-bullet summary of their inbox. No preamble.",
          prompt,
        });

  const costUsd = estimateCostUsd(decision.model, result.tokensIn, result.tokensOut);
  recordCost({
    provider: decision.provider,
    model: decision.model,
    taskKind: "summary",
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd,
    skill: "inbox_summary",
    runId,
  });

  audit({
    actor: "skill:inbox_summary",
    action: "inbox.complete",
    subject: runId,
    metadata: { count: messages.length, model: decision.model },
  });

  return {
    generatedAt: new Date().toISOString(),
    count: messages.length,
    text: result.text,
    messages: condensed,
    model: decision.model,
    costUsd,
  };
}
