import { Check, X } from "lucide-react";

function energyBg(score) {
  if (score == null) return "bg-white/5 text-jarvis-muted";
  if (score >= 7) return "bg-jarvis-green/20 text-jarvis-green";
  if (score >= 4) return "bg-jarvis-amber/20 text-jarvis-amber";
  return "bg-jarvis-red/20 text-jarvis-red";
}

function sleepBg(hours) {
  if (hours == null) return "bg-white/5";
  if (hours >= 7.5) return "bg-jarvis-green/30";
  if (hours >= 6) return "bg-jarvis-amber/30";
  return "bg-jarvis-red/30";
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()];
}

function shortDate(dateStr) {
  const [, , dd] = dateStr.split("-");
  return dd;
}

export function WeeklyTrends({ weeklyTrends }) {
  if (!weeklyTrends || weeklyTrends.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Weekly Trends</div>
        <p className="text-sm text-jarvis-muted">Log a few days to see trends.</p>
      </div>
    );
  }

  const days = weeklyTrends.slice(-7);

  return (
    <div className="glass p-5">
      <div className="label mb-4">Weekly Trends</div>
      <div className="overflow-x-auto">
        <div className="min-w-[300px]">
          {/* Day headers */}
          <div className="grid gap-1 mb-2" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
            <div />
            {days.map((d) => (
              <div key={d.date} className="text-center">
                <div className="text-[10px] text-jarvis-muted font-medium">{dayLabel(d.date)}</div>
                <div className="text-[9px] text-jarvis-muted/60">{shortDate(d.date)}</div>
              </div>
            ))}
          </div>

          {/* Energy row */}
          <div className="grid gap-1 mb-1.5" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
            <div className="text-[11px] text-jarvis-muted self-center">Energy</div>
            {days.map((d) => (
              <div key={d.date} className={`h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold tabular-nums ${energyBg(d.energy)}`}>
                {d.energy ?? "—"}
              </div>
            ))}
          </div>

          {/* Sleep row */}
          <div className="grid gap-1 mb-1.5" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
            <div className="text-[11px] text-jarvis-muted self-center">Sleep</div>
            {days.map((d) => (
              <div key={d.date} className={`h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold tabular-nums ${sleepBg(d.sleep_hours)}`}>
                <span className={d.sleep_hours != null ? (d.sleep_hours >= 7.5 ? "text-jarvis-green" : d.sleep_hours >= 6 ? "text-jarvis-amber" : "text-jarvis-red") : "text-jarvis-muted"}>
                  {d.sleep_hours != null ? `${d.sleep_hours}h` : "—"}
                </span>
              </div>
            ))}
          </div>

          {/* Workout row */}
          <div className="grid gap-1" style={{ gridTemplateColumns: `80px repeat(${days.length}, 1fr)` }}>
            <div className="text-[11px] text-jarvis-muted self-center">Workout</div>
            {days.map((d) => (
              <div key={d.date} className={`h-7 rounded-lg flex items-center justify-center ${d.workout ? "bg-jarvis-green/10" : "bg-white/[0.02]"}`}>
                {d.workout
                  ? <Check size={12} className="text-jarvis-green" />
                  : <X size={12} className="text-jarvis-muted/40" />
                }
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
