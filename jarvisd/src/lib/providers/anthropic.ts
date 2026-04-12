import Anthropic from "@anthropic-ai/sdk";
import { vault } from "../vault.js";

export interface ProviderCallInput {
  model: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
}

export interface ProviderCallOutput {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  if (vault.isLocked()) {
    throw new Error("vault locked — cannot read anthropic_api_key");
  }
  const apiKey = vault.get("anthropic_api_key");
  if (!apiKey) {
    throw new Error("anthropic_api_key not set in vault");
  }
  client = new Anthropic({ apiKey });
  return client;
}

export function resetAnthropicClient(): void {
  client = null;
}

export async function callAnthropic(input: ProviderCallInput): Promise<ProviderCallOutput> {
  const c = getClient();
  const msg = await c.messages.create({
    model: input.model,
    max_tokens: input.maxTokens ?? 1024,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
  });

  const text = msg.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");

  return {
    text,
    tokensIn: msg.usage.input_tokens,
    tokensOut: msg.usage.output_tokens,
  };
}
