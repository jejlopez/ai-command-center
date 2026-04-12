import { useState } from "react";
import { Scale, Plus, Loader2, CheckCircle, Clock } from "lucide-react";

const IMPACT_ORDER = { high: 0, medium: 1, low: 2 };
const IMPACT_STYLE = {
  high:   "bg-red-500/10 border-red-500/30 text-red-400",
  medium: "bg-amber-400/10 border-amber-400/30 text-amber-400",
  low:    "bg-green-500/10 border-green-500/30 text-green-400",
};

function daysPending(iso) {
  return Math.floor((Date.now() - new Date(iso)) / 86_400_000);
}

export function DecisionBacklog({ decisions = [], loading = false, onAdd, onDecide, onDefer }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", impact: "medium", estimated_cost: "" });
  const [saving, setSaving] = useState(false);

  const sorted = [...decisions]
    .filter(d => d.status === "pending")
    .sort((a, b) => (IMPACT_ORDER[a.impact] ?? 1) - (IMPACT_ORDER[b.impact] ?? 1));

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await onAdd?.({ ...form, estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null });
      setForm({ title: "", impact: "medium", estimated_cost: "" });
      setOpen(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <Scale size={14} className="text-jarvis-purple" />
        <div className="label">Decision Backlog</div>
        <button onClick={() => setOpen(!open)} className="ml-auto chip bg-jarvis-purple/10 border border-jarvis-purple/20 text-jarvis-purple text-[10px] hover:bg-jarvis-purple/20 transition cursor-pointer">
          <Plus size={10} /> Add
        </button>
      </div>

      {open && (
        <form onSubmit={handleAdd} className="space-y-2 mb-4 p-3 rounded-xl bg-jarvis-surface/40 border border-jarvis-border">
          <input className="input-sm w-full" placeholder="Decision title *" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} />
          <div className="flex gap-2">
            <select className="input-sm flex-1" value={form.impact} onChange={e => setForm(f => ({...f, impact: e.target.value}))}>
              <option value="high">High impact</option>
              <option value="medium">Medium impact</option>
              <option value="low">Low impact</option>
            </select>
            <input className="input-sm flex-1" placeholder="Est. cost ($)" type="number" value={form.estimated_cost} onChange={e => setForm(f => ({...f, estimated_cost: e.target.value}))} />
          </div>
          <button type="submit" disabled={saving} className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-jarvis-purple/20 text-jarvis-purple hover:bg-jarvis-purple/30 transition disabled:opacity-40">
            {saving ? <Loader2 size={10} className="animate-spin" /> : "Save"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-jarvis-muted py-4"><Loader2 size={12} className="animate-spin" /> Loading…</div>
      ) : sorted.length === 0 ? (
        <p className="text-[12px] text-jarvis-muted py-3">No decisions pending — house in order.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((d) => (
            <div key={d.id} className="px-3 py-2 rounded-xl border border-jarvis-border bg-jarvis-surface/20">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-jarvis-ink">{d.title}</span>
                    <span className={`chip text-[9px] border ${IMPACT_STYLE[d.impact] ?? IMPACT_STYLE.medium}`}>{d.impact}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-jarvis-muted">
                    {d.estimated_cost && <span>${d.estimated_cost.toLocaleString()}</span>}
                    <span>{daysPending(d.created_at)}d pending</span>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => onDecide?.(d.id)} title="Decide" className="text-green-400 hover:text-green-300 transition"><CheckCircle size={13} /></button>
                  <button onClick={() => onDefer?.(d.id)} title="Defer" className="text-jarvis-muted hover:text-amber-400 transition"><Clock size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
