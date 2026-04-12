import { useState } from "react";
import { CheckCircle2, Circle, XCircle, Flame } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_CONFIG = {
  done:   { icon: CheckCircle2, color: "text-jarvis-green",  chipClass: "border-jarvis-green/30 bg-jarvis-green/5",  label: "Done today" },
  due:    { icon: Circle,       color: "text-jarvis-amber",  chipClass: "border-jarvis-amber/30 bg-jarvis-amber/5",  label: "Due today" },
  broken: { icon: XCircle,      color: "text-jarvis-red",    chipClass: "border-jarvis-red/30 bg-jarvis-red/5",      label: "Broken" },
};

function StreakBar({ current, best }) {
  const pct = best > 0 ? Math.min(100, (current / best) * 100) : (current > 0 ? 100 : 0);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full bg-jarvis-purple/60 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-jarvis-muted tabular-nums">{current}/{best || "—"}</span>
    </div>
  );
}

function HabitRow({ habit, onDone }) {
  const [loading, setLoading] = useState(false);
  const cfg = STATUS_CONFIG[habit.status] ?? STATUS_CONFIG.due;
  const Icon = cfg.icon;

  const handleDone = async () => {
    if (!supabase || habit.done_today || loading) return;
    setLoading(true);
    try {
      const today = todayIso();
      const newStreak = (habit.current_streak ?? 0) + 1;
      const newBest = Math.max(habit.best_streak ?? 0, newStreak);
      await supabase.from("habits").update({
        last_done: today,
        current_streak: newStreak,
        best_streak: newBest,
      }).eq("id", habit.id);
      if (onDone) onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-jarvis-border bg-white/[0.02]">
      <Icon size={15} className={cfg.color} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-jarvis-ink font-medium truncate">{habit.name}</span>
          <span className={`chip text-[10px] ${cfg.chipClass}`}>{cfg.label}</span>
        </div>
        <StreakBar current={habit.current_streak} best={habit.best_streak} />
        {habit.last_done && (
          <div className="text-[10px] text-jarvis-muted mt-0.5">Last: {habit.last_done}</div>
        )}
      </div>
      {!habit.done_today && (
        <button
          type="button"
          onClick={handleDone}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/20 hover:bg-jarvis-purple/20 transition disabled:opacity-40 shrink-0"
        >
          <Flame size={11} />
          Done
        </button>
      )}
    </div>
  );
}

export function HabitTracker({ habitTracker, onRefresh }) {
  if (!habitTracker || habitTracker.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Habits</div>
        <p className="text-sm text-jarvis-muted">Add habits to track your consistency.</p>
      </div>
    );
  }

  const doneCount = habitTracker.filter((h) => h.done_today).length;

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Habits</div>
        <span className="chip text-[10px] border-jarvis-purple/30 bg-jarvis-purple/5 text-jarvis-purple">
          {doneCount}/{habitTracker.length} today
        </span>
      </div>
      <div className="space-y-2">
        {habitTracker.map((h) => (
          <HabitRow key={h.id} habit={h} onDone={onRefresh} />
        ))}
      </div>
    </div>
  );
}
