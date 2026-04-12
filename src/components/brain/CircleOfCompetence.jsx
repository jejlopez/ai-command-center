import { useState } from "react";
import { Plus, X } from "lucide-react";

const RINGS = [
  { key: "expert", label: "Expert", minRating: 8, color: "text-jarvis-success", bg: "bg-jarvis-success/10", border: "border-jarvis-success/30" },
  { key: "competent", label: "Competent", minRating: 5, color: "text-jarvis-primary", bg: "bg-jarvis-primary/10", border: "border-jarvis-primary/30" },
  { key: "learning", label: "Learning", minRating: 0, color: "text-jarvis-muted", bg: "bg-white/5", border: "border-jarvis-border" },
];

function getRing(rating) {
  if (rating >= 8) return "expert";
  if (rating >= 5) return "competent";
  return "learning";
}

export default function CircleOfCompetence({ nodes = [] }) {
  const derived = nodes
    .filter((n) => n.label?.toLowerCase().startsWith("skill:"))
    .map((n) => {
      const name = n.label.replace(/^skill:\s*/i, "");
      const match = (n.body ?? "").match(/(\d+(\.\d+)?)/);
      const rating = match ? Math.min(10, parseFloat(match[1])) : 5;
      return { id: n.id, name, rating, ring: getRing(rating) };
    });

  const [local, setLocal] = useState([]);
  const [form, setForm] = useState({ name: "", ring: "learning" });
  const [open, setOpen] = useState(false);

  const addLocal = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLocal((l) => [...l, { id: `coc-${Date.now()}`, name: form.name, ring: form.ring }]);
    setForm({ name: "", ring: "learning" });
    setOpen(false);
  };

  const moveRing = (id, direction) => {
    setLocal((l) =>
      l.map((s) => {
        if (s.id !== id) return s;
        const idx = RINGS.findIndex((r) => r.key === s.ring);
        const next = RINGS[Math.max(0, Math.min(RINGS.length - 1, idx - direction))]?.key ?? s.ring;
        return { ...s, ring: next };
      })
    );
  };

  const all = [...derived, ...local];
  const byRing = {};
  for (const r of RINGS) byRing[r.key] = all.filter((s) => s.ring === r.key);

  const inp = "bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-purple/50 outline-none";

  return (
    <div className="surface p-5 flex flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-jarvis-muted">Circle of Competence</div>
          <div className="text-xs text-jarvis-muted">Buffett's framework · {byRing.expert?.length ?? 0} expert areas</div>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="p-1.5 rounded-lg bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 transition">
          {open ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      {open && (
        <form onSubmit={addLocal} className="flex gap-2 border-t border-jarvis-border pt-3">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Topic / skill" className={`flex-1 ${inp}`} required />
          <select value={form.ring} onChange={(e) => setForm((f) => ({ ...f, ring: e.target.value }))} className={inp}>
            {RINGS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <button type="submit" className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/30 hover:bg-jarvis-purple/20 transition">Add</button>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {RINGS.map((ring) => (
          <div key={ring.key}>
            <div className={`text-[10px] uppercase tracking-[0.14em] font-semibold mb-1.5 ${ring.color}`}>{ring.label}</div>
            <div className={`rounded-xl border ${ring.border} ${ring.bg} p-3 min-h-[40px] flex flex-wrap gap-1.5`}>
              {byRing[ring.key]?.length === 0 && (
                <span className="text-[10px] text-jarvis-muted italic">None yet</span>
              )}
              {byRing[ring.key]?.map((s) => (
                <div key={s.id} className="flex items-center gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg border ${ring.border} ${ring.bg} ${ring.color} font-medium`}>{s.name}</span>
                  {local.find((l) => l.id === s.id) && (
                    <>
                      {ring.key !== "expert" && <button onClick={() => moveRing(s.id, 1)} className="text-[9px] text-jarvis-muted hover:text-jarvis-success transition">↑</button>}
                      {ring.key !== "learning" && <button onClick={() => moveRing(s.id, -1)} className="text-[9px] text-jarvis-muted hover:text-jarvis-danger transition">↓</button>}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {all.length === 0 && !open && (
        <div className="text-[11px] text-jarvis-muted text-center">Add topics or tag memory nodes with "skill: …" to map your competence.</div>
      )}
    </div>
  );
}
