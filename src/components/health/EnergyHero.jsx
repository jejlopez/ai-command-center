import { Zap, Moon, Dumbbell } from "lucide-react";

function Sparkline({ data, width = 200, height = 40 }) {
  if (!data || data.length < 2) return null;
  const max = 10;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v / max) * (height - 4) + 2)}`).join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeOpacity={0.1} />
      <polyline fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={points} className="text-jarvis-purple" />
    </svg>
  );
}

function energyColor(score) {
  if (score == null) return "text-jarvis-muted";
  if (score >= 7) return "text-jarvis-green";
  if (score >= 4) return "text-jarvis-amber";
  return "text-jarvis-red";
}

function energyGlow(score) {
  if (score == null) return "border-jarvis-border";
  if (score >= 7) return "border-jarvis-green/20 shadow-glow-green";
  if (score >= 4) return "border-jarvis-amber/20";
  return "border-jarvis-red/20 shadow-glow-red";
}

export function EnergyHero({ energyHero }) {
  if (!energyHero || energyHero.energy == null) {
    return (
      <div className="glass p-6 border border-jarvis-border">
        <div className="label text-jarvis-purple">Energy</div>
        <p className="text-sm text-jarvis-muted mt-2">Log your energy in Today's end-of-day review.</p>
      </div>
    );
  }

  const { energy, sleep_hours, workout, workout_type, sparkline_7d } = energyHero;
  const color = energyColor(energy);
  const glow = energyGlow(energy);

  return (
    <div className={`glass p-6 border ${glow} animate-fadeIn`}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="label text-jarvis-purple">Energy</div>
          <div className="flex items-baseline gap-3 mt-2">
            <span className={`font-display text-5xl tabular-nums ${color}`}>{energy}</span>
            <span className="text-lg text-jarvis-muted font-light">/10</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {sleep_hours != null && (
              <span className="chip flex items-center gap-1">
                <Moon size={11} className="text-jarvis-purple" />
                <span className="text-jarvis-muted">Sleep</span>{" "}
                <span className="font-semibold text-jarvis-ink">{sleep_hours}h</span>
              </span>
            )}
            <span className={`chip flex items-center gap-1 ${workout ? "border-jarvis-green/30 bg-jarvis-green/5" : "border-jarvis-border"}`}>
              <Dumbbell size={11} className={workout ? "text-jarvis-green" : "text-jarvis-muted"} />
              <span className={workout ? "text-jarvis-green font-semibold" : "text-jarvis-muted"}>
                {workout ? (workout_type || "Workout done") : "No workout"}
              </span>
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <div className="text-[10px] text-jarvis-muted mb-1 text-right">7-day energy</div>
          <Sparkline data={sparkline_7d} />
        </div>
      </div>
    </div>
  );
}
