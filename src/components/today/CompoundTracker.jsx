import { useState, useEffect } from "react";
import { TrendingUp, Plus, Flame } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const CATEGORIES = ["general", "sales", "trading", "build", "health", "money"];
const CAT_COLOR = {
  sales:   "bg-jarvis-primary/15 text-jarvis-primary",
  trading: "bg-purple-500/15 text-purple-400",
  build:   "bg-jarvis-amber/15 text-jarvis-amber",
  health:  "bg-jarvis-green/15 text-jarvis-green",
  money:   "bg-emerald-500/15 text-emerald-400",
  general: "bg-jarvis-border text-jarvis-body",
};

function calcStreak(rows) {
  if (!rows.length) return 0;
  const dates = [...new Set(rows.map((r) => r.date))].sort().reverse();
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i - 1]) - new Date(dates[i])) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

export function CompoundTracker({ improvements = [] }) {
  const [rows, setRows] = useState(improvements);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("general");

  useEffect(() => { setRows(improvements); }, [improvements]);

  async function addImprovement(e) {
    e.preventDefault();
    if (!text.trim() || !supabase) return;
    const { data, error } = await supabase.from("compound_tracker").insert({
      improvement: text.trim(),
      category,
      date: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (!error && data) { setRows((r) => [data, ...r]); setText(""); }
  }

  const streak = calcStreak(rows);
  const recent = rows.slice(0, 7);

  return (
    <div className="glass p-5 flex flex-col gap-4 border-l-2 border-jarvis-green/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-jarvis-green" />
          <div className="label">Compound Tracker</div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 text-xs text-jarvis-amber">
            <Flame size={12} />
            <span>{streak}-day streak</span>
          </div>
        )}
      </div>

      {recent.length === 0 ? (
        <p className="text-sm text-jarvis-muted">Log your first improvement — small gains compound.</p>
      ) : (
        <div className="space-y-2">
          {recent.map((r) => (
            <div key={r.id} className="flex items-start gap-2 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-jarvis-ink">{r.improvement}</div>
                <div className="text-[11px] text-jarvis-muted mt-0.5">{r.date}</div>
              </div>
              <span className={`chip text-[10px] shrink-0 ${CAT_COLOR[r.category] ?? CAT_COLOR.general}`}>{r.category}</span>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addImprovement} className="flex gap-2 pt-2 border-t border-jarvis-border">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What did you improve today?"
          className="input-field text-sm flex-1"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field text-sm w-28">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className="btn-primary flex items-center gap-1 text-sm px-3">
          <Plus size={13} />
        </button>
      </form>
    </div>
  );
}
