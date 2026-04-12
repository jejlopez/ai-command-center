import { Zap, ZapOff } from "lucide-react";

const KIND_COLORS = {
  person:  "bg-jarvis-primary/15   text-jarvis-primary",
  project: "bg-jarvis-primary/15   text-jarvis-primary",
  task:    "bg-jarvis-amber/15  text-jarvis-amber",
  fact:    "bg-jarvis-purple/15 text-jarvis-purple",
  event:   "bg-jarvis-green/15  text-jarvis-green",
  pref:    "bg-white/10         text-jarvis-muted",
};

const KIND_ORDER = ["person", "project", "task", "fact", "event", "pref"];

export default function KnowledgeStats({ nodes = [], edges = [], embedStatus }) {
  const byKind = {};
  for (const k of KIND_ORDER) byKind[k] = 0;
  for (const n of nodes) { if (byKind[n.kind] !== undefined) byKind[n.kind]++; }

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-jarvis-border bg-jarvis-surface/20">
      {/* Totals */}
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="text-jarvis-muted">Nodes</span>
        <span className="font-semibold text-jarvis-ink tabular-nums">{nodes.length}</span>
      </div>
      <div className="w-px h-3 bg-jarvis-border" />
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="text-jarvis-muted">Edges</span>
        <span className="font-semibold text-jarvis-ink tabular-nums">{edges.length}</span>
      </div>
      <div className="w-px h-3 bg-jarvis-border" />

      {/* By-kind chips */}
      <div className="flex items-center gap-1 flex-wrap">
        {KIND_ORDER.filter((k) => byKind[k] > 0).map((k) => (
          <span
            key={k}
            className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-[0.1em] ${KIND_COLORS[k] ?? "bg-white/10 text-jarvis-muted"}`}
          >
            {k} {byKind[k]}
          </span>
        ))}
      </div>

      {/* Embed status */}
      {embedStatus && (
        <>
          <div className="ml-auto w-px h-3 bg-jarvis-border" />
          {embedStatus.ok ? (
            <div
              className="flex items-center gap-1 text-[10px] text-jarvis-green"
              title={`${embedStatus.model || "nomic-embed-text"} · ${embedStatus.dims || "?"} dims`}
            >
              <Zap size={11} />
              <span className="hidden sm:inline">Semantic</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1 text-[10px] text-jarvis-amber"
              title={embedStatus.error || "Embedding unavailable"}
            >
              <ZapOff size={11} />
              <span className="hidden sm:inline">Keyword</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
