import { useEffect, useState } from "react";
import { Shield, CheckCircle2, Circle, Plus, Flame } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function HabitRow({ item, onToggle }) {
  const done = item.last_done === todayIso();
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${done ? "border-jarvis-green/30 bg-jarvis-green/5" : "border-jarvis-purple/20 bg-jarvis-purple/5"}`}>
      <button onClick={() => !done && onToggle(item.id, item.current_streak, item.best_streak)} disabled={done} className="shrink-0">
        {done
          ? <CheckCircle2 size={15} className="text-jarvis-green" />
          : <Circle size={15} className="text-jarvis-purple" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-jarvis-ink font-medium truncate">{item.habit}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Flame size={10} className="text-jarvis-amber" />
          <span className="text-[10px] text-jarvis-muted">{item.current_streak} day streak</span>
        </div>
      </div>
      {done && <span className="text-[10px] text-jarvis-green font-semibold shrink-0">Done</span>}
    </div>
  );
}

export function NonNegotiables() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newHabit, setNewHabit] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from("non_negotiables").select("*").eq("active", true).order("created_at");
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id, streak, best) => {
    if (!supabase) return;
    const today = todayIso();
    const newStreak = streak + 1;
    await supabase.from("non_negotiables").update({
      last_done: today,
      current_streak: newStreak,
      best_streak: Math.max(best, newStreak),
    }).eq("id", id);
    load();
  };

  const addHabit = async () => {
    if (!supabase || !newHabit.trim()) return;
    setSaving(true);
    await supabase.from("non_negotiables").insert({ habit: newHabit.trim() });
    setNewHabit("");
    setAdding(false);
    setSaving(false);
    load();
  };

  return (
    <div className="glass p-5 border border-jarvis-green/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="label">Non-Negotiables</div>
          <span className="chip text-[10px] border-jarvis-green/30 bg-jarvis-green/5 text-jarvis-green">Sacred</span>
        </div>
        <Shield size={14} className="text-jarvis-green" />
      </div>

      {loading ? (
        <p className="text-sm text-jarvis-muted">Loading…</p>
      ) : (
        <div className="space-y-2">
          {items.length === 0 && !adding && (
            <p className="text-sm text-jarvis-muted">Add up to 3 habits you never skip.</p>
          )}
          {items.map(item => <HabitRow key={item.id} item={item} onToggle={toggle} />)}

          {adding ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newHabit}
                onChange={e => setNewHabit(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addHabit(); if (e.key === "Escape") setAdding(false); }}
                placeholder="Habit name…"
                className="flex-1 text-sm bg-white/5 border border-jarvis-border rounded-lg px-3 py-1.5 text-jarvis-ink placeholder:text-jarvis-muted"
              />
              <button onClick={addHabit} disabled={saving || !newHabit.trim()}
                className="px-3 py-1.5 rounded-lg text-xs bg-jarvis-green/10 text-jarvis-green border border-jarvis-green/20 hover:bg-jarvis-green/20 transition disabled:opacity-40">
                Add
              </button>
            </div>
          ) : items.length < 3 ? (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs text-jarvis-muted hover:text-jarvis-ink transition mt-1">
              <Plus size={12} /> Add habit
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
