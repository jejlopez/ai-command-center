import { useState } from "react";
import { RefreshCw, Trash2, Loader2 } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const KIND_COLOR = {
  person:  "bg-jarvis-primary/10   text-jarvis-primary   border-jarvis-primary/20",
  project: "bg-jarvis-primary/10   text-jarvis-primary   border-jarvis-primary/20",
  task:    "bg-jarvis-amber/10  text-jarvis-amber  border-jarvis-amber/20",
  fact:    "bg-jarvis-purple/10 text-jarvis-purple border-jarvis-purple/20",
  event:   "bg-jarvis-green/10  text-jarvis-green  border-jarvis-green/20",
  pref:    "bg-white/5          text-jarvis-muted  border-jarvis-border",
};

const STALE_DAYS = 30;

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / 86_400_000);
}

function TrustBar({ trust }) {
  const pct = Math.round((trust ?? 0) * 100);
  return (
    <div className="flex items-center gap-1.5 w-16">
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full bg-jarvis-primary/60" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-jarvis-muted tabular-nums">{pct}%</span>
    </div>
  );
}

export default function StaleNodes({ nodes = [], onRefreshed }) {
  const [busy, setBusy] = useState({});

  const stale = nodes
    .map((n) => ({ ...n, days: daysSince(n.updatedAt ?? n.createdAt) }))
    .filter((n) => n.days >= STALE_DAYS)
    .sort((a, b) => b.days - a.days)
    .slice(0, 10);

  const setNodeBusy = (id, val) =>
    setBusy((prev) => ({ ...prev, [id]: val }));

  const handleRefresh = async (n) => {
    setNodeBusy(n.id, "refresh");
    try {
      await jarvis.memoryRemember({
        kind:  n.kind,
        label: n.label,
        body:  n.body,
        trust: n.trust,
        file:  n.filePath,
      });
      onRefreshed?.();
    } catch (e) {
      console.error("refresh failed", e);
    } finally {
      setNodeBusy(n.id, null);
    }
  };

  const handleForget = async (n) => {
    setNodeBusy(n.id, "forget");
    try {
      await jarvis.memoryForget(n.id);
      onRefreshed?.();
    } catch (e) {
      console.error("forget failed", e);
    } finally {
      setNodeBusy(n.id, null);
    }
  };

  if (stale.length === 0) {
    return (
      <div className="glass p-4 flex flex-col gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-jarvis-muted">
          Stale Nodes
        </div>
        <div className="text-[12px] text-jarvis-muted italic py-4 text-center">
          No stale knowledge — your brain is fresh.
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-jarvis-muted">
          Stale Nodes
        </div>
        <span className="text-[10px] text-jarvis-muted">{stale.length} flagged</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {stale.map((n) => {
          const isBusy = busy[n.id];
          const kindCls = KIND_COLOR[n.kind] ?? KIND_COLOR.pref;
          return (
            <div
              key={n.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/3 border border-jarvis-border"
            >
              <span className="flex-1 text-[12px] text-jarvis-body truncate">{n.label}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${kindCls}`}>
                {n.kind}
              </span>
              <span className="text-[10px] text-jarvis-amber tabular-nums w-14 text-right shrink-0">
                {n.days === Infinity ? "?" : `${n.days}d ago`}
              </span>
              <TrustBar trust={n.trust} />
              <button
                type="button"
                disabled={!!isBusy}
                onClick={() => handleRefresh(n)}
                title="Refresh timestamp"
                className="p-1 rounded text-jarvis-muted hover:text-jarvis-primary hover:bg-jarvis-primary/10 disabled:opacity-40 transition"
              >
                {isBusy === "refresh"
                  ? <Loader2 size={12} className="animate-spin" />
                  : <RefreshCw size={12} />}
              </button>
              <button
                type="button"
                disabled={!!isBusy}
                onClick={() => handleForget(n)}
                title="Forget this node"
                className="p-1 rounded text-jarvis-muted hover:text-jarvis-red hover:bg-jarvis-red/10 disabled:opacity-40 transition"
              >
                {isBusy === "forget"
                  ? <Loader2 size={12} className="animate-spin" />
                  : <Trash2 size={12} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
