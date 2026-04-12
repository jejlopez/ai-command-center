import { useState } from "react";
import { Plus, X, ChevronDown, ChevronRight } from "lucide-react";

const CATS = ["general", "investing", "negotiation", "systems", "decision"];
const CAT_COLORS = {
  general: "bg-white/10 text-jarvis-muted",
  investing: "bg-jarvis-success/10 text-jarvis-success",
  negotiation: "bg-jarvis-primary/10 text-jarvis-primary",
  systems: "bg-jarvis-purple/10 text-jarvis-purple",
  decision: "bg-jarvis-warning/10 text-jarvis-warning",
};

export default function MentalModelsLibrary({ models = [], onAdd, onBump }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", when_to_use: "", category: "general" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim()) return;
    setBusy(true);
    try { await onAdd?.(form); setForm({ name: "", description: "", when_to_use: "", category: "general" }); setOpen(false); }
    finally { setBusy(false); }
  };

  const inp = "w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-purple/50 outline-none";

  return (
    <div className="surface p-5 flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-jarvis-muted">Mental Models</div>
          <div className="text-xs text-jarvis-muted">{models.length} models</div>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="p-1.5 rounded-lg bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 transition">
          {open ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="flex flex-col gap-3 border-t border-jarvis-border pt-4">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Model name (e.g. Inversion)" className={inp} required />
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} className={`${inp} resize-none`} required />
          <textarea value={form.when_to_use} onChange={(e) => setForm((f) => ({ ...f, when_to_use: e.target.value }))} placeholder="When to use" rows={2} className={`${inp} resize-none`} />
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inp}>
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 disabled:opacity-40 transition">
            Add Model
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto max-h-52">
        {models.length === 0 && !open && (
          <div className="text-[11px] text-jarvis-muted text-center py-4">
            Add models like: Second-order thinking, Inversion, Circle of competence
          </div>
        )}
        {models.map((m) => (
          <div key={m.id} className="rounded-xl bg-jarvis-surface/40 border border-jarvis-border p-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setExpanded(expanded === m.id ? null : m.id)} className="text-jarvis-muted hover:text-jarvis-body transition">
                {expanded === m.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-[0.1em] ${CAT_COLORS[m.category] ?? CAT_COLORS.general}`}>{m.category}</span>
              <span className="text-[12px] font-semibold text-jarvis-ink flex-1 truncate">{m.name}</span>
              <span className="text-[10px] text-jarvis-muted tabular-nums">{m.times_used}×</span>
              <button onClick={() => onBump?.(m.id)} className="text-[10px] text-jarvis-purple border border-jarvis-purple/30 rounded px-1.5 py-0.5 hover:bg-jarvis-purple/10 transition">use</button>
            </div>
            {expanded === m.id && (
              <div className="mt-2 pl-4">
                <div className="text-[11px] text-jarvis-body">{m.description}</div>
                {m.when_to_use && <div className="text-[10px] text-jarvis-muted mt-1">When: {m.when_to_use}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
