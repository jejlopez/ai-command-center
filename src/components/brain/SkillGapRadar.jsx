import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function SkillGapRadar({ nodes = [] }) {
  // Derive skill entries from memory nodes tagged with kind=pref/fact where label includes "skill:"
  const derived = nodes
    .filter((n) => n.label?.toLowerCase().startsWith("skill:"))
    .map((n) => {
      const name = n.label.replace(/^skill:\s*/i, "");
      const match = (n.body ?? "").match(/(\d+(\.\d+)?)/);
      const rating = match ? Math.min(10, parseFloat(match[1])) : 5;
      return { id: n.id, name, rating };
    });

  const [local, setLocal] = useState([]);
  const [form, setForm] = useState({ name: "", rating: 5 });
  const [open, setOpen] = useState(false);

  const skills = [...derived, ...local];
  const gaps = skills.filter((s) => s.rating < 5);
  const lowest = gaps.sort((a, b) => a.rating - b.rating)[0];

  const addLocal = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLocal((l) => [...l, { id: `local-${Date.now()}`, name: form.name, rating: parseInt(form.rating, 10) }]);
    setForm({ name: "", rating: 5 });
    setOpen(false);
  };

  return (
    <div className="surface p-5 flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-jarvis-muted">Skill Gap Radar</div>
          <div className="text-xs text-jarvis-muted">{skills.length} skills · {gaps.length} gaps</div>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="p-1.5 rounded-lg bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 transition">
          {open ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      {open && (
        <form onSubmit={addLocal} className="flex gap-2 border-t border-jarvis-border pt-3">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Skill name"
            className="flex-1 bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-purple/50 outline-none"
            required
          />
          <div className="flex items-center gap-1">
            <input type="range" min={1} max={10} step={1} value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} className="w-20 accent-jarvis-purple" />
            <span className="text-[11px] text-jarvis-purple w-4 text-center tabular-nums">{form.rating}</span>
          </div>
          <button type="submit" className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 transition">
            Add
          </button>
        </form>
      )}

      {lowest && (
        <div className="rounded-xl bg-jarvis-warning/5 border border-jarvis-warning/20 px-3 py-2 text-[11px] text-jarvis-warning">
          Consider learning more about <span className="font-semibold">{lowest.name}</span> (rated {lowest.rating}/10)
        </div>
      )}

      <div className="flex flex-col gap-2 overflow-y-auto max-h-48">
        {skills.length === 0 && !open && (
          <div className="text-[11px] text-jarvis-muted text-center py-4">Add skills or tag memory nodes with "skill: Python · 7"</div>
        )}
        {skills.sort((a, b) => a.rating - b.rating).map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <div className="text-[11px] text-jarvis-body w-28 truncate shrink-0">{s.name}</div>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${s.rating < 5 ? "bg-jarvis-danger/70" : s.rating < 7 ? "bg-jarvis-warning/70" : "bg-jarvis-success/70"}`}
                style={{ width: `${s.rating * 10}%` }}
              />
            </div>
            <span className="text-[10px] text-jarvis-muted tabular-nums w-6 text-right">{s.rating}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
