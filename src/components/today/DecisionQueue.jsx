import { useState, useEffect } from "react";
import { CheckCircle, Clock, Plus, Zap } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const ROLE_COLORS = {
  sales:   "bg-jarvis-primary/15 text-jarvis-primary",
  trading: "bg-purple-500/15 text-purple-400",
  build:   "bg-jarvis-amber/15 text-jarvis-amber",
  general: "bg-jarvis-border text-jarvis-body",
};

export function DecisionQueue({ decisions = [] }) {
  const [rows, setRows] = useState(decisions);
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [role, setRole] = useState("general");

  useEffect(() => { setRows(decisions); }, [decisions]);

  async function markDecided(id) {
    if (!supabase) return;
    await supabase.from("decisions").update({ status: "decided", decided_at: new Date().toISOString() }).eq("id", id);
    setRows((r) => r.filter((d) => d.id !== id));
  }

  async function markDeferred(id) {
    if (!supabase) return;
    await supabase.from("decisions").update({ status: "deferred" }).eq("id", id);
    setRows((r) => r.filter((d) => d.id !== id));
  }

  async function addDecision(e) {
    e.preventDefault();
    if (!title.trim() || !supabase) return;
    const { data, error } = await supabase.from("decisions").insert({
      title: title.trim(),
      cost_per_day: parseFloat(cost) || 0,
      role,
    }).select().single();
    if (!error && data) {
      setRows((r) => [...r, data].sort((a, b) => (b.cost_per_day ?? 0) - (a.cost_per_day ?? 0)));
      setTitle(""); setCost("");
    }
  }

  const pending = rows.filter((d) => d.status === "pending").sort((a, b) => (b.cost_per_day ?? 0) - (a.cost_per_day ?? 0));

  return (
    <div className="glass p-5 flex flex-col gap-4">
      <div className="label">Decision Queue</div>

      {pending.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <Zap size={14} />
          <span>No decisions pending — decisive.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((d) => (
            <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <span className="flex-1 text-sm text-jarvis-ink truncate">{d.title}</span>
              <span className={`chip text-[10px] ${ROLE_COLORS[d.role] ?? ROLE_COLORS.general}`}>{d.role}</span>
              {d.cost_per_day > 0 && (
                <span className="chip text-[10px] bg-jarvis-red/15 text-jarvis-red">${d.cost_per_day}/day</span>
              )}
              <button onClick={() => markDecided(d.id)} className="p-1 text-jarvis-green hover:opacity-80" title="Decided">
                <CheckCircle size={14} />
              </button>
              <button onClick={() => markDeferred(d.id)} className="p-1 text-jarvis-muted hover:opacity-80" title="Defer">
                <Clock size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addDecision} className="flex flex-col gap-2 pt-2 border-t border-jarvis-border">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Decision to make..."
          className="input-field text-sm"
        />
        <div className="flex gap-2">
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Cost/day ($)"
            className="input-field text-sm w-32"
            type="number" min="0"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input-field text-sm flex-1">
            <option value="general">General</option>
            <option value="sales">Sales</option>
            <option value="trading">Trading</option>
            <option value="build">Build</option>
          </select>
          <button type="submit" className="btn-primary flex items-center gap-1 text-sm px-3">
            <Plus size={13} /> Add
          </button>
        </div>
      </form>
    </div>
  );
}
