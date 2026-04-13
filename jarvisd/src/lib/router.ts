// Model router: picks the right model for a task.
// v0 — simple rule-based; we'll upgrade with learning later.

export type TaskKind =
  | "classification"
  | "extraction"
  | "summary"
  | "routine_code"
  | "web_search"
  | "complex_reasoning"
  | "long_context"
  | "high_risk"
  | "vision"
  | "chat";

export type Privacy = "public" | "personal" | "sensitive" | "secret";

export interface RouteInput {
  kind?: TaskKind;
  privacy?: Privacy;
  preferLocal?: boolean;
  estimatedTokensIn?: number;
}

export interface RouteDecision {
  provider: "claude-cli" | "anthropic" | "openai" | "google" | "ollama";
  model: string;
  reason: string;
}

// Pricing per 1M tokens (input, output) — rough, used for cost estimates.
export const PRICING: Record<string, { in: number; out: number }> = {
  "claude-opus-4-6":       { in: 15, out: 75 },
  "claude-sonnet-4-6":     { in: 3,  out: 15 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
  "gpt-5":                 { in: 5,  out: 20 },
  "gemini-2.5-pro":        { in: 3,  out: 15 },
  "jarvis:latest":           { in: 0,  out: 0  }, // local
};

// Whether to prefer Claude CLI (subscription) over API (pay-per-token).
// Set by the dispatcher after checking CLI availability at startup.
let cliEnabled = false;
export function setCliEnabled(v: boolean): void { cliEnabled = v; }
export function isCliEnabled(): boolean { return cliEnabled; }

function claude(model: string, reason: string): RouteDecision {
  // Prefer CLI (free on subscription) → fallback to API
  if (cliEnabled) {
    return { provider: "claude-cli", model, reason: `${reason} [CLI]` };
  }
  return { provider: "anthropic", model, reason: `${reason} [API]` };
}

export function route(input: RouteInput): RouteDecision {
  const kind = input.kind ?? "chat";

  // Privacy lockdown — secret / sensitive → local only.
  if (input.privacy === "secret" || input.preferLocal) {
    return { provider: "ollama", model: "jarvis:latest", reason: "privacy=secret or preferLocal" };
  }

  switch (kind) {
    case "classification":
    case "extraction":
      return { provider: "ollama", model: "jarvis:latest", reason: "cheap classification → local" };
    case "summary":
      return claude("claude-haiku-4-5-20251001", "routine summary → Haiku");
    case "routine_code":
      return claude("claude-sonnet-4-6", "routine code → Sonnet");
    case "long_context":
      return { provider: "google", model: "gemini-2.5-pro", reason: "long context → Gemini Pro" };
    case "high_risk":
    case "complex_reasoning":
      return claude("claude-opus-4-6", "complex reasoning → Opus");
    case "vision":
      return claude("claude-sonnet-4-6", "vision → Sonnet");
    case "chat":
    default:
      return claude("claude-sonnet-4-6", "default chat → Sonnet");
  }
}

export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (tokensIn * p.in + tokensOut * p.out) / 1_000_000;
}
