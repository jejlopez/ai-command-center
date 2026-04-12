// Tiny synchronous in-process event bus.
//
// Listeners are called synchronously from emit(). Any throw is caught and
// written to the audit log so a misbehaving listener can't poison the bus
// or break the caller. Use bus.on(event, fn) — returns an unsubscribe
// closure for convenience.

import { audit } from "./audit.js";

export type Listener = (payload: Record<string, unknown>) => void;

const listeners = new Map<string, Set<Listener>>();

export const bus = {
  on(event: string, fn: Listener): () => void {
    let set = listeners.get(event);
    if (!set) {
      set = new Set<Listener>();
      listeners.set(event, set);
    }
    set.add(fn);
    return () => bus.off(event, fn);
  },

  off(event: string, fn: Listener): void {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) listeners.delete(event);
  },

  emit(event: string, payload: Record<string, unknown>): void {
    const set = listeners.get(event);
    audit({
      actor: "system",
      action: "bus.emit",
      subject: event,
      metadata: { listeners: set?.size ?? 0 },
    });
    if (!set || set.size === 0) return;
    // Snapshot to tolerate listeners that unsubscribe mid-dispatch.
    for (const fn of Array.from(set)) {
      try {
        fn(payload);
      } catch (err: any) {
        try {
          audit({
            actor: "system",
            action: "bus.listener.fail",
            subject: event,
            reason: err?.message ?? String(err),
          });
        } catch {
          // Audit itself failed — fall back to console so we don't cascade.
          console.warn(`[bus] listener failed for ${event}: ${err?.message ?? err}`);
        }
      }
    }
  },

  _eventsWithListeners(): string[] {
    return Array.from(listeners.keys());
  },

  _clear(): void {
    listeners.clear();
  },
};
