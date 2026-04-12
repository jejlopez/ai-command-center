import { useState } from "react";
import { Zap, Moon, Dumbbell, X, Check } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function upsertHealthLog(patch) {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const today = todayIso();
  await supabase.from("health_log").upsert(
    { user_id: user.id, date: today, ...patch },
    { onConflict: "user_id,date" }
  );
}

function EnergyForm({ onClose, onSaved }) {
  const [value, setValue] = useState(null);
  const [saving, setSaving] = useState(false);

  const save = async (n) => {
    setSaving(true);
    try {
      await upsertHealthLog({ energy: n });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-jarvis-muted">Energy today:</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => save(n)}
            disabled={saving}
            className={`w-7 h-7 rounded-lg text-xs font-semibold transition disabled:opacity-40 ${
              n >= 7 ? "bg-jarvis-green/10 text-jarvis-green hover:bg-jarvis-green/20 border border-jarvis-green/20"
              : n >= 4 ? "bg-jarvis-amber/10 text-jarvis-amber hover:bg-jarvis-amber/20 border border-jarvis-amber/20"
              : "bg-jarvis-red/10 text-jarvis-red hover:bg-jarvis-red/20 border border-jarvis-red/20"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <button type="button" onClick={onClose} className="ml-1 text-jarvis-muted hover:text-jarvis-ink transition">
        <X size={13} />
      </button>
    </div>
  );
}

function SleepForm({ onClose, onSaved }) {
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const h = parseFloat(hours);
    if (!h || h < 0 || h > 24) return;
    setSaving(true);
    try {
      await upsertHealthLog({ sleep_hours: h });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-jarvis-muted">Sleep hours:</span>
      <input
        type="number"
        min="0"
        max="24"
        step="0.5"
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="7.5"
        className="w-20 bg-jarvis-surface/40 border border-jarvis-border rounded-lg px-2 py-1 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-purple/50 outline-none"
        autoFocus
      />
      <button
        type="button"
        onClick={save}
        disabled={saving || !hours}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/20 hover:bg-jarvis-purple/20 transition disabled:opacity-40"
      >
        <Check size={11} /> Save
      </button>
      <button type="button" onClick={onClose} className="text-jarvis-muted hover:text-jarvis-ink transition">
        <X size={13} />
      </button>
    </div>
  );
}

function WorkoutForm({ onClose, onSaved }) {
  const [type, setType] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await upsertHealthLog({ workout: true, workout_type: type || null });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-jarvis-muted">Workout type (optional):</span>
      <input
        type="text"
        value={type}
        onChange={(e) => setType(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="Run, lift, swim…"
        className="w-36 bg-jarvis-surface/40 border border-jarvis-border rounded-lg px-2 py-1 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-green/50 outline-none"
        autoFocus
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-jarvis-green/10 text-jarvis-green border border-jarvis-green/20 hover:bg-jarvis-green/20 transition disabled:opacity-40"
      >
        <Check size={11} /> Mark Done
      </button>
      <button type="button" onClick={onClose} className="text-jarvis-muted hover:text-jarvis-ink transition">
        <X size={13} />
      </button>
    </div>
  );
}

export function QuickLog({ onSaved }) {
  const [open, setOpen] = useState(null); // 'energy' | 'sleep' | 'workout' | null

  const handleSaved = () => {
    if (onSaved) onSaved();
  };

  return (
    <div className="sticky bottom-0 z-20 border-t border-jarvis-border bg-jarvis-base/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 py-3">
        {open ? (
          <div className="py-1">
            {open === "energy" && <EnergyForm onClose={() => setOpen(null)} onSaved={handleSaved} />}
            {open === "sleep" && <SleepForm onClose={() => setOpen(null)} onSaved={handleSaved} />}
            {open === "workout" && <WorkoutForm onClose={() => setOpen(null)} onSaved={handleSaved} />}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs text-jarvis-muted shrink-0">Quick log:</span>
            <button
              type="button"
              onClick={() => setOpen("energy")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/20 hover:bg-jarvis-purple/20 transition"
            >
              <Zap size={12} /> Energy 1–10
            </button>
            <button
              type="button"
              onClick={() => setOpen("sleep")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-surface/40 text-jarvis-body border border-jarvis-border hover:text-jarvis-ink hover:bg-white/5 transition"
            >
              <Moon size={12} /> Log Sleep
            </button>
            <button
              type="button"
              onClick={() => setOpen("workout")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-green/10 text-jarvis-green border border-jarvis-green/20 hover:bg-jarvis-green/20 transition"
            >
              <Dumbbell size={12} /> Mark Workout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
