import { useCallback, useEffect, useState } from "react";
import { Shield, ShieldCheck, ShieldAlert, RefreshCw, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const ACTION_COLORS = {
  "policy.deny":       "text-jarvis-red",
  "panic.triggered":   "text-jarvis-red",
  "rate_limit.exceeded": "text-jarvis-amber",
  "vault.lock":        "text-jarvis-amber",
  "vault.unlock":      "text-jarvis-green",
  "vault.unlock.fail": "text-jarvis-red",
  "daemon.start":      "text-jarvis-cyan",
};

function ActionBadge({ action }) {
  const color = ACTION_COLORS[action] ?? "text-jarvis-body";
  return (
    <span className={`font-mono text-[11px] ${color}`}>{action}</span>
  );
}

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

export function AuditPanel() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [chainOk, setChainOk] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [log, chain, sum] = await Promise.all([
        jarvis.auditLog({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, action: filter || undefined }),
        jarvis.auditChain(),
        jarvis.auditSummary(24),
      ]);
      setEntries(log.entries ?? []);
      setTotal(log.total ?? 0);
      setChainOk(chain?.ok ?? null);
      setSummary(sum);
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { refresh(); }, [refresh]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="label">Audit Log</div>
          <h3 className="font-display text-2xl text-jarvis-ink mt-1">Trust & Transparency</h3>
          <p className="text-jarvis-body text-sm mt-1">
            Every action JARVIS takes is hash-chained and immutable.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-jarvis-body hover:text-jarvis-ink flex items-center gap-1.5"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-jarvis-red/30 bg-jarvis-red/5 px-4 py-3 text-xs text-jarvis-red">
          {error}
        </div>
      )}

      {/* Chain verification badge */}
      <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-5 flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          {chainOk === true ? (
            <div className="w-10 h-10 rounded-full bg-jarvis-green/15 shadow-glow-green grid place-items-center">
              <ShieldCheck size={18} className="text-jarvis-green" />
            </div>
          ) : chainOk === false ? (
            <div className="w-10 h-10 rounded-full bg-jarvis-red/15 shadow-glow-red grid place-items-center">
              <ShieldAlert size={18} className="text-jarvis-red" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/5 grid place-items-center">
              <Shield size={18} className="text-jarvis-muted" />
            </div>
          )}
          <div>
            <div className="text-sm text-jarvis-ink font-semibold">
              Hash Chain:{" "}
              <span className={chainOk === true ? "text-jarvis-green" : chainOk === false ? "text-jarvis-red" : "text-jarvis-muted"}>
                {chainOk === null ? "Checking…" : chainOk ? "Verified ✓" : "BROKEN — tampering detected"}
              </span>
            </div>
            <div className="text-[11px] text-jarvis-muted mt-0.5">
              SHA-256 chain from genesis through {total} entries
            </div>
          </div>
        </div>
      </div>

      {/* 24h summary */}
      {summary && (
        <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-5 mb-5">
          <div className="label mb-3">Last 24 hours</div>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-jarvis-ink font-semibold text-lg">{summary.total}</span>
              <span className="text-jarvis-muted ml-1.5">events</span>
            </div>
            {summary.actions?.slice(0, 5).map(({ action, count }) => (
              <div key={action} className="flex items-center gap-1.5">
                <ActionBadge action={action} />
                <span className="text-jarvis-muted text-[11px]">×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 text-jarvis-muted">
          <Filter size={12} />
          <span className="text-[11px]">Filter:</span>
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(0); }}
          placeholder="e.g. policy, vault, panic"
          className="flex-1 px-3 py-1.5 rounded-xl bg-white/5 border border-jarvis-border text-xs text-jarvis-ink placeholder-jarvis-muted focus:outline-none focus:border-jarvis-cyan/50"
        />
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="text-[11px] text-jarvis-muted py-4 text-center">Loading audit log…</div>
      ) : entries.length === 0 ? (
        <div className="text-[11px] text-jarvis-muted py-4 text-center">No entries found.</div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => {
            const isExpanded = expanded.has(entry.id);
            return (
              <div key={entry.id} className="rounded-xl border border-jarvis-border bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => toggleExpand(entry.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left"
                >
                  <span className="text-[10px] text-jarvis-muted w-16 shrink-0 font-mono">
                    {relativeTime(entry.ts)}
                  </span>
                  <span className="text-[11px] text-jarvis-muted w-20 shrink-0 truncate">
                    {entry.actor}
                  </span>
                  <ActionBadge action={entry.action} />
                  {entry.subject && (
                    <span className="text-[11px] text-jarvis-body truncate ml-1">
                      {entry.subject}
                    </span>
                  )}
                  <span className="ml-auto text-jarvis-muted">
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 space-y-1.5 text-[11px]">
                    <div className="flex gap-4">
                      <span className="text-jarvis-muted w-16 shrink-0">Time</span>
                      <span className="text-jarvis-body font-mono">{entry.ts}</span>
                    </div>
                    {entry.reason && (
                      <div className="flex gap-4">
                        <span className="text-jarvis-muted w-16 shrink-0">Reason</span>
                        <span className="text-jarvis-body">{entry.reason}</span>
                      </div>
                    )}
                    {entry.metadata && (
                      <div className="flex gap-4">
                        <span className="text-jarvis-muted w-16 shrink-0">Meta</span>
                        <pre className="text-jarvis-body font-mono text-[10px] whitespace-pre-wrap break-all">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="flex gap-4">
                      <span className="text-jarvis-muted w-16 shrink-0">Hash</span>
                      <span className="text-jarvis-body font-mono text-[10px] truncate">
                        {entry.hash}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-jarvis-body disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span className="text-[11px] text-jarvis-muted">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-jarvis-body disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
