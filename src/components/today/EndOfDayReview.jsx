import { useState } from "react";
import { Moon, Send, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

export function EndOfDayReview({ onSaved }) {
  const [energy, setEnergy] = useState(null);
  const [sleep, setSleep] = useState("");
  const [tradingNotes, setTradingNotes] = useState("");
  const [wins, setWins] = useState("");
  const [workout, setWorkout] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    if (!supabase) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    try {
      await supabase.from("health_log").upsert({
        date: today,
        energy: energy,
        sleep_hours: sleep ? parseFloat(sleep) : null,
        workout,
      }, { onConflict: "user_id,date" });

      await supabase.from("daily_snapshot").upsert({
        date: today,
        energy_score: energy,
        sleep_hours: sleep ? parseFloat(sleep) : null,
        notes: wins || null,
      }, { onConflict: "user_id,date" });

      if (tradingNotes) {
        await supabase.from("trade_journal").upsert({
          date: today,
          notes: tradingNotes,
          pnl_usd: 0,
          wins: 0,
          losses: 0,
        }, { onConflict: "user_id,date" });
      }

      setSaved(true);
      onSaved?.();
    } catch (e) {
      console.error("EOD save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="glass p-5 border border-jarvis-purple/20">
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <Moon size={14} />
          <span>Day logged. Rest well.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-5 border border-jarvis-purple/20 animate-slideUp">
      <div className="label mb-4">End of Day Review</div>

      <div className="mb-4">
        <div className="text-xs text-jarvis-muted mb-2">Energy level</div>
        <div className="flex gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setEnergy(n)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${energy === n ? "bg-jarvis-primary/20 text-jarvis-primary border border-jarvis-primary/40" : "bg-white/5 text-jarvis-muted hover:bg-white/10 border border-transparent"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-jarvis-muted mb-1">Sleep (hours)</div>
          <input
            type="number"
            step="0.5"
            min="0"
            max="14"
            value={sleep}
            onChange={(e) => setSleep(e.target.value)}
            placeholder="7.5"
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted focus:outline-none focus:border-jarvis-primary/50"
          />
        </div>
        <div>
          <div className="text-xs text-jarvis-muted mb-1">Workout</div>
          <button
            onClick={() => setWorkout(!workout)}
            className={`w-full px-3 py-2 rounded-xl text-sm font-medium transition ${workout ? "bg-jarvis-green/15 text-jarvis-green border border-jarvis-green/30" : "bg-white/5 text-jarvis-muted border border-jarvis-border hover:bg-white/10"}`}
          >
            {workout ? "Yes" : "No"}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-jarvis-muted mb-1">Trading notes</div>
        <textarea
          value={tradingNotes}
          onChange={(e) => setTradingNotes(e.target.value)}
          placeholder="What worked? What didn't?"
          rows={2}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted focus:outline-none focus:border-jarvis-primary/50 resize-none"
        />
      </div>

      <div className="mb-4">
        <div className="text-xs text-jarvis-muted mb-1">Today's wins</div>
        <textarea
          value={wins}
          onChange={(e) => setWins(e.target.value)}
          placeholder="What went well?"
          rows={2}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted focus:outline-none focus:border-jarvis-primary/50 resize-none"
        />
      </div>

      <button
        onClick={submit}
        disabled={saving}
        className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-jarvis-purple/15 text-jarvis-purple hover:bg-jarvis-purple/25 transition flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Save day
      </button>
    </div>
  );
}
