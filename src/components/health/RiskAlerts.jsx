import { Shield, AlertTriangle, Moon, Dumbbell, TrendingDown, Flame } from "lucide-react";

const TYPE_ICON = {
  low_sleep: Moon,
  no_workout: Dumbbell,
  energy_decline: TrendingDown,
  broken_streak: Flame,
};

const SEVERITY_COLOR = {
  high:   "text-jarvis-red",
  medium: "text-jarvis-amber",
  low:    "text-jarvis-body",
};

export function RiskAlerts({ riskAlerts }) {
  if (!riskAlerts || riskAlerts.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Health Risks</div>
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <Shield size={14} />
          <span>No health risks — keep it up.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Health Risks</div>
      <div className="space-y-2">
        {riskAlerts.map((alert) => {
          const Icon = TYPE_ICON[alert.type] ?? AlertTriangle;
          const color = SEVERITY_COLOR[alert.severity] ?? "text-jarvis-body";
          return (
            <div key={alert.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <Icon size={14} className={color} />
              <span className="text-sm text-jarvis-body flex-1">{alert.text}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${color}`}>{alert.severity}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
