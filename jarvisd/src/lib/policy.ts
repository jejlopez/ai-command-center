// Policy engine — evaluates rules before tool/model calls.

import { db } from "../db/db.js";
import { audit } from "./audit.js";

export interface PolicyRule {
  id: string;
  name: string;
  effect: "allow" | "deny";
  conditions: {
    privacy?: string[];
    providers?: string[];
    skills?: string[];
    timeRange?: { after?: string; before?: string };
  };
  reason: string;
  enabled: boolean;
}

export interface PolicyCheck {
  effect: "allow" | "deny";
  reason: string;
  rule?: string;
}

interface RouteContext {
  kind?: string;
  privacy?: string;
  provider: string;
  model: string;
  skill?: string;
}

const DEFAULT_RULES: PolicyRule[] = [
  {
    id: "secret-local-only",
    name: "Secret data stays local",
    effect: "deny",
    conditions: { privacy: ["secret"], providers: ["anthropic", "openai", "google", "groq"] },
    reason: "Secret-tagged data cannot be sent to cloud providers",
    enabled: true,
  },
  {
    id: "sensitive-no-openai",
    name: "Sensitive data avoids OpenAI",
    effect: "deny",
    conditions: { privacy: ["sensitive"], providers: ["openai"] },
    reason: "Sensitive data should not be sent to OpenAI",
    enabled: true,
  },
];

let rules: PolicyRule[] = [...DEFAULT_RULES];

function timeInRange(range: { after?: string; before?: string }): boolean {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (range.after && hhmm < range.after) return false;
  if (range.before && hhmm > range.before) return false;
  return true;
}

function matchesRule(rule: PolicyRule, ctx: RouteContext): boolean {
  if (!rule.enabled) return false;
  const c = rule.conditions;
  if (c.privacy && !c.privacy.includes(ctx.privacy ?? "public")) return false;
  if (c.providers && !c.providers.includes(ctx.provider)) return false;
  if (c.skills && ctx.skill && !c.skills.includes(ctx.skill)) return false;
  if (c.timeRange && !timeInRange(c.timeRange)) return false;
  return true;
}

export const policyEngine = {
  async init(): Promise<void> {
    try {
      const row = db.prepare(
        "SELECT value FROM jarvis_config WHERE key = 'policy_rules'"
      ).get() as any;
      if (row?.value) {
        const custom = JSON.parse(row.value) as PolicyRule[];
        rules = [...DEFAULT_RULES, ...custom];
      }
    } catch { /* defaults */ }
  },

  async beforeRoute(ctx: RouteContext): Promise<PolicyCheck> {
    for (const rule of rules) {
      if (rule.effect === "deny" && matchesRule(rule, ctx)) {
        audit({
          actor: "policy",
          action: "policy.deny",
          subject: rule.id,
          metadata: { provider: ctx.provider, privacy: ctx.privacy, skill: ctx.skill },
        });
        return { effect: "deny", reason: rule.reason, rule: rule.id };
      }
    }
    return { effect: "allow", reason: "no deny rules matched" };
  },

  async beforeEgress(
    url: string,
    _headers: Record<string, string>,
    actor?: string
  ): Promise<{ effect: "allow" | "deny"; reason: string; matched: Array<{ effect: string; policyId: string }> }> {
    // Default allowlist: only known API hosts.
    const ALLOWED_HOSTS = [
      "api.anthropic.com",
      "api.openai.com",
      "generativelanguage.googleapis.com",
      "api.groq.com",
      "127.0.0.1",
      "localhost",
    ];
    try {
      const parsed = new URL(url);
      if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
        audit({
          actor: actor ?? "system",
          action: "egress.deny",
          subject: url,
          reason: `Host ${parsed.hostname} not in allowlist`,
        });
        return {
          effect: "deny",
          reason: `Host ${parsed.hostname} not in egress allowlist`,
          matched: [{ effect: "deny", policyId: "egress-allowlist" }],
        };
      }
    } catch {
      return { effect: "deny", reason: "Invalid URL", matched: [{ effect: "deny", policyId: "egress-invalid-url" }] };
    }
    return { effect: "allow", reason: "host in allowlist", matched: [] };
  },

  listRules(): PolicyRule[] { return [...rules]; },
  addRule(rule: PolicyRule): void { rules.push(rule); },
  removeRule(id: string): boolean {
    const before = rules.length;
    rules = rules.filter((r) => r.id !== id);
    return rules.length < before;
  },
};
