import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../lib/supabase.js";

const STATUS_STYLE = {
  draft:    "bg-jarvis-ghost text-jarvis-muted",
  sent:     "bg-blue-500/15 text-blue-400",
  viewed:   "bg-jarvis-warning/15 text-jarvis-warning",
  accepted: "bg-jarvis-success/15 text-jarvis-success",
  rejected: "bg-jarvis-danger/15 text-jarvis-danger",
  expired:  "bg-jarvis-ghost text-jarvis-ghost",
};

const fmtUsd = (n) => n == null ? "—" : `$${Number(n).toLocaleString()}`;
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

export function ProposalList({ proposals = [], onRefresh }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", status: "draft", notes: "" });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!supabase || !form.name.trim()) return;
    setSaving(true);
    await supabase.from("proposals").insert({ name: form.name.trim(), status: form.status, notes: form.notes });
    setSaving(false);
    setAdding(false);
    setForm({ name: "", status: "draft", notes: "" });
    onRefresh?.();
  }

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={13} className="text-jarvis-muted" />
          <span className="label">Proposals</span>
        </div>
        <button onClick={() => setAdding(v => !v)} className="text-jarvis-muted hover:text-jarvis-primary transition-colors">
          <Plus size={13} />
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 bg-white/[0.02] rounded-lg p-3 border border-jarvis-border">
          <input
            className="bg-transparent text-xs text-jarvis-ink placeholder-jarvis-ghost outline-none border-b border-jarvis-border pb-1"
            placeholder="Proposal name"
            value={form.name}
            onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
            autoFocus
          />
          <select
            className="bg-jarvis-surface text-xs text-jarvis-body rounded border border-jarvis-border px-1.5 py-1"
            value={form.status}
            onChange={e => setForm(v => ({ ...v, status: e.target.value }))}
          >
            {["draft","sent","viewed","accepted","rejected","expired"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={saving} className="chip bg-jarvis-primary/15 text-jarvis-primary border border-jarvis-primary/30 hover:bg-jarvis-primary/25">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="chip bg-white/5 text-jarvis-muted">Cancel</button>
          </div>
        </form>
      )}

      {proposals.length === 0 && !adding && (
        <p className="text-xs text-jarvis-ghost py-2">No proposals yet. Hit + to create one.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {proposals.slice(0, 6).map((p) => (
          <div key={p.id} className="flex items-center gap-2 py-1 border-b border-jarvis-border/50 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-jarvis-ink font-medium truncate">{p.name}</div>
              <div className="text-[10px] text-jarvis-muted mt-0.5">{fmtDate(p.created_at)} · v{p.version}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {p.pricing?.total > 0 && (
                <span className="text-[10px] text-jarvis-body">{fmtUsd(p.pricing.total)}</span>
              )}
              <span className={`chip ${STATUS_STYLE[p.status] ?? "bg-white/5 text-jarvis-muted"}`}>{p.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
