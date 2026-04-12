import { useState } from "react";
import { Plus, X, Clock } from "lucide-react";

const CATS = ["general", "sales", "trading", "build", "life"];
const CAT_COLORS = {
  general: "bg-white/10 text-jarvis-muted",
  sales: "bg-jarvis-primary/10 text-jarvis-primary",
  trading: "bg-jarvis-success/10 text-jarvis-success",
  build: "bg-jarvis-purple/10 text-jarvis-purple",
  life: "bg-jarvis-warning/10 text-jarvis-warning",
};

function daysAgo(iso) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
}

export default function DecisionJournal({ decisions = [], onAdd, onReview }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", context: "", reasoning: "", category: "general" });
  const [reviewId, setReviewId] = useState(null);
  const [reviewForm, setReviewForm] = useState({ outcome: "", lesson: "" });
  const [busy, setBusy] = useState(false);

  const needsReview = decisions.filter((d) => !d.outcome && daysAgo(d.decided_at) >= 7);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.reasoning.trim()) return;
    setBusy(true);
    try { await onAdd?.(form); setForm({ title: "", context: "", reasoning: "", category: "general" }); setOpen(false); }
    finally { setBusy(false); }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.outcome.trim()) return;
    setBusy(true);
    try { await onReview?.(reviewId, reviewForm.outcome, reviewForm.lesson); setReviewId(null); setReviewForm({ outcome: "", lesson: "" }); }
    finally { setBusy(false); }
  };

  const inp = "w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-purple/50 outline-none";

  return (
    <div className="surface p-5 flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-jarvis-muted">Decision Journal</div>
          <div className="text-xs text-jarvis-muted">{decisions.length} decisions · {needsReview.length} need review</div>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="p-1.5 rounded-lg bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 transition">
          {open ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="flex flex-col gap-3 border-t border-jarvis-border pt-4">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Decision title…" className={inp} required />
          <textarea value={form.context} onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))} placeholder="Context (optional)" rows={2} className={`${inp} resize-none`} />
          <textarea value={form.reasoning} onChange={(e) => setForm((f) => ({ ...f, reasoning: e.target.value }))} placeholder="Reasoning (required)" rows={2} className={`${inp} resize-none`} required />
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className={inp}>
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 disabled:opacity-40 transition">
            Log Decision
          </button>
        </form>
      )}

      {/* Needs review */}
      {needsReview.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-jarvis-warning flex items-center gap-1.5"><Clock size={10} /> Needs Review</div>
          {needsReview.slice(0, 3).map((d) => (
            <div key={d.id} className="rounded-xl border border-jarvis-warning/20 bg-jarvis-warning/5 p-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-jarvis-ink truncate">{d.title}</div>
                <div className="text-[10px] text-jarvis-muted mt-0.5">{daysAgo(d.decided_at)}d ago · {d.reasoning?.slice(0, 60)}…</div>
              </div>
              <button onClick={() => { setReviewId(d.id); setReviewForm({ outcome: "", lesson: "" }); }} className="text-[10px] text-jarvis-warning border border-jarvis-warning/30 rounded-lg px-2 py-1 hover:bg-jarvis-warning/10 transition shrink-0">
                Review
              </button>
            </div>
          ))}
        </div>
      )}

      {reviewId && (
        <form onSubmit={submitReview} className="flex flex-col gap-2 border-t border-jarvis-border pt-3">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-jarvis-muted">Add Outcome</div>
          <textarea value={reviewForm.outcome} onChange={(e) => setReviewForm((f) => ({ ...f, outcome: e.target.value }))} placeholder="What actually happened?" rows={2} className={`${inp} resize-none`} required />
          <textarea value={reviewForm.lesson} onChange={(e) => setReviewForm((f) => ({ ...f, lesson: e.target.value }))} placeholder="Lesson learned" rows={2} className={`${inp} resize-none`} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setReviewId(null)} className="flex-1 py-1.5 rounded-xl text-xs text-jarvis-muted border border-jarvis-border hover:bg-white/5 transition">Cancel</button>
            <button type="submit" disabled={busy} className="flex-1 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-success/10 text-jarvis-success border border-jarvis-success/30 hover:bg-jarvis-success/20 disabled:opacity-40 transition">Save</button>
          </div>
        </form>
      )}

      {/* Recent decisions */}
      <div className="flex flex-col gap-2 overflow-y-auto max-h-48">
        {decisions.length === 0 && !open && (
          <div className="text-[11px] text-jarvis-muted text-center py-4">Log major decisions to build wisdom.</div>
        )}
        {decisions.slice(0, 8).map((d) => (
          <div key={d.id} className="rounded-xl bg-jarvis-surface/40 border border-jarvis-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-[0.1em] ${CAT_COLORS[d.category] ?? CAT_COLORS.general}`}>{d.category}</span>
              {d.outcome && <span className="text-[9px] px-1.5 py-0.5 rounded bg-jarvis-success/10 text-jarvis-success font-semibold uppercase tracking-[0.1em]">reviewed</span>}
              <span className="ml-auto text-[10px] text-jarvis-muted">{daysAgo(d.decided_at)}d ago</span>
            </div>
            <div className="text-[12px] font-semibold text-jarvis-ink">{d.title}</div>
            <div className="text-[11px] text-jarvis-muted mt-0.5 line-clamp-1">{d.reasoning}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
