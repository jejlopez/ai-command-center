import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";
import {
  Brain as BrainIcon,
  Search,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  User,
  Folder,
  ListTodo,
  Sparkles,
  CalendarDays,
  Settings2,
  FileText,
  Loader2,
  FolderInput,
  Zap,
  ZapOff,
  GitBranch,
  List,
  BookOpen,
} from "lucide-react";
import { useMemory } from "../hooks/useJarvis.js";
import { jarvis } from "../lib/jarvis.js";
import { useBrainSupa } from "../hooks/useBrainSupa.js";
import SearchHitRow from "../components/brain/SearchHitRow.jsx";
import ObsidianImportDialog from "../components/brain/ObsidianImportDialog.jsx";
import GraphView from "../components/brain/GraphView.jsx";
import StaleNodes from "../components/brain/StaleNodes.jsx";
import ConnectionSuggestions from "../components/brain/ConnectionSuggestions.jsx";
import KnowledgeStats from "../components/brain/KnowledgeStats.jsx";
import KnowledgeVelocity from "../components/brain/KnowledgeVelocity.jsx";
import SkillGapRadar from "../components/brain/SkillGapRadar.jsx";
import DecisionJournal from "../components/brain/DecisionJournal.jsx";
import MentalModelsLibrary from "../components/brain/MentalModelsLibrary.jsx";
import InfoDietScore from "../components/brain/InfoDietScore.jsx";
import CircleOfCompetence from "../components/brain/CircleOfCompetence.jsx";
import MistakeJournal from "../components/brain/MistakeJournal.jsx";
import ReadingLog from "../components/brain/ReadingLog.jsx";
import WisdomCompounder from "../components/brain/WisdomCompounder.jsx";
import AnnualKnowledgeReview from "../components/brain/AnnualKnowledgeReview.jsx";

const KIND_META = {
  person:  { label: "People",    Icon: User,        tone: "cyan" },
  project: { label: "Projects",  Icon: Folder,      tone: "blue" },
  task:    { label: "Tasks",     Icon: ListTodo,    tone: "amber" },
  fact:    { label: "Facts",     Icon: Sparkles,    tone: "purple" },
  event:   { label: "Events",    Icon: CalendarDays, tone: "green" },
  pref:    { label: "Prefs",     Icon: Settings2,   tone: "blue" },
};

const KIND_ORDER = ["person", "project", "task", "fact", "event", "pref"];

const TONE = {
  cyan:   "text-jarvis-primary",
  blue:   "text-jarvis-primary",
  amber:  "text-jarvis-warning",
  purple: "text-jarvis-purple",
  green:  "text-jarvis-success",
  red:    "text-jarvis-danger",
};

function TrustBar({ trust }) {
  const pct = Math.round((trust ?? 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full bg-jarvis-primary/80"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-jarvis-muted tabular-nums">{pct}%</span>
    </div>
  );
}

function KindGroup({ kind, nodes, selectedId, onSelect }) {
  const [open, setOpen] = useState(true);
  const meta = KIND_META[kind];
  if (!meta) return null;
  const Icon = meta.Icon;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-lg hover:bg-white/5 transition"
      >
        {open
          ? <ChevronDown size={12} className="text-jarvis-muted" />
          : <ChevronRight size={12} className="text-jarvis-muted" />}
        <Icon size={13} className={TONE[meta.tone]} />
        <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-jarvis-body">
          {meta.label}
        </span>
        <span className="ml-auto text-[10px] text-jarvis-muted">{nodes.length}</span>
      </button>
      {open && (
        <div className="pl-4 flex flex-col gap-0.5 mt-1">
          {nodes.length === 0 && (
            <div className="text-[11px] text-jarvis-muted italic px-2 py-1">Nothing yet</div>
          )}
          {nodes.map((n) => {
            const isActive = n.id === selectedId;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelect(n.id)}
                className={[
                  "text-left px-2 py-1.5 rounded-lg text-[12px] truncate transition",
                  isActive
                    ? "bg-jarvis-primary/10 text-jarvis-primary"
                    : "text-jarvis-body hover:text-jarvis-ink hover:bg-white/5",
                ].join(" ")}
                title={n.label}
              >
                {n.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RememberModal({ open, onClose, onSubmit }) {
  const [kind, setKind] = useState("fact");
  const [label, setLabel] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState("");
  const [trust, setTrust] = useState(0.7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (open) {
      setKind("fact");
      setLabel("");
      setBody("");
      setFile("");
      setTrust(0.7);
      setErr(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    try {
      await onSubmit({
        kind,
        label: label.trim(),
        body: body.trim() || undefined,
        file: file.trim() || undefined,
        trust,
      });
      onClose();
    } catch (e) {
      setErr(e?.message ?? "Failed to remember");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-6">
      <form
        onSubmit={submit}
        className="surface w-full max-w-lg p-6 relative"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-jarvis-muted hover:text-jarvis-ink hover:bg-white/5"
        >
          <X size={16} />
        </button>
        <div className="label text-jarvis-primary mb-1">Remember</div>
        <h2 className="text-lg font-semibold text-jarvis-ink mb-5">New memory node</h2>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-jarvis-muted font-semibold">Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="mt-1 w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-primary/50 outline-none"
            >
              {KIND_ORDER.map((k) => (
                <option key={k} value={k}>{KIND_META[k].label.replace(/s$/, "")}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-jarvis-muted font-semibold">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Alex Chen"
              className="mt-1 w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-primary/50 outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-jarvis-muted font-semibold">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Short description or notes"
              className="mt-1 w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-primary/50 outline-none resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.18em] text-jarvis-muted font-semibold">File path (optional)</label>
            <input
              value={file}
              onChange={(e) => setFile(e.target.value)}
              placeholder="brain/people/alex.md"
              className="mt-1 w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-primary/50 outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-[0.18em] text-jarvis-muted font-semibold">Trust</label>
              <span className="text-[11px] text-jarvis-primary tabular-nums">{trust.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={trust}
              onChange={(e) => setTrust(parseFloat(e.target.value))}
              className="mt-2 w-full accent-jarvis-primary"
            />
          </div>
        </div>

        {err && (
          <div className="mt-4 text-[11px] text-jarvis-danger">{err}</div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-jarvis-body hover:text-jarvis-ink hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !label.trim()}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/30 hover:bg-jarvis-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Remember
          </button>
        </div>
      </form>
    </div>
  );
}

function Detail({ node, onForget, forgetting }) {
  if (!node) {
    return (
      <div className="h-full grid place-items-center text-jarvis-muted text-sm">
        Select a memory node to inspect
      </div>
    );
  }
  const meta = KIND_META[node.kind] ?? KIND_META.fact;
  const Icon = meta.Icon;
  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-start gap-3 pb-4 border-b border-jarvis-border">
        <div className="w-10 h-10 rounded-xl bg-jarvis-primary/10 border border-jarvis-primary/20 grid place-items-center">
          <Icon size={18} className={TONE[meta.tone]} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="label text-jarvis-primary">{meta.label.replace(/s$/, "")}</div>
          <h2 className="text-lg font-semibold text-jarvis-ink leading-tight truncate">{node.label}</h2>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pt-4 space-y-4">
        {node.body && (
          <div>
            <div className="label mb-1">Body</div>
            <div className="text-[13px] text-jarvis-body leading-relaxed whitespace-pre-wrap">
              {node.body}
            </div>
          </div>
        )}

        <div>
          <div className="label mb-1">Trust</div>
          <TrustBar trust={node.trust} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="label mb-1">Created</div>
            <div className="text-[11px] text-jarvis-body">
              {node.createdAt ? new Date(node.createdAt).toLocaleString() : "—"}
            </div>
          </div>
          <div>
            <div className="label mb-1">Updated</div>
            <div className="text-[11px] text-jarvis-body">
              {node.updatedAt ? new Date(node.updatedAt).toLocaleString() : "—"}
            </div>
          </div>
        </div>

        {node.filePath && (
          <div>
            <div className="label mb-1">Vault file</div>
            <div className="flex items-center gap-2 text-[12px] text-jarvis-body bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2">
              <FileText size={13} className="text-jarvis-primary" />
              <code className="text-jarvis-primary truncate">{node.filePath}</code>
            </div>
          </div>
        )}

        {Array.isArray(node.related) && node.related.length > 0 && (
          <div>
            <div className="label mb-1">Related</div>
            <div className="flex flex-col gap-1">
              {node.related.map((r, i) => (
                <div
                  key={`${r.src}-${r.dst}-${i}`}
                  className="text-[11px] text-jarvis-body bg-jarvis-surface/40 border border-jarvis-border rounded-lg px-3 py-1.5"
                >
                  <span className="text-jarvis-muted">{r.relation}</span> · <span className="text-jarvis-primary">{r.dst}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-jarvis-border">
        <button
          type="button"
          onClick={() => onForget(node.id)}
          disabled={forgetting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-jarvis-danger/10 text-jarvis-danger border border-jarvis-danger/30 hover:bg-jarvis-danger/20 disabled:opacity-50 transition"
        >
          {forgetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Forget this
        </button>
      </div>
    </div>
  );
}

export default function Brain() {
  const { nodes, loading, error, refresh, remember, forget } = useMemory();
  const [selectedId, setSelectedId] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null); // { nodes, hits }
  const [searching, setSearching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const [embedStatus, setEmbedStatus] = useState(null);
  const [activeTab, setActiveTab] = useState("explorer"); // "explorer" | "graph" | "journal"
  const brainSupa = useBrainSupa();

  // Derive edges from node.related arrays
  const edges = useMemo(() => {
    const out = [];
    for (const n of nodes) {
      if (!Array.isArray(n.related)) continue;
      for (const r of n.related) {
        if (r.dst) out.push({ src_id: n.id, dst_id: r.dst, relation: r.relation ?? "related_to" });
      }
    }
    return out;
  }, [nodes]);

  // Group nodes by kind for the rail
  const grouped = useMemo(() => {
    const out = {};
    for (const k of KIND_ORDER) out[k] = [];
    for (const n of nodes) {
      if (out[n.kind]) out[n.kind].push(n);
    }
    for (const k of KIND_ORDER) {
      out[k].sort((a, b) => a.label.localeCompare(b.label));
    }
    return out;
  }, [nodes]);

  // Embed status (fetched on mount; refresh after import)
  useEffect(() => {
    let cancelled = false;
    jarvis.memoryEmbedStatus()
      .then((s) => { if (!cancelled) setEmbedStatus(s ?? null); })
      .catch((e) => {
        if (!cancelled) setEmbedStatus({ ok: false, provider: "ollama", model: "", dims: 0, error: e?.message });
      });
    return () => { cancelled = true; };
  }, []);

  // Search — uses enhanced recall so we get hits + scores + embedStatus
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await jarvis.memoryRecall(q, { enhanced: true });
        if (!cancelled) {
          const nodes = Array.isArray(res?.nodes) ? res.nodes : [];
          const hits  = Array.isArray(res?.hits)  ? res.hits  : [];
          // Hits arrive pre-sorted by score desc (server-side). Build ordered list by hit order;
          // fallback to node order for any node without a hit entry.
          const nodeById = new Map(nodes.map((n) => [n.id, n]));
          const seen = new Set();
          const ordered = [];
          for (const h of hits) {
            const n = nodeById.get(h.nodeId);
            if (n) { ordered.push({ node: n, hit: h }); seen.add(n.id); }
          }
          for (const n of nodes) {
            if (!seen.has(n.id)) ordered.push({ node: n, hit: null });
          }
          setSearchResults({ ordered, hits });
          if (res?.embedStatus) setEmbedStatus(res.embedStatus);
        }
      } catch {
        if (!cancelled) setSearchResults({ ordered: [], hits: [] });
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  // Detail fetch
  useEffect(() => {
    if (!selectedId) {
      setSelectedNode(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    jarvis.memoryGet(selectedId)
      .then((n) => { if (!cancelled) setSelectedNode(n); })
      .catch(() => {
        if (!cancelled) {
          // fall back to list row
          const n = nodes.find((x) => x.id === selectedId) ?? null;
          setSelectedNode(n);
        }
      })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId, nodes]);

  const handleForget = async (id) => {
    setForgetting(true);
    try {
      await forget(id);
      setSelectedId(null);
      setSelectedNode(null);
    } catch (e) {
      console.error("forget failed", e);
    } finally {
      setForgetting(false);
    }
  };

  const handleRemember = async (input) => {
    const node = await remember(input);
    if (node?.id) setSelectedId(node.id);
  };

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="h-full w-full flex flex-col min-h-0">
      {/* Header */}
      <motion.div variants={stagger.item} className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-jarvis-purple/10 border border-jarvis-purple/20 grid place-items-center">
            <BrainIcon size={16} className="text-jarvis-purple" />
          </div>
          <div>
            <div className="label text-jarvis-purple">Brain</div>
            <div className="text-[12px] text-jarvis-body">Memory graph · {nodes.length} nodes</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {embedStatus && (
            embedStatus.ok ? (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-[0.14em] font-semibold bg-jarvis-success/10 text-jarvis-success border border-jarvis-success/30"
                title={`Ollama · ${embedStatus.dims || "?"} dims`}
              >
                <Zap size={11} />
                Semantic: {embedStatus.model || "nomic-embed-text"}
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-[0.14em] font-semibold bg-jarvis-warning/10 text-jarvis-warning border border-jarvis-warning/30"
                title={embedStatus.error || "Embedding backend unreachable"}
              >
                <ZapOff size={11} />
                Keyword only
              </div>
            )
          )}
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            title="Import Obsidian vault"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-surface/40 text-jarvis-body border border-jarvis-border hover:text-jarvis-ink hover:bg-white/5 transition"
          >
            <FolderInput size={14} />
            Import Obsidian
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 transition"
          >
            <Plus size={14} />
            Remember
          </button>
        </div>
      </motion.div>

      {/* Tab segmented control + KnowledgeStats */}
      <div className="flex items-center gap-0 px-6 pt-3 pb-0 border-b border-jarvis-border">
        <div className="flex items-center gap-1 bg-jarvis-surface/40 border border-jarvis-border rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("explorer")}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-semibold transition",
              activeTab === "explorer"
                ? "bg-jarvis-purple/20 text-jarvis-purple border border-jarvis-purple/30"
                : "text-jarvis-muted hover:text-jarvis-body",
            ].join(" ")}
          >
            <List size={12} />
            Explorer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("graph")}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-semibold transition",
              activeTab === "graph"
                ? "bg-jarvis-purple/20 text-jarvis-purple border border-jarvis-purple/30"
                : "text-jarvis-muted hover:text-jarvis-body",
            ].join(" ")}
          >
            <GitBranch size={12} />
            Graph
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("journal")}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-semibold transition",
              activeTab === "journal"
                ? "bg-jarvis-purple/20 text-jarvis-purple border border-jarvis-purple/30"
                : "text-jarvis-muted hover:text-jarvis-body",
            ].join(" ")}
          >
            <BookOpen size={12} />
            Journal
          </button>
        </div>
      </div>

      {/* KnowledgeStats bar */}
      <KnowledgeStats nodes={nodes} edges={edges} embedStatus={embedStatus} />

      {/* Content area — Explorer tab */}
      {activeTab === "explorer" && (
      <motion.div variants={stagger.item} className="flex-1 min-h-0 flex">
        {/* Left rail */}
        <div className="w-72 shrink-0 border-r border-jarvis-border bg-jarvis-surface/20 flex flex-col min-h-0">
          <div className="p-3 border-b border-jarvis-border">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Recall…"
                className="w-full bg-jarvis-surface/50 border border-jarvis-border rounded-xl pl-8 pr-3 py-2 text-[12px] text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-primary/50 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            {loading && (
              <div className="p-4 text-[11px] text-jarvis-muted flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Loading memory…
              </div>
            )}
            {error && !loading && (
              <div className="p-4 text-[11px] text-jarvis-danger">Memory unreachable</div>
            )}

            {!loading && !error && query.trim() ? (
              <div>
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] font-semibold text-jarvis-body flex items-center gap-2">
                  Results
                  {searching && <Loader2 size={10} className="animate-spin text-jarvis-muted" />}
                </div>
                {(searchResults?.ordered ?? []).length === 0 && !searching && (
                  <div className="px-2 py-3 text-[11px] text-jarvis-muted italic">No matches</div>
                )}
                <div className="flex flex-col gap-0.5">
                  {(searchResults?.ordered ?? []).map(({ node, hit }) => (
                    <SearchHitRow
                      key={node.id}
                      node={node}
                      score={hit?.score}
                      via={hit?.via}
                      selected={node.id === selectedId}
                      onClick={() => setSelectedId(node.id)}
                    />
                  ))}
                </div>
              </div>
            ) : !loading && !error ? (
              <div className="flex flex-col gap-2">
                {KIND_ORDER.map((k) => (
                  <KindGroup
                    key={k}
                    kind={k}
                    nodes={grouped[k] ?? []}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 min-w-0 p-6 overflow-y-auto">
          <div className="surface p-6 h-full min-h-[420px] flex flex-col">
            {detailLoading ? (
              <div className="h-full grid place-items-center text-jarvis-muted text-sm">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : (
              <Detail node={selectedNode} onForget={handleForget} forgetting={forgetting} />
            )}
          </div>
        </div>
      </motion.div>
      )}

      {/* Graph tab */}
      {activeTab === "graph" && (
        <motion.div variants={stagger.item} className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-4">
          <GraphView
            nodes={nodes}
            edges={edges}
            onSelect={(id) => {
              setSelectedId(id);
              setActiveTab("explorer");
            }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StaleNodes nodes={nodes} onRefreshed={refresh} />
            <ConnectionSuggestions nodes={nodes} edges={edges} onLinked={refresh} />
          </div>
        </motion.div>
      )}

      {/* Journal tab */}
      {activeTab === "journal" && (
        <motion.div variants={stagger.item} className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-4">
          <KnowledgeVelocity nodes={nodes} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DecisionJournal
              decisions={brainSupa.decisions}
              onAdd={brainSupa.addDecision}
              onReview={brainSupa.reviewDecision}
            />
            <MistakeJournal
              mistakes={brainSupa.mistakes}
              onAdd={brainSupa.addMistake}
              onTogglePrevented={brainSupa.togglePrevented}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MentalModelsLibrary
              models={brainSupa.models}
              onAdd={brainSupa.addModel}
              onBump={brainSupa.bumpModel}
            />
            <ReadingLog
              readings={brainSupa.readings}
              onAdd={brainSupa.addReading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CircleOfCompetence nodes={nodes} />
            <SkillGapRadar nodes={nodes} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoDietScore readings={brainSupa.readings} />
            <WisdomCompounder decisions={brainSupa.decisions} mistakes={brainSupa.mistakes} />
          </div>

          <AnnualKnowledgeReview
            nodes={nodes}
            decisions={brainSupa.decisions}
            mistakes={brainSupa.mistakes}
            readings={brainSupa.readings}
            models={brainSupa.models}
          />
        </motion.div>
      )}

      <RememberModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleRemember}
      />

      <ObsidianImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onCompleted={() => {
          refresh();
          jarvis.memoryEmbedStatus()
            .then((s) => setEmbedStatus(s ?? null))
            .catch(() => {});
        }}
      />
    </motion.div>
  );
}
