// Panic button — emergency lockdown for the Stark Protocol.
//
// When triggered: locks vault, kills all running skill jobs, clears
// in-memory secrets, broadcasts panic event to all connected clients.
// Audit-logged as a critical event.

import { vault } from "./vault.js";
import { audit } from "./audit.js";
import { broadcast } from "./ws.js";
import { bus } from "./events.js";

export interface PanicResult {
  vaultLocked: boolean;
  jobsKilled: number;
  memoryCleared: boolean;
  ts: string;
}

/**
 * Execute emergency lockdown.
 * - Locks the vault (wipes in-memory master key + decrypted data).
 * - Kills all in-flight skill runs (via event bus — workflow engine listens).
 * - Broadcasts panic event to all WebSocket clients so UI can react.
 */
export function panic(reason?: string): PanicResult {
  const ts = new Date().toISOString();

  // 1. Lock vault — wipes unlockedKey and unlockedData from memory.
  const wasUnlocked = !vault.isLocked();
  vault.lock();

  // 2. Signal all running jobs to abort.
  // The workflow engine should listen for "panic" and cancel in-flight runs.
  bus.emit("panic", { reason, ts });

  // 3. Broadcast to connected clients.
  broadcast("panic" as any, { reason: reason ?? "Emergency lockdown triggered", ts });

  // 4. Audit the event as critical.
  audit({
    actor: "user",
    action: "panic.triggered",
    reason: reason ?? "manual panic button",
    metadata: { vaultWasUnlocked: wasUnlocked },
  });

  return {
    vaultLocked: true,
    jobsKilled: 0, // Actual count comes from workflow engine responding to the event.
    memoryCleared: wasUnlocked,
    ts,
  };
}
