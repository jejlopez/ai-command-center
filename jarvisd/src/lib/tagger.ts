// PII/sensitivity tagger — scans text for sensitive patterns.

export type SensitivityLevel = "public" | "personal" | "sensitive" | "secret";

export interface TagResult {
  level: SensitivityLevel;
  tags: string[];
}

const PATTERNS: Array<{ pattern: RegExp; level: SensitivityLevel; tag: string }> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/, level: "secret", tag: "ssn" },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, level: "secret", tag: "credit_card" },
  { pattern: /\bpassword\s*[:=]\s*\S+/i, level: "secret", tag: "password" },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i, level: "personal", tag: "email" },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, level: "personal", tag: "phone" },
  { pattern: /\b(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*\S+/i, level: "secret", tag: "api_key" },
];

function severity(level: SensitivityLevel): number {
  switch (level) {
    case "public": return 0;
    case "personal": return 1;
    case "sensitive": return 2;
    case "secret": return 3;
  }
}

export function tagText(text: string, currentPrivacy?: string): TagResult {
  const tags: string[] = [];
  let level: SensitivityLevel = (currentPrivacy as SensitivityLevel) ?? "public";
  for (const { pattern, level: patLevel, tag } of PATTERNS) {
    if (pattern.test(text)) {
      tags.push(tag);
      if (severity(patLevel) > severity(level)) level = patLevel;
    }
  }
  return { level, tags };
}

export function sensitivityToPrivacy(level: SensitivityLevel, current?: string): string {
  const currentSev = severity((current as SensitivityLevel) ?? "public");
  return severity(level) > currentSev ? level : (current ?? "public");
}
