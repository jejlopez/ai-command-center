import { useCallback, useEffect, useMemo, useState } from "react";
import { HeartPulse, Search, Loader2, RefreshCcw, CalendarDays } from "lucide-react";
import { useMemoryFiltered } from "../hooks/useJarvis.js";
import { jarvis } from "../lib/jarvis.js";
import NodeList from "../components/shared/NodeList.jsx";
import QuickNoteForm from "../components/shared/QuickNoteForm.jsx";

export default function Health() {
  const [filter, setFilter] = useState("health");
  const { nodes: facts, loading: factsLoading, refresh: refreshFacts } = useMemoryFiltered("fact",  filter);
  const { nodes: events, loading: eventsLoading, refresh: refreshEvents } = useMemoryFiltered("event", filter);
  const [forgettingId, setForgettingId] = useState(null);

  const refresh = useCallback(async () => {
    await Promise.all([refreshFacts(), refreshEvents()]);
  }, [refreshFacts, refreshEvents]);

  const all = useMemo(() => {
    const merged = [...facts, ...events];
    merged.sort((a, b) => {
      const av = a.updatedAt || a.createdAt || "";
      const bv = b.updatedAt || b.createdAt || "";
      return bv.localeCompare(av);
    });
    return merged;
  }, [facts, events]);

  // This-week count: events in last 7 days matching filter.
  const weekCount = useMemo(() => {
    const now = Date.now();
    const wk = 7 * 24 * 60 * 60 * 1000;
    return events.filter((n) => {
      const t = Date.parse(n.createdAt || n.updatedAt || "");
      return Number.isFinite(t) && now - t <= wk;
    }).length;
  }, [events]);

  const handleSave = async ({ kind, label, body, trust }) => {
    await jarvis.memoryRemember({ kind, label, body, trust });
    await refresh();
  };

  const handleForget = async (id) => {
    setForgettingId(id);
    try {
      await jarvis.memoryForget(id);
      await refresh();
    } finally {
      setForgettingId(null);
    }
  };

  const loading = factsLoading || eventsLoading;

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-jarvis-cyan/10 border border-jarvis-cyan/20 grid place-items-center">
            <HeartPulse size={16} className="text-jarvis-cyan" />
          </div>
          <div>
            <div className="label text-jarvis-cyan">Health</div>
            <div className="text-[12px] text-jarvis-body">
              Notes and events · {all.length} shown
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip text-jarvis-green border-jarvis-green/30 bg-jarvis-green/5 flex items-center gap-1">
            <CalendarDays size={11} />
            This week: {weekCount}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-panel/40 text-jarvis-body border border-jarvis-border hover:text-jarvis-ink hover:bg-white/5 transition disabled:opacity-40"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter health memory (e.g. health, sleep, run)…"
              className="w-full bg-jarvis-panel/40 border border-jarvis-border rounded-xl pl-9 pr-3 py-2 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-cyan/50 outline-none"
            />
          </div>

          {loading ? (
            <div className="glass p-5 flex items-center gap-2 text-[12px] text-jarvis-muted">
              <Loader2 size={12} className="animate-spin" /> Loading memory…
            </div>
          ) : (
            <NodeList
              nodes={all}
              onForget={handleForget}
              forgettingId={forgettingId}
              emptyLabel={filter ? `No matches for "${filter}"` : "No health notes yet."}
            />
          )}

          <QuickNoteForm
            kinds={["event", "fact", "task"]}
            onSave={handleSave}
            title="Quick health log"
            placeholder="5k run · 26:40"
            bodyPlaceholder="Details (optional)"
            suggestedPrefix="health: "
            defaultKind="event"
          />
        </div>
      </div>
    </div>
  );
}
