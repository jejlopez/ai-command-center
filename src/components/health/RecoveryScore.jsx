import { Activity } from "lucide-react";

function scoreColor(score) {
  if (score >= 70) return "text-jarvis-green";
  if (score >= 40) return "text-jarvis-amber";
  return "text-jarvis-red";
}

function scoreGlow(score) {
  if (score >= 70) return "border-jarvis-green/20 shadow-glow-green";
  if (score >= 40) return "border-jarvis-amber/20";
  return "border-jarvis-red/20";
}

function SubMetric({ label, value, score, maxScore }) {
  const pct = maxScore > 0 ? Math.min(100, (score / maxScore) * 100) : 0;
  const barColor = pct >= 70 ? "bg-jarvis-green" : pct >= 40 ? "bg-jarvis-amber" : "bg-jarvis-red";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-jarvis-muted">{label}</span>
        <span className="text-[11px] font-semibold text-jarvis-ink tabular-nums">{value}</span>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function RecoveryScore({ recoveryScore }) {
  if (!recoveryScore || recoveryScore.score == null) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Recovery Score</div>
        <p className="text-sm text-jarvis-muted">Log energy, sleep, and workouts to see your recovery score.</p>
      </div>
    );
  }

  const { score, avg_energy_3d, avg_sleep_7d, workout_days_7d, energy_score, sleep_score, workout_score } = recoveryScore;
  const color = scoreColor(score);
  const glow = scoreGlow(score);

  return (
    <div className={`glass p-5 border ${glow} animate-fadeIn`}>
      <div className="flex items-start justify-between mb-4">
        <div className="label">Recovery Score</div>
        <Activity size={14} className="text-jarvis-purple mt-0.5" />
      </div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className={`font-display text-4xl tabular-nums ${color}`}>{score}</span>
        <span className="text-jarvis-muted">/100</span>
      </div>
      <div className="space-y-3">
        <SubMetric
          label="Avg Energy (3d)"
          value={`${avg_energy_3d ?? 0}/10`}
          score={energy_score ?? 0}
          maxScore={50}
        />
        <SubMetric
          label="Sleep Consistency (7d)"
          value={`${avg_sleep_7d ?? 0}h avg`}
          score={sleep_score ?? 0}
          maxScore={20}
        />
        <SubMetric
          label="Workout Frequency (7d)"
          value={`${workout_days_7d ?? 0} sessions`}
          score={workout_score ?? 0}
          maxScore={30}
        />
      </div>
    </div>
  );
}
