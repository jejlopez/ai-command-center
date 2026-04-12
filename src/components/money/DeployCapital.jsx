import { DollarSign, Scissors, Shield } from "lucide-react";

const ICON_MAP = { DollarSign, Scissors, Shield };

export function DeployCapital({ deploy }) {
  if (!deploy || deploy.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Deploy Capital</div>
        <p className="text-sm text-jarvis-muted">Recommendations appear as you add deals and expenses.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Deploy Capital</div>
      <div className="space-y-2">
        {deploy.map((d) => {
          const Icon = ICON_MAP[d.icon] ?? DollarSign;
          return (
            <div key={d.id} className="flex items-start gap-3 px-3 py-3 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <div className="w-8 h-8 rounded-lg bg-jarvis-green/10 grid place-items-center shrink-0">
                <Icon size={14} className="text-jarvis-green" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-jarvis-ink">{d.text}</div>
                <div className="text-[10px] text-jarvis-green font-semibold mt-0.5 tabular-nums">Impact: ${(d.impact ?? 0).toLocaleString()}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
