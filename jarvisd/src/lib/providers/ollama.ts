const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

export interface OllamaCallInput {
  model: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
}

export interface OllamaCallOutput {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export async function callOllama(input: OllamaCallInput): Promise<OllamaCallOutput> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      system: input.system,
      stream: false,
      options: {
        num_predict: input.maxTokens ?? 512,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ollama ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    response: string;
    prompt_eval_count?: number;
    eval_count?: number;
  };

  return {
    text: data.response.trim(),
    tokensIn: data.prompt_eval_count ?? 0,
    tokensOut: data.eval_count ?? 0,
  };
}

export async function callOllamaEmbed(
  model: string,
  text: string
): Promise<{ embedding: number[] }> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ollama embed ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { embedding?: number[] };
  if (!Array.isArray(data.embedding)) {
    throw new Error("ollama embed: missing embedding in response");
  }
  return { embedding: data.embedding };
}

export async function ollamaStatus(): Promise<{ up: boolean; models: string[] }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return { up: false, models: [] };
    const data = (await res.json()) as { models: Array<{ name: string }> };
    return { up: true, models: data.models.map((m) => m.name) };
  } catch {
    return { up: false, models: [] };
  }
}
