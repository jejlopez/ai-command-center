// OpenAI chat completions adapter.

import { vault } from "../vault.js";

export interface CallOpenAIInput {
  model?: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
}

export interface CallOpenAIOutput {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export async function callOpenAI(opts: CallOpenAIInput): Promise<CallOpenAIOutput> {
  const apiKey = vault.get("openai_api_key") as string | undefined;
  if (!apiKey) throw new Error("openai_api_key not found in vault");

  const model = opts.model ?? "gpt-4o";
  const messages: Array<{ role: string; content: string }> = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 1024,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${body}`);
  }

  const data = await res.json() as any;
  const choice = data.choices?.[0];

  return {
    text: choice?.message?.content ?? "",
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    model: data.model ?? model,
  };
}
