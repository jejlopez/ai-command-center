import { Rocket, Plus } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../lib/supabase.js";

const TYPE_STYLE = {
  feature:  "bg-cyan-400/15 text-cyan-400",
  fix:      "bg-jarvis-danger/15 text-jarvis-danger",
  refactor: "bg-jarvis-purple/15 text-jarvis-purple",
  deploy:   "bg-jarvis-success/15 text-jarvis-success",
};

const fmtTime = (s) => {
  if (!s) return "";
  const d = new Date(s);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export function ShipLog({ ships = [], projects = [], onRefresh }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", type: "feature", description: "", project_id: "" });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!supabase || !form.title.trim()) return;
    setSaving(true);
    await supabase.from("ship_log").insert({
      title: form.title.trim(),
      type: form.type,
      description: form.description || null,
      project_id: form.project_id || null,
    });
    setSaving(false);
    setAdding(false);
    setForm({ title: "", type: "feature", description: "", project_id: "" });
    onRefresh?.();
  }

  // Filter today's ships for the top
  const today = new Date().toDateString();
  const todayShips = ships.filter(s => new Date(s.shipped_at).toDateString() === today);
  const olderShips = ships.filter(s => new Date(s.shipped_at).toDateString() !== today);

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket size={13} className="text-jarvis-muted" />
          <span className="label">Ship Log</span>
          {todayShips.length > 0 && (
            <span className="chip bg-cyan-400/15 text-cyan-400">{todayShips.length} today</span>
          )}
        </div>
        <button onClick={() => setAdding(v => !v)} className="text-jarvis-muted hover:text-cyan-400 transition-colors">
          <Plus size={13} />
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 bg-white/[0.02] rounded-lg p-3 border border-jarvis-border">
          <input
            className="bg-transparent text-xs text-jarvis-ink placeholder-jarvis-ghost outline-none border-b border-jarvis-border pb-1"
            placeholder="What did you ship?"
            value={form.title}
            onChange={e => setForm(v => ({ ...v, title: e.target.value }))}
            autoFocus
          />
          <div className="flex gap-2">
            <select
              className="bg-jarvis-surface text-xs text-jarvis-body rounded border border-jarvis-border px-1.5 py-1"
              value={form.type}
              onChange={e => setForm(v => ({ ...v, type: e.target.value }))}
            >
              {["feature","fix","refactor","deploy"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {projects.length > 0 && (
              <select
                className="flex-1 bg-jarvis-surface text-xs text-jarvis-body rounded border border-jarvis-border px-1.5 py-1"
                value={form.project_id}
                onChange={e => setForm(v => ({ ...v, project_id: e.target.value }))}
              >
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={saving} className="chip bg-cyan-400/15 text-cyan-400 border border-cyan-400/30">
              {saving ? "Logging…" : "Ship it"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="chip bg-white/5 text-jarvis-muted">Cancel</button>
          </div>
        </form>
      )}

      {ships.length === 0 && !adding && (
        <p className="text-xs text-jarvis-ghost py-2">Nothing shipped yet today. Go build something.</p>
      )}

      {/* Today's ships */}
      {todayShips.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="label text-jarvis-primary">Today</div>
          {todayShips.map((s) => (
            <ShipRow key={s.id} ship={s} />
          ))}
        </div>
      )}

      {/* Older */}
      {olderShips.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="label">Earlier</div>
          {olderShips.slice(0, 4).map((s) => (
            <ShipRow key={s.id} ship={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function ShipRow({ ship }) {
  return (
    <div className="flex items-center gap-2 py-1 border-b border-jarvis-border/50 last:border-0">
      <span className={`chip shrink-0 ${TYPE_STYLE[ship.type] ?? TYPE_STYLE.feature}`}>{ship.type}</span>
      <span className="text-xs text-jarvis-ink flex-1 truncate">{ship.title}</span>
      <span className="text-[10px] text-jarvis-ghost shrink-0">{fmtTime(ship.shipped_at)}</span>
    </div>
  );
}
