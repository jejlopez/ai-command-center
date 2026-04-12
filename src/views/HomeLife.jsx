import { useCallback, useState } from "react";
import { HouseHeart, Search, Loader2, RefreshCcw } from "lucide-react";
import { useMemoryFiltered } from "../hooks/useJarvis.js";
import { jarvis } from "../lib/jarvis.js";
import NodeList from "../components/shared/NodeList.jsx";
import QuickNoteForm from "../components/shared/QuickNoteForm.jsx";

export default function HomeLife() {
  const [filter, setFilter] = useState("home");
  const { nodes, loading, refresh } = useMemoryFiltered("fact", filter);
  const [forgettingId, setForgettingId] = useState(null);

  const handleSave = async ({ kind, label, body, trust }) => {
    await jarvis.memoryRemember({ kind, label, body, trust });
    await refresh();
  };

  const handleForget = useCallback(async (id) => {
    setForgettingId(id);
    try {
      await jarvis.memoryForget(id);
      await refresh();
    } finally {
      setForgettingId(null);
    }
  }, [refresh]);

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-jarvis-cyan/10 border border-jarvis-cyan/20 grid place-items-center">
            <HouseHeart size={16} className="text-jarvis-cyan" />
          </div>
          <div>
            <div className="label text-jarvis-cyan">Home Life</div>
            <div className="text-[12px] text-jarvis-body">
              Household tasks, notes, and routines · {nodes.length} shown
            </div>
          </div>
        </div>
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

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter household memory (e.g. home, kitchen, utility)…"
              className="w-full bg-jarvis-panel/40 border border-jarvis-border rounded-xl pl-9 pr-3 py-2 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-cyan/50 outline-none"
            />
          </div>

          {loading ? (
            <div className="glass p-5 flex items-center gap-2 text-[12px] text-jarvis-muted">
              <Loader2 size={12} className="animate-spin" /> Loading memory…
            </div>
          ) : (
            <NodeList
              nodes={nodes}
              onForget={handleForget}
              forgettingId={forgettingId}
              emptyLabel={filter ? `No matches for "${filter}"` : "No facts yet."}
            />
          )}

          <QuickNoteForm
            kinds={["fact", "task", "event"]}
            onSave={handleSave}
            title="Log household item"
            placeholder="wifi router IP"
            bodyPlaceholder="Details (optional)"
            suggestedPrefix="home: "
            defaultKind="fact"
          />
        </div>
      </div>
    </div>
  );
}
