import { callOllamaEmbed } from "./providers/ollama.js";

export const DEFAULT_EMBED_MODEL =
  process.env.JARVIS_EMBED_MODEL ?? "nomic-embed-text";

// Hardcoded to match the vec0 table created in db.ts. nomic-embed-text emits
// 768-dimensional vectors. If you change the model, update EMBED_DIMS as well
// and nuke the memory_vectors table so it gets recreated.
export const EMBED_DIMS = 768;

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

export interface EmbedStatus {
  ok: boolean;
  provider: "ollama";
  model: string;
  dims: number;
  error?: string;
}

let cachedDims: number | null = null;

function stripTag(name: string): string {
  // Ollama tag names look like "nomic-embed-text:latest".
  return name.split(":")[0];
}

async function listOllamaModels(): Promise<string[]> {
  const res = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!res.ok) {
    throw new Error(`ollama /api/tags ${res.status}`);
  }
  const data = (await res.json()) as { models?: Array<{ name: string }> };
  return (data.models ?? []).map((m) => m.name);
}

export async function getEmbedStatus(): Promise<EmbedStatus> {
  const model = DEFAULT_EMBED_MODEL;
  try {
    const models = await listOllamaModels();
    const hasModel = models.some(
      (m) => m === model || stripTag(m) === stripTag(model)
    );
    if (!hasModel) {
      return {
        ok: false,
        provider: "ollama",
        model,
        dims: cachedDims ?? EMBED_DIMS,
        error: `model "${model}" not installed; available: ${models.join(", ") || "<none>"}`,
      };
    }

    if (cachedDims == null) {
      try {
        const { embedding } = await callOllamaEmbed(model, "ping");
        cachedDims = embedding.length;
      } catch (err: any) {
        return {
          ok: false,
          provider: "ollama",
          model,
          dims: EMBED_DIMS,
          error: `probe embed failed: ${err?.message ?? String(err)}`,
        };
      }
    }

    return {
      ok: true,
      provider: "ollama",
      model,
      dims: cachedDims,
    };
  } catch (err: any) {
    return {
      ok: false,
      provider: "ollama",
      model,
      dims: cachedDims ?? EMBED_DIMS,
      error: err?.message ?? String(err),
    };
  }
}

/**
 * Returns the embedding vector for `text`, or `null` on any failure (network,
 * missing model, bad response). Never throws — callers use null as a signal
 * to skip the vector index write and fall back to FTS5 only.
 */
export async function embed(text: string): Promise<number[] | null> {
  if (!text || !text.trim()) return null;
  try {
    const { embedding } = await callOllamaEmbed(DEFAULT_EMBED_MODEL, text);
    if (!Array.isArray(embedding) || embedding.length === 0) return null;
    if (cachedDims == null) cachedDims = embedding.length;
    return embedding;
  } catch {
    return null;
  }
}
