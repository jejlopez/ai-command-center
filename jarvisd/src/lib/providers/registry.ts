import Anthropic from "@anthropic-ai/sdk";
import { vault } from "../vault.js";
import { isLinkedViaOAuth as googleIsLinkedViaOAuth, testOAuth as googleTestOAuth } from "./google_provider_oauth.js";
import type { ProviderId, ProviderTestResult } from "../../../../shared/types.js";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

export interface ProviderRegistryEntry {
  id: ProviderId;
  kind: "cloud" | "local";
  vaultKey: string; // empty string for local
  testFn: () => Promise<ProviderTestResult>;
}

async function testAnthropic(): Promise<ProviderTestResult> {
  const started = Date.now();
  try {
    if (vault.isLocked()) {
      return { ok: false, latencyMs: 0, error: "vault locked" };
    }
    const key = vault.get("anthropic_api_key");
    if (!key) {
      return { ok: false, latencyMs: 0, error: "no key set" };
    }
    const client = new Anthropic({ apiKey: key });
    // Use the cheapest current model for a ping. claude-3-5-haiku-latest was
    // retired 2026-02-19; Haiku 4.5 is the drop-in replacement.
    const model = "claude-haiku-4-5";
    const msg = await client.messages.create({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "ping" }],
    });
    return {
      ok: true,
      latencyMs: Date.now() - started,
      model: (msg as any).model ?? model,
    };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - started, error: err?.message ?? String(err) };
  }
}

async function testNotWired(): Promise<ProviderTestResult> {
  return { ok: false, latencyMs: 0, error: "not wired" };
}

async function testGoogleApiKey(): Promise<ProviderTestResult> {
  const started = Date.now();
  try {
    if (vault.isLocked()) return { ok: false, latencyMs: 0, error: "vault locked" };
    const key = vault.get("google_api_key");
    if (!key) return { ok: false, latencyMs: 0, error: "no key set" };
    const model = "gemini-2.0-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "ping" }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: `${res.status}: ${t.slice(0, 160)}`,
      };
    }
    return { ok: true, latencyMs: Date.now() - started, model };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - started, error: err?.message ?? String(err) };
  }
}

async function testGoogle(): Promise<ProviderTestResult> {
  if (googleIsLinkedViaOAuth()) return googleTestOAuth();
  return testGoogleApiKey();
}

async function testOpenAI(): Promise<ProviderTestResult> {
  const started = Date.now();
  try {
    if (vault.isLocked()) return { ok: false, latencyMs: 0, error: "vault locked" };
    const key = vault.get("openai_api_key");
    if (!key) return { ok: false, latencyMs: 0, error: "no key set" };
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, latencyMs: Date.now() - started, error: `${res.status}: ${t.slice(0, 160)}` };
    }
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - started, error: err?.message ?? String(err) };
  }
}

async function testGroq(): Promise<ProviderTestResult> {
  const started = Date.now();
  try {
    if (vault.isLocked()) return { ok: false, latencyMs: 0, error: "vault locked" };
    const key = vault.get("groq_api_key");
    if (!key) return { ok: false, latencyMs: 0, error: "no key set" };
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, latencyMs: Date.now() - started, error: `${res.status}: ${t.slice(0, 160)}` };
    }
    return { ok: true, latencyMs: Date.now() - started };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - started, error: err?.message ?? String(err) };
  }
}

export function isGoogleLinked(): boolean {
  if (vault.isLocked()) return false;
  if (googleIsLinkedViaOAuth()) return true;
  return vault.get("google_api_key") !== null;
}

export function googleAuthMode(): "api_key" | "oauth" | undefined {
  if (vault.isLocked()) return undefined;
  if (googleIsLinkedViaOAuth()) return "oauth";
  if (vault.get("google_api_key")) return "api_key";
  return undefined;
}

async function testOllama(): Promise<ProviderTestResult> {
  const started = Date.now();
  try {
    const tagsRes = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!tagsRes.ok) {
      return { ok: false, latencyMs: Date.now() - started, error: `tags ${tagsRes.status}` };
    }
    const tags = (await tagsRes.json()) as { models?: Array<{ name: string }> };
    const first = tags.models?.[0]?.name;
    if (!first) {
      return { ok: false, latencyMs: Date.now() - started, error: "no models installed" };
    }
    const genRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: first,
        prompt: "ping",
        stream: false,
        options: { num_predict: 1 },
      }),
    });
    if (!genRes.ok) {
      const body = await genRes.text();
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: `generate ${genRes.status}: ${body.slice(0, 120)}`,
      };
    }
    await genRes.json();
    return { ok: true, latencyMs: Date.now() - started, model: first };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - started, error: err?.message ?? String(err) };
  }
}

export const providerRegistry: Record<ProviderId, ProviderRegistryEntry> = {
  anthropic: {
    id: "anthropic",
    kind: "cloud",
    vaultKey: "anthropic_api_key",
    testFn: testAnthropic,
  },
  openai: {
    id: "openai",
    kind: "cloud",
    vaultKey: "openai_api_key",
    testFn: testOpenAI,
  },
  google: {
    id: "google",
    kind: "cloud",
    vaultKey: "google_api_key",
    testFn: testGoogle,
  },
  groq: {
    id: "groq",
    kind: "cloud",
    vaultKey: "groq_api_key",
    testFn: testGroq,
  },
  ollama: {
    id: "ollama",
    kind: "local",
    vaultKey: "",
    testFn: testOllama,
  },
  "claude-code": {
    id: "claude-code",
    kind: "cloud",
    vaultKey: "claude_code_api_key",
    testFn: testAnthropic, // uses same Anthropic API
  },
  pandadoc: {
    id: "pandadoc",
    kind: "cloud",
    vaultKey: "pandadoc_api_key",
    testFn: async () => ({ ok: true, latencyMs: 0 }), // no test endpoint yet
  },
  pipedrive: {
    id: "pipedrive",
    kind: "cloud",
    vaultKey: "pipedrive_api_key",
    testFn: async () => ({ ok: true, latencyMs: 0 }), // no test endpoint yet
  },
};

export const CLOUD_PROVIDER_IDS: ProviderId[] = ["anthropic", "openai", "google", "groq", "claude-code", "pandadoc", "pipedrive"];

export async function detectOllama(): Promise<{ up: boolean; models: string[] }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return { up: false, models: [] };
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return { up: true, models: (data.models ?? []).map((m) => m.name) };
  } catch {
    return { up: false, models: [] };
  }
}
