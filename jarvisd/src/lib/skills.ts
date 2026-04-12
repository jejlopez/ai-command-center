// Skill registry + execution context.
//
// Skills are self-contained units of work with a manifest (name, scopes,
// triggers, router hints) and a `run` entrypoint. Registration happens in
// code at daemon boot — there's no dynamic disk loader yet (batch 2).
//
// The SkillContext handed to each skill abstracts:
//   - memory access         (ctx.memory)
//   - Apple providers       (ctx.apple)
//   - LLM calls             (ctx.callModel) — wraps router + provider + cost
//   - logging               (ctx.log)
//
// `callModel` gracefully falls back to local Ollama if the routed cloud
// provider's vault key is missing, so skills don't need to handle that case
// individually.

import { memory } from "./memory.js";
import * as apple from "./providers/apple.js";
import { route, estimateCostUsd, type TaskKind, type Privacy } from "./router.js";
import { callAnthropic } from "./providers/anthropic.js";
import { callOpenAI } from "./providers/openai.js";
import { callOllama } from "./providers/ollama.js";
import { recordCost } from "./cost.js";
import { vault } from "./vault.js";
import { tagText, sensitivityToPrivacy } from "./tagger.js";
import { policyEngine } from "./policy.js";
import type { SkillManifest } from "../../../shared/types.js";

export interface CallModelInput {
  kind?: TaskKind;
  privacy?: Privacy;
  system?: string;
  prompt: string;
  maxTokens?: number;
}

export interface CallModelOutput {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  provider: string;
  costUsd: number;
}

export interface SkillContext {
  runId: string;
  inputs: Record<string, unknown>;
  triggeredBy: "manual" | "cron" | "event";
  memory: typeof memory;
  apple: typeof apple;
  callModel: (opts: CallModelInput) => Promise<CallModelOutput>;
  log: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface Skill {
  manifest: SkillManifest;
  run: (ctx: SkillContext) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const skills = new Map<string, Skill>();

export const registry = {
  register(skill: Skill): void {
    if (!skill.manifest?.name) {
      throw new Error("skill registration: manifest.name is required");
    }
    skills.set(skill.manifest.name, skill);
  },

  list(): SkillManifest[] {
    return Array.from(skills.values()).map((s) => s.manifest);
  },

  get(name: string): Skill | null {
    return skills.get(name) ?? null;
  },

  clear(): void {
    skills.clear();
  },
};

// ---------------------------------------------------------------------------
// callModel — shared LLM gateway for skills
// ---------------------------------------------------------------------------

function vaultKeyForProvider(provider: string): string | null {
  switch (provider) {
    case "anthropic":
      return "anthropic_api_key";
    case "openai":
      return "openai_api_key";
    case "google":
      return "google_api_key";
    default:
      return null;
  }
}

function cloudProviderAvailable(provider: string): boolean {
  if (provider === "ollama") return true;
  if (vault.isLocked()) return false;
  const key = vaultKeyForProvider(provider);
  if (!key) return false;
  try {
    return Boolean(vault.get(key));
  } catch {
    return false;
  }
}

export async function callModel(
  opts: CallModelInput,
  meta: { skill?: string; runId?: string } = {}
): Promise<CallModelOutput> {
  // --- Shield Protocol: tag prompt for PII/secrets, escalate privacy ---
  const tag = tagText(opts.prompt + (opts.system ?? ""), opts.privacy as any);
  const effectivePrivacy = sensitivityToPrivacy(tag.level, opts.privacy) as Privacy;

  let decision = route({ kind: opts.kind, privacy: effectivePrivacy });

  // --- Shield Protocol: policy engine check before routing ---
  const policyCheck = await policyEngine.beforeRoute({
    kind: opts.kind,
    privacy: effectivePrivacy,
    provider: decision.provider,
    model: decision.model,
    skill: meta.skill,
  });
  if (policyCheck.effect === "deny") {
    // Policy denied this provider — force local.
    decision = {
      provider: "ollama",
      model: "jarvis:latest",
      reason: `Policy denied: ${policyCheck.reason} — forced local`,
    };
  }

  // Fallback to local if cloud key missing.
  if (decision.provider !== "ollama" && !cloudProviderAvailable(decision.provider)) {
    decision = {
      provider: "ollama",
      model: "jarvis:latest",
      reason: `${decision.provider} key missing — falling back to local`,
    };
  }

  let text: string;
  let tokensIn: number;
  let tokensOut: number;

  if (decision.provider === "anthropic") {
    const out = await callAnthropic({
      model: decision.model,
      prompt: opts.prompt,
      system: opts.system,
      maxTokens: opts.maxTokens,
    });
    text = out.text;
    tokensIn = out.tokensIn;
    tokensOut = out.tokensOut;
  } else if (decision.provider === "ollama") {
    const out = await callOllama({
      model: decision.model,
      prompt: opts.prompt,
      system: opts.system,
      maxTokens: opts.maxTokens,
    });
    text = out.text;
    tokensIn = out.tokensIn;
    tokensOut = out.tokensOut;
  } else if (decision.provider === "openai") {
    const out = await callOpenAI({
      model: decision.model,
      prompt: opts.prompt,
      system: opts.system,
      maxTokens: opts.maxTokens,
    });
    text = out.text;
    tokensIn = out.tokensIn;
    tokensOut = out.tokensOut;
  } else {
    // google not implemented yet — degrade to local.
    const out = await callOllama({
      model: "jarvis:latest",
      prompt: opts.prompt,
      system: opts.system,
      maxTokens: opts.maxTokens,
    });
    text = out.text;
    tokensIn = out.tokensIn;
    tokensOut = out.tokensOut;
  }

  const costUsd = estimateCostUsd(decision.model, tokensIn, tokensOut);
  recordCost({
    provider: decision.provider,
    model: decision.model,
    taskKind: opts.kind,
    tokensIn,
    tokensOut,
    costUsd,
    skill: meta.skill,
    runId: meta.runId,
  });

  return { text, tokensIn, tokensOut, model: decision.model, provider: decision.provider, costUsd };
}
