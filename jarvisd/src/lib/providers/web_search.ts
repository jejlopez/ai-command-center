// Web search via Anthropic's tool_use — Claude calls web_search tool itself.
// This wraps callAnthropic with the web_search tool enabled.

import Anthropic from "@anthropic-ai/sdk";
import { vault } from "../vault.js";
import { audit } from "../audit.js";
import type { ProviderCallInput, ProviderCallOutput } from "./anthropic.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = vault.get("anthropic_api_key");
  if (!apiKey) throw new Error("anthropic_api_key not set");
  client = new Anthropic({ apiKey });
  return client;
}

export function resetWebSearchClient(): void {
  client = null;
}

export async function callWithWebSearch(input: ProviderCallInput): Promise<ProviderCallOutput> {
  const c = getClient();

  const msg = await c.messages.create({
    model: input.model || "claude-sonnet-4-6",
    max_tokens: input.maxTokens ?? 2048,
    system: input.system ?? "You are JARVIS, an AI assistant. When the user asks about current events, prices, news, or anything requiring up-to-date information, use the web_search tool to find the answer. Be concise and direct.",
    tools: [
      {
        type: "web_search_20250305" as any,
        name: "web_search",
        max_uses: 3,
      } as any,
    ],
    messages: [{ role: "user", content: input.prompt }],
  });

  // Extract text from the response (may include tool results)
  const textBlocks = msg.content.filter((b: any) => b.type === "text");
  const text = textBlocks.map((b: any) => b.text).join("\n");

  audit({
    actor: "system",
    action: "web_search.call",
    metadata: {
      model: input.model,
      tokensIn: msg.usage.input_tokens,
      tokensOut: msg.usage.output_tokens,
      toolUses: msg.content.filter((b: any) => b.type === "tool_use").length,
    },
  });

  return {
    text,
    tokensIn: msg.usage.input_tokens,
    tokensOut: msg.usage.output_tokens,
  };
}
