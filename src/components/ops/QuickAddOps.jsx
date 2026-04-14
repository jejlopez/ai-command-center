import { useState } from "react";
import { Plus, Briefcase, TrendingUp, Code, FileText } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const MODE_ACTIONS = {
  sales: [
    { label: "+ Proposal",  isProposalGen: true },
    { label: "+ Note",      table: "communications", fields: { type: "note" },     placeholder: "Log a note…",  isBody: true },
    { label: "+ Document",  table: "documents",      fields: { type: "other" },    placeholder: "Document name" },
  ],
  trading: [
    { label: "+ Watchlist", table: "watchlist",      fields: {},                   placeholder: "Ticker (e.g. AAPL)" },
  ],
  build: [
    { label: "+ Project",   table: "projects",       fields: { status: "active" }, placeholder: "Project name" },
    { label: "+ Ship",      table: "ship_log",       fields: { type: "feature" },  placeholder: "What did you ship?" },
  ],
};

const MODE_ICON = { sales: Briefcase, trading: TrendingUp, build: Code };
const MODE_COLOR = { sales: "text-blue-400", trading: "text-jarvis-purple", build: "text-cyan-400" };

export function QuickAddOps({ mode, onRefresh, onOpenProposalGen }) {
  const [activeAction, setActiveAction] = useState(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const actions = MODE_ACTIONS[mode] ?? [];
  const Icon = MODE_ICON[mode] ?? Plus;
  const color = MODE_COLOR[mode] ?? "text-jarvis-primary";

  function handleActionClick(a) {
    if (a.isProposalGen) {
      onOpenProposalGen?.();
    } else {
      setActiveAction(a);
    }
  }

  async function handleSave() {
    if (!supabase || !value.trim() || !activeAction) return;
    setSaving(true);
    const payload = { ...activeAction.fields };
    if (activeAction.isBody) {
      payload.body = value.trim();
    } else {
      payload.name = value.trim();
    }
    await supabase.from(activeAction.table).insert(payload);
    setSaving(false);
    setValue("");
    setActiveAction(null);
    onRefresh?.();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setActiveAction(null); setValue(""); }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-jarvis-border bg-jarvis-surface/50 shrink-0">
      <Icon size={11} className={`${color} shrink-0`} />

      {activeAction ? (
        <div className="flex flex-1 items-center gap-2">
          <input
            className="flex-1 bg-transparent text-xs text-jarvis-ink placeholder-jarvis-ghost outline-none"
            placeholder={activeAction.placeholder}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className={`chip ${color.replace("text-", "bg-")}/15 ${color} border ${color.replace("text-", "border-")}/30 disabled:opacity-40`}
          >
            {saving ? "…" : "Save"}
          </button>
          <button onClick={() => { setActiveAction(null); setValue(""); }} className="chip bg-white/5 text-jarvis-muted">✕</button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => handleActionClick(a)}
              className={`chip bg-white/5 hover:bg-white/10 transition-all ${a.isProposalGen ? "text-jarvis-primary hover:text-jarvis-primary" : "text-jarvis-muted hover:text-jarvis-body"}`}
            >
              {a.isProposalGen && <FileText size={9} className="inline mr-0.5" />}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
