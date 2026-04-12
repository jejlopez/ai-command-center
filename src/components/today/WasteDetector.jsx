import { AlertTriangle, Shield, Calendar, TrendingDown, CreditCard, Flame } from "lucide-react";

const TYPE_ICON = { stale_deals: TrendingDown, expense_due: CreditCard, no_stoploss: TrendingDown, broken_streak: Flame, no_agenda: Calendar };
const SEVERITY_COLOR = { high: "text-jarvis-red", medium: "text-jarvis-amber", low: "text-jarvis-body" };

function daysSince(ts) {
  if (!ts) return 999;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

export function WasteDetector({ precomputed, deals = [], positions = [], expenses = [], habits = [], calendarItems = [] }) {
  // Use precomputed data if available (from today_intelligence)
  if (precomputed && precomputed.length > 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Waste Detector</div>
        <div className="space-y-2">
          {precomputed.map((a) => {
            const Icon = TYPE_ICON[a.type] ?? AlertTriangle;
            const colorClass = SEVERITY_COLOR[a.severity] ?? "text-jarvis-body";
            return (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
                <Icon size={14} className={colorClass} />
                <span className="text-sm text-jarvis-body">{a.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const alerts = [];

  const emptyMeetings = (calendarItems ?? []).filter((e) => e.kind !== "focus" && !e.notes && !e.description);
  if (emptyMeetings.length > 0) {
    const totalMin = emptyMeetings.reduce((s, e) => {
      const dur = (new Date(e.end) - new Date(e.start)) / 60000;
      return s + (dur > 0 ? dur : 30);
    }, 0);
    alerts.push({ id: "no-agenda", icon: Calendar, text: `${Math.round(totalMin)}min of meetings with no agenda`, color: "text-jarvis-amber" });
  }

  const stale = deals.filter((d) => daysSince(d.last_touch) > 7);
  if (stale.length > 0) {
    alerts.push({ id: "stale-deals", icon: TrendingDown, text: `${stale.length} deal${stale.length > 1 ? "s" : ""} going stale (7+ days)`, color: "text-jarvis-red" });
  }

  for (const exp of expenses) {
    alerts.push({ id: `exp-${exp.id}`, icon: CreditCard, text: `$${exp.amount_usd} due: ${exp.name}`, color: "text-jarvis-amber" });
  }

  const noStop = positions.filter((p) => !p.stop_loss);
  if (noStop.length > 0) {
    alerts.push({ id: "no-stoploss", icon: TrendingDown, text: `${noStop.length} position${noStop.length > 1 ? "s" : ""} with no stop-loss`, color: "text-jarvis-red" });
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const h of habits) {
    if (h.current_streak > 0 && h.last_done && h.last_done < today) {
      const missed = daysSince(h.last_done + "T00:00:00");
      if (missed >= 2) {
        alerts.push({ id: `habit-${h.id}`, icon: Flame, text: `${h.name} streak broken after ${h.current_streak}d`, color: "text-jarvis-amber" });
      }
    }
  }

  if (alerts.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Waste Detector</div>
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <Shield size={14} />
          <span>No waste detected — clean day.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Waste Detector</div>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
            <a.icon size={14} className={a.color} />
            <span className="text-sm text-jarvis-body">{a.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
