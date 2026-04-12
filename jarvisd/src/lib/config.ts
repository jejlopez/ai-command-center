import { db } from "../db/db.js";
import { audit } from "./audit.js";
import type { JarvisConfig, ConfigPatchBody } from "../../../shared/types.js";

const SINGLETON_KEY = "singleton";

const DEFAULTS: JarvisConfig = {
  dailyBudgetUsd: 20,
  currency: "USD",
  privacyLocalOnly: [],
  allowedLocalModels: [],
  preferredCloudModel: undefined,
};

function readRow(): JarvisConfig | null {
  const row = db
    .prepare("SELECT value FROM jarvis_config WHERE key = ?")
    .get(SINGLETON_KEY) as { value: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.value) as JarvisConfig;
  } catch {
    return null;
  }
}

function writeRow(cfg: JarvisConfig): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO jarvis_config(key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(SINGLETON_KEY, JSON.stringify(cfg), now);
}

export const config = {
  get(): JarvisConfig {
    const existing = readRow();
    return existing ?? { ...DEFAULTS };
  },

  patch(partial: ConfigPatchBody): JarvisConfig {
    const current = readRow() ?? { ...DEFAULTS };
    const merged: JarvisConfig = {
      ...current,
      ...(partial.dailyBudgetUsd !== undefined ? { dailyBudgetUsd: partial.dailyBudgetUsd } : {}),
      ...(partial.currency !== undefined ? { currency: partial.currency } : {}),
      ...(partial.privacyLocalOnly !== undefined ? { privacyLocalOnly: partial.privacyLocalOnly } : {}),
      ...(partial.allowedLocalModels !== undefined ? { allowedLocalModels: partial.allowedLocalModels } : {}),
      ...(partial.preferredCloudModel !== undefined ? { preferredCloudModel: partial.preferredCloudModel } : {}),
    };
    writeRow(merged);
    audit({
      actor: "user",
      action: "config.update",
      metadata: { keys: Object.keys(partial) },
    });
    return merged;
  },

  exists(): boolean {
    return readRow() !== null;
  },

  reset(): void {
    db.prepare("DELETE FROM jarvis_config WHERE key = ?").run(SINGLETON_KEY);
  },
};
