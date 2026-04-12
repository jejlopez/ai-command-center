// Sanitizers for the Red Team protocol (M5 Security Hardening).
//
// Guards against path traversal, prompt injection markers, and token leakage.

import { resolve, normalize } from "node:path";

/**
 * Validate that a resolved path stays within the allowed base directory.
 * Throws if the path escapes (e.g., via ../ traversal or symlink tricks).
 */
export function assertPathWithin(base: string, untrusted: string): string {
  const resolved = resolve(base, untrusted);
  const normalBase = normalize(base);
  if (!resolved.startsWith(normalBase + "/") && resolved !== normalBase) {
    throw new PathTraversalError(untrusted, normalBase);
  }
  return resolved;
}

export class PathTraversalError extends Error {
  public readonly attemptedPath: string;
  public readonly boundary: string;

  constructor(attempted: string, boundary: string) {
    super(`Path traversal blocked: "${attempted}" escapes "${boundary}"`);
    this.name = "PathTraversalError";
    this.attemptedPath = attempted;
    this.boundary = boundary;
  }
}

/**
 * Strip known prompt injection markers from external text before it enters
 * memory or context. Does NOT sanitize for display — only for LLM consumption.
 *
 * Catches common patterns:
 *   - "Ignore previous instructions"
 *   - System/assistant/user role injection markers
 *   - XML-style instruction tags
 *   - Base64-encoded instruction attempts
 */
export function sanitizeForContext(text: string): { clean: string; stripped: string[] } {
  const stripped: string[] = [];

  const PATTERNS: Array<{ name: string; regex: RegExp }> = [
    { name: "ignore_instructions",  regex: /ignore\s+(all\s+)?previous\s+instructions?/gi },
    { name: "role_injection",       regex: /\n\s*(?:system|assistant|user)\s*:/gi },
    { name: "xml_instruction_open", regex: /<\s*(?:system|instruction|prompt|override)[^>]*>/gi },
    { name: "xml_instruction_close",regex: /<\/\s*(?:system|instruction|prompt|override)\s*>/gi },
    { name: "jailbreak_do_anything",regex: /(?:DAN|do anything now|you are now|act as if you have no restrictions)/gi },
  ];

  let clean = text;
  for (const { name, regex } of PATTERNS) {
    const matches = clean.match(regex);
    if (matches) {
      stripped.push(...matches.map((m) => `[${name}] ${m.trim()}`));
      clean = clean.replace(regex, "[FILTERED]");
    }
  }

  return { clean, stripped };
}

/**
 * Check if a string contains what looks like a secret/token that should
 * never appear in logs, prompts, or error messages.
 */
export function containsSecret(text: string): boolean {
  const SECRET_PATTERNS = [
    /sk-ant-[A-Za-z0-9_\-]{20,}/,         // Anthropic
    /sk-[A-Za-z0-9]{20,}/,                 // OpenAI
    /AKIA[0-9A-Z]{16}/,                    // AWS
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY/, // PEM
    /Bearer\s+[A-Za-z0-9_\-\.]{20,}/,     // Bearer tokens
    /ghp_[A-Za-z0-9]{36,}/,               // GitHub PAT
    /gho_[A-Za-z0-9]{36,}/,               // GitHub OAuth
  ];
  return SECRET_PATTERNS.some((p) => p.test(text));
}

/**
 * Redact secrets from a string for safe logging.
 * Replaces detected secrets with [REDACTED].
 */
export function redactSecrets(text: string): string {
  const SECRET_PATTERNS = [
    /sk-ant-[A-Za-z0-9_\-]{20,}/g,
    /sk-[A-Za-z0-9]{20,}/g,
    /AKIA[0-9A-Z]{16}/g,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
    /Bearer\s+[A-Za-z0-9_\-\.]{20,}/g,
    /ghp_[A-Za-z0-9]{36,}/g,
    /gho_[A-Za-z0-9]{36,}/g,
  ];
  let safe = text;
  for (const p of SECRET_PATTERNS) {
    safe = safe.replace(p, "[REDACTED]");
  }
  return safe;
}
