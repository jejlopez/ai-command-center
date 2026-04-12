import { useState } from "react";
import { Plus, X, AlertTriangle } from "lucide-react";

const CATS = ["general", "sales", "trading", "build", "life"];
const CAT_COLORS = {
  general: "bg-white/10 text-jarvis-muted",
  sales: "bg-jarvis-primary/10 text-jarvis-primary",
  trading: "bg-jarvis-success/10 text-jarvis-success",
  build: "bg-jarvis-purple/10 text-jarvis-purple",
  life: "bg-jarvis-warning/10 text-jarvis-warning",
};

export default function MistakeJournal({ mistakes = [], onAdd, onTogglePrevented }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ mistake: "", context: "", lesson: "", category: "general", cost_usd: "" });
  const [busy, setBusy] = useState(false);

  const prevented = mistakes.filter((m) => m.prevented_next).length;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.mistake.trim() || !form.lesson.trim()) return;
    setBusy(true);
    try {
      await onAdd?.({ ...form, cost_usd: form.cost_usd ? parseFloat(form.cost_usd) : null });
      setForm({ mistake: "", context: "", lesson: "", category: "general", cost_usd: "" });
      setOpen(false);
    } finally { setBusy(false); }
  };

  const inp = "w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-purple/50 outline-none";

  return (
    <div className="surface p-5 flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-jarvis-muted">Mistake Journal</div>
          <div className="text-xs text-jarvis-muted">
            {mistakes.length} lessons · <span className="text-jarvis-success">{prevented} prevented</span>
          </div>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="p-1.5 rounded-lg bg-jarvis-danger/10 text-jarvis-danger border border-jarvis-danger/30 hover:bg-jarvis-danger/20 transition">
          {open ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="flex flex-col gap-3 border-t border-jarvis-border pt-4">
          <textarea value={form.mistake} onChange={(e) => setForm((f) => ({ ...f, mistake: e.target.value }))} placeholder="What was the mistake?" rows={2} className={`${inp} resize-none`} required />
          <textarea value={form.context} onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))} placeholder="Context (optional)" rows={2} className={`${inp} resize-none`} />
          <textarea value={form.lesson} onChange={(e) => setForm((f) => ({ ...f, lesson: e.target.value }))} placeholder="Lesson learned (required)" rows={2} className={`${inp} resize-none`} required />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inp}>
              {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" value={form.cost_usd} onChange={(e) => setForm((f) => ({ ...f, cost_usd: e.target.value }))} placeholder="Cost $ (optional)" className={inp} />
          </div>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-danger/10 text-jarvis-danger border border-jarvis-danger/30 hover:bg-jarvis-danger/20 disabled:opacity-40 transition">
            Log Mistake
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto max-h-52">
        {mistakes.length === 0 && !open && (
          <div className="text-[11px] text-jarvis-muted text-center py-4 italic">
            "It's better to learn from other people's mistakes." — Buffett
          </div>
        )}
        {mistakes.slice(0, 8).map((m) => (
          <div key={m.id} className={`rounded-xl border p-3 ${m.prevented_next ? "border-jarvis-success/20 bg-jarvis-success/5" : "border-jarvis-danger/20 bg-jarvis-danger/5"}`}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={10} className={m.prevented_next ? "text-jarvis-success" : "text-jarvis-danger"} />
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-[0.1em] ${CAT_COLORS[m.category] ?? CAT_COLORS.general}`}>{m.category}</span>
              {m.cost_usd != null && <span className="text-[10px] text-jarvis-muted ml-auto">${m.cost_usd.toLocaleString()}</span>}
            </div>
            <div className="text-[12px] font-semibold text-jarvis-ink line-clamp-1">{m.mistake}</div>
            <div className="text-[11px] text-jarvis-muted mt-0.5 line-clamp-1">{m.lesson}</div>
            <button
              onClick={() => onTogglePrevented?.(m.id, m.prevented_next)}
              className={`mt-1.5 text-[9px] px-2 py-0.5 rounded font-semibold transition ${m.prevented_next ? "bg-jarvis-success/10 text-jarvis-success border border-jarvis-success/30" : "bg-white/5 text-jarvis-muted border border-jarvis-border hover:border-jarvis-success/30 hover:text-jarvis-success"}`}
            >
              {m.prevented_next ? "Prevented next time" : "Mark as prevented"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
