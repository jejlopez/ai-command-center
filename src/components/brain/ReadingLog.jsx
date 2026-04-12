import { useState } from "react";
import { Plus, X, Star } from "lucide-react";

const TYPES = ["book", "article", "podcast", "video"];
const TYPE_COLORS = {
  book: "bg-jarvis-primary/10 text-jarvis-primary",
  article: "bg-jarvis-purple/10 text-jarvis-purple",
  podcast: "bg-jarvis-success/10 text-jarvis-success",
  video: "bg-jarvis-warning/10 text-jarvis-warning",
};

function Stars({ n }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={10} className={i <= n ? "text-jarvis-warning fill-jarvis-warning" : "text-jarvis-border"} />
      ))}
    </div>
  );
}

export default function ReadingLog({ readings = [], onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", type: "book", key_takeaways: "", rating: 3 });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      await onAdd?.({ ...form, rating: parseInt(form.rating, 10), finished_at: new Date().toISOString().slice(0, 10) });
      setForm({ title: "", author: "", type: "book", key_takeaways: "", rating: 3 });
      setOpen(false);
    } finally { setBusy(false); }
  };

  const inp = "w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-purple/50 outline-none";

  return (
    <div className="surface p-5 flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-jarvis-muted">Reading Log</div>
          <div className="text-xs text-jarvis-muted">{readings.length} entries</div>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="p-1.5 rounded-lg bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 transition">
          {open ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="flex flex-col gap-3 border-t border-jarvis-border pt-4">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" className={inp} required />
          <input value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} placeholder="Author (optional)" className={inp} />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={inp}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-jarvis-muted whitespace-nowrap">Rating</span>
              <input type="range" min={1} max={5} step={1} value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} className="flex-1 accent-jarvis-warning" />
              <span className="text-[11px] text-jarvis-warning w-4 text-center">{form.rating}</span>
            </div>
          </div>
          <textarea value={form.key_takeaways} onChange={(e) => setForm((f) => ({ ...f, key_takeaways: e.target.value }))} placeholder="Key takeaways" rows={2} className={`${inp} resize-none`} />
          <button type="submit" disabled={busy} className="px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 disabled:opacity-40 transition">
            Log
          </button>
        </form>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto max-h-52">
        {readings.length === 0 && !open && (
          <div className="text-[11px] text-jarvis-muted text-center py-4">Log books and articles to track your learning.</div>
        )}
        {readings.slice(0, 10).map((r) => (
          <div key={r.id} className="rounded-xl bg-jarvis-surface/40 border border-jarvis-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-[0.1em] ${TYPE_COLORS[r.type] ?? TYPE_COLORS.book}`}>{r.type}</span>
              {r.rating != null && <Stars n={r.rating} />}
            </div>
            <div className="text-[12px] font-semibold text-jarvis-ink">{r.title}</div>
            {r.author && <div className="text-[10px] text-jarvis-muted">{r.author}</div>}
            {r.key_takeaways && <div className="text-[10px] text-jarvis-body mt-1 line-clamp-1">{r.key_takeaways}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
