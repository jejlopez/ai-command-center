import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const ROLES = ["sales", "trading", "build"];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7am–9pm

function intensity(val) {
  if (!val) return "bg-white/5";
  if (val >= 8) return "bg-jarvis-purple";
  if (val >= 6) return "bg-jarvis-purple/60";
  if (val >= 4) return "bg-jarvis-purple/30";
  return "bg-jarvis-purple/10";
}

export function PeakHoursMap() {
  const [grid, setGrid] = useState({});
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState({ hour: new Date().getHours(), role: "build", val: 7 });

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.from("peak_hours").select("hour,role,performance");
      if (!data) return;
      const map = {};
      data.forEach(r => {
        const key = `${r.role}-${r.hour}`;
        if (!map[key]) map[key] = { sum: 0, count: 0 };
        map[key].sum += r.performance;
        map[key].count += 1;
      });
      const avg = {};
      Object.entries(map).forEach(([k, v]) => { avg[k] = Math.round(v.sum / v.count); });
      setGrid(avg);
    })();
  }, []);

  const saveRating = async () => {
    if (!supabase) return;
    setSaving(true);
    try {
      await supabase.from("peak_hours").insert({ hour: rating.hour, role: rating.role, performance: rating.val });
      setGrid(g => ({ ...g, [`${rating.role}-${rating.hour}`]: rating.val }));
    } finally {
      setSaving(false);
    }
  };

  const peakByRole = ROLES.map(role => {
    let best = { hour: null, val: 0 };
    HOURS.forEach(h => {
      const v = grid[`${role}-${h}`] ?? 0;
      if (v > best.val) best = { hour: h, val: v };
    });
    return { role, hour: best.hour };
  }).filter(r => r.hour !== null);

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Peak Hours Map</div>
        <Clock size={14} className="text-jarvis-purple" />
      </div>

      <div className="overflow-x-auto mb-4">
        <table className="text-[10px] text-jarvis-muted w-full">
          <thead>
            <tr>
              <th className="text-left pr-2 font-normal pb-1">Role</th>
              {HOURS.map(h => <th key={h} className="w-5 text-center pb-1">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROLES.map(role => (
              <tr key={role}>
                <td className="pr-2 capitalize">{role}</td>
                {HOURS.map(h => (
                  <td key={h} className="p-0.5">
                    <div className={`w-4 h-4 rounded-sm ${intensity(grid[`${role}-${h}`])}`} title={grid[`${role}-${h}`] ? `${grid[`${role}-${h}`]}/10` : ""} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {peakByRole.length > 0 && (
        <div className="space-y-1 mb-3">
          {peakByRole.map(r => (
            <p key={r.role} className="text-xs text-jarvis-ink">
              Peak <span className="capitalize text-jarvis-purple">{r.role}</span>: {r.hour}:00
            </p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <select value={rating.role} onChange={e => setRating(r => ({ ...r, role: e.target.value }))}
          className="text-xs bg-white/5 border border-jarvis-border rounded-lg px-2 py-1 text-jarvis-ink">
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={rating.hour} onChange={e => setRating(r => ({ ...r, hour: +e.target.value }))}
          className="text-xs bg-white/5 border border-jarvis-border rounded-lg px-2 py-1 text-jarvis-ink">
          {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
        </select>
        <input type="number" min={1} max={10} value={rating.val}
          onChange={e => setRating(r => ({ ...r, val: +e.target.value }))}
          className="w-14 text-xs bg-white/5 border border-jarvis-border rounded-lg px-2 py-1 text-jarvis-ink" />
        <button onClick={saveRating} disabled={saving}
          className="px-3 py-1 rounded-lg text-xs bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/20 hover:bg-jarvis-purple/20 transition disabled:opacity-40">
          Rate
        </button>
      </div>
    </div>
  );
}
