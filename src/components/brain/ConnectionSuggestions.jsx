import { useState } from "react";
import { Link, Loader2 } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for",
  "of","with","is","are","was","were","be","been","by","from",
  "it","its","this","that","as","into","about","up","out","if",
]);

function tokenize(str) {
  return (str ?? "")
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function buildEdgeSet(edges) {
  const set = new Set();
  for (const e of edges) {
    const a = e.src_id < e.dst_id ? e.src_id : e.dst_id;
    const b = e.src_id < e.dst_id ? e.dst_id : e.src_id;
    set.add(`${a}|${b}`);
  }
  return set;
}

function getSuggestions(nodes, edgeSet) {
  const suggestions = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const ka = a.id < b.id ? a.id : b.id;
      const kb = a.id < b.id ? b.id : a.id;
      if (edgeSet.has(`${ka}|${kb}`)) continue;

      const wa = new Set(tokenize(a.label + " " + (a.body ?? "")));
      const wb = new Set(tokenize(b.label + " " + (b.body ?? "")));
      const shared = [...wa].filter((w) => wb.has(w));
      if (shared.length >= 2) {
        suggestions.push({ a, b, shared });
      }
    }
    if (suggestions.length >= 20) break; // cap early for perf
  }
  // Sort by most shared words desc, take top 5
  return suggestions.sort((x, y) => y.shared.length - x.shared.length).slice(0, 5);
}

export default function ConnectionSuggestions({ nodes = [], edges = [], onLinked }) {
  const [linking, setLinking] = useState({});

  const edgeSet     = buildEdgeSet(edges);
  const suggestions = getSuggestions(nodes, edgeSet);

  const handleLink = async (a, b) => {
    const key = `${a.id}|${b.id}`;
    setLinking((prev) => ({ ...prev, [key]: true }));
    try {
      // Create a memory edge by adding a related entry via memoryRemember
      // We remember node A with a "related_to" relation pointing to B
      await jarvis.memoryRemember({
        kind:  a.kind,
        label: a.label,
        body:  a.body,
        trust: a.trust,
        file:  a.filePath,
        relations: [{ dst: b.id, relation: "related_to" }],
      });
      onLinked?.();
    } catch (e) {
      console.error("link failed", e);
    } finally {
      setLinking((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (suggestions.length === 0) {
    return (
      <div className="glass p-4 flex flex-col gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-jarvis-muted">
          Connection Suggestions
        </div>
        <div className="text-[12px] text-jarvis-muted italic py-4 text-center">
          No connection suggestions — your knowledge is well-linked.
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-jarvis-muted">
          Connection Suggestions
        </div>
        <span className="text-[10px] text-jarvis-muted">{suggestions.length} found</span>
      </div>

      <div className="flex flex-col gap-2">
        {suggestions.map(({ a, b, shared }) => {
          const key    = `${a.id}|${b.id}`;
          const isBusy = linking[key];
          return (
            <div
              key={key}
              className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/3 border border-jarvis-border"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[12px]">
                  <span className="text-jarvis-cyan truncate max-w-[80px]" title={a.label}>
                    {a.label}
                  </span>
                  <span className="text-jarvis-muted">↔</span>
                  <span className="text-jarvis-blue truncate max-w-[80px]" title={b.label}>
                    {b.label}
                  </span>
                </div>
                <div className="text-[10px] text-jarvis-muted mt-0.5 truncate">
                  shared: {shared.slice(0, 4).join(", ")}
                </div>
              </div>
              <button
                type="button"
                disabled={!!isBusy}
                onClick={() => handleLink(a, b)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 disabled:opacity-40 transition"
              >
                {isBusy
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Link size={11} />}
                Link
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
