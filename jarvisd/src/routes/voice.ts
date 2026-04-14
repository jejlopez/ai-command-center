/**
 * Voice transcription route — POST /voice/transcribe
 *
 * Requires:
 *   - `@fastify/multipart` registered on the Fastify instance
 *     (run: npm install @fastify/multipart in jarvisd/)
 *   - `whisper` CLI available in PATH
 *     (run: pip install openai-whisper  OR  brew install whisper)
 *
 * Returns: { text: string }
 */

import type { FastifyInstance } from "fastify";
import { execFile } from "node:child_process";
import { writeFile, unlink, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function voiceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/voice/transcribe", async (req, reply) => {
    // @ts-expect-error — added by @fastify/multipart
    const data = await req.file();
    if (!data) {
      reply.code(400);
      return { error: "no audio file" };
    }

    const buffer = await data.toBuffer();
    const id = randomUUID();
    const tmpPath = join(tmpdir(), `jarvis-voice-${id}.webm`);
    const txtPath = join(tmpdir(), `jarvis-voice-${id}.txt`);

    try {
      await writeFile(tmpPath, buffer);

      const text = await new Promise<string>((resolve, reject) => {
        execFile(
          "whisper",
          [
            tmpPath,
            "--model", "base",
            "--output_format", "txt",
            "--output_dir", tmpdir(),
          ],
          { timeout: 30_000 },
          async (err, stdout) => {
            if (err) return reject(err);

            // Whisper writes <input_stem>.txt in output_dir
            const stemPath = tmpPath.replace(".webm", ".txt");
            try {
              const result = (await readFile(stemPath, "utf-8")).trim();
              await unlink(stemPath).catch(() => {});
              resolve(result);
            } catch {
              // Fallback: parse stdout
              resolve(stdout.trim());
            }
          }
        );
      });

      return { text };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "whisper transcription failed");
      reply.code(500);
      return { error: "transcription failed", detail: message };
    } finally {
      await unlink(tmpPath).catch(() => {});
      await unlink(txtPath).catch(() => {});
    }
  });
}
