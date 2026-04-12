import { vault } from "./vault.js";
import { audit } from "./audit.js";

export type ConnectorId = "gmail" | "gcal" | "drive" | "pipedrive";

export interface ConnectorStatus {
  id: ConnectorId;
  linked: boolean;
  error?: string;
}

// Vault key conventions: "<connector>.<field>"
// e.g. gmail.client_id, gmail.client_secret, gmail.refresh_token
export function vaultKey(connector: ConnectorId, field: string): string {
  return `${connector}.${field}`;
}

export function setCreds(connector: ConnectorId, creds: Record<string, string>): void {
  if (vault.isLocked()) throw new Error("vault locked");
  for (const [k, v] of Object.entries(creds)) {
    vault.set(vaultKey(connector, k), v);
  }
  audit({
    actor: "user",
    action: "connector.creds.set",
    subject: connector,
    metadata: { keys: Object.keys(creds) },
  });
}

export function getCreds(connector: ConnectorId, fields: string[]): Record<string, string> | null {
  if (vault.isLocked()) return null;
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = vault.get(vaultKey(connector, f));
    if (!v) return null;
    out[f] = v;
  }
  return out;
}
