import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const RECOVERY_ACTIONS = [
  "Take a 20-min walk outside",
  "No screen time for 1 hour",
  "Drink 500ml water now",
  "15-min power nap",
  "5 min box breathing (4-4-4-4)",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function RecoveryProtocol() {
  const [energy, setEnergy] = useState(null);
  const [goodHabits, setGoodHabits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      try {
        const [{ data: today }, { data: habits }] = await Promise.all([
          supabase.from("health_log").select("energy").eq("date", todayIso()).maybeSingle(),
          supabase.from("habits").select("name").eq("done_today", true).limit(5),
        ]);
        setEnergy(today?.energy ?? null);
        setGoodHabits((habits || []).map(h => h.name));
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Recovery Protocol</div>
        <Zap size={14} className="text-jarvis-purple" />
      </div>
      {loading ? (
        <p className="text-sm text-jarvis-muted">Loading…</p>
      ) : energy === null ? (
        <p className="text-sm text-jarvis-muted">Log today's energy to see your protocol.</p>
      ) : energy < 5 ? (
        <>
          <p className="text-xs text-jarvis-amber mb-3">Energy low ({energy}/10) — activate recovery:</p>
          <div className="space-y-2">
            {RECOVERY_ACTIONS.map((a, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-jarvis-amber/20 bg-jarvis-amber/5">
                <span className="text-jarvis-amber text-xs font-semibold">{i + 1}</span>
                <p className="text-sm text-jarvis-ink">{a}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-jarvis-green mb-3">Energy good ({energy}/10) — keep it up.</p>
          {goodHabits.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-jarvis-muted mb-2">Maintain with:</p>
              {goodHabits.map((h, i) => (
                <div key={i} className="px-3 py-2 rounded-xl border border-jarvis-green/20 bg-jarvis-green/5">
                  <p className="text-sm text-jarvis-ink">{h}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-jarvis-muted">Stay consistent with your current habits.</p>
          )}
        </>
      )}
    </div>
  );
}
