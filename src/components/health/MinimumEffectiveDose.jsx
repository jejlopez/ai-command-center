import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function ago30() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function MinimumEffectiveDose() {
  const [dose, setDose] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from("health_log")
          .select("sleep_hours,water_liters,workout,energy")
          .gte("date", ago30());

        if (!data?.length || data.length < 7) { setLoading(false); return; }

        // Find minimum thresholds on high-energy days (energy >= 7)
        const highEnergy = data.filter(r => (r.energy ?? 0) >= 7);
        if (!highEnergy.length) { setLoading(false); return; }

        const minSleep = Math.min(...highEnergy.map(r => r.sleep_hours ?? 0)).toFixed(1);
        const minWater = Math.min(...highEnergy.map(r => r.water_liters ?? 0)).toFixed(1);
        const workoutRate = highEnergy.filter(r => r.workout).length / highEnergy.length;

        setDose({ sleep: minSleep, water: minWater, workout: workoutRate >= 0.5 });
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Minimum Effective Dose</div>
        <Target size={14} className="text-jarvis-purple" />
      </div>
      {loading ? (
        <p className="text-sm text-jarvis-muted">Analyzing…</p>
      ) : !dose ? (
        <p className="text-sm text-jarvis-muted">Log 7+ days to find your minimum effective dose.</p>
      ) : (
        <>
          <p className="text-xs text-jarvis-muted mb-3">If you only do 3 things, do these:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-purple/20 bg-jarvis-purple/5">
              <span className="text-jarvis-purple font-bold text-sm">1</span>
              <p className="text-sm text-jarvis-ink">{dose.sleep}h sleep minimum</p>
            </div>
            {dose.workout && (
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-purple/20 bg-jarvis-purple/5">
                <span className="text-jarvis-purple font-bold text-sm">2</span>
                <p className="text-sm text-jarvis-ink">20-min workout</p>
              </div>
            )}
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-purple/20 bg-jarvis-purple/5">
              <span className="text-jarvis-purple font-bold text-sm">{dose.workout ? "3" : "2"}</span>
              <p className="text-sm text-jarvis-ink">{dose.water}L water</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
