import { Briefcase, TrendingUp, CreditCard } from "lucide-react";

const ENGINE_CONFIG = [
  { key: "sales", label: "Sales Pipeline", Icon: Briefcase, color: "text-jarvis-primary", bgColor: "bg-jarvis-primary/15" },
  { key: "trading", label: "Trading", Icon: TrendingUp, color: "text-jarvis-purple", bgColor: "bg-purple-500/15" },
  { key: "ops", label: "Operations", Icon: CreditCard, color: "text-jarvis-primary", bgColor: "bg-jarvis-primary/15" },
];

function fmtUsd(n) { return n == null ? "--" : `$${Math.abs(n).toLocaleString()}`; }

function engineValue(engine, key) {
  if (key === "sales") return fmtUsd(engine?.pipeline_value);
  if (key === "trading") return `${(engine?.open_pnl ?? 0) >= 0 ? "+" : "-"}${fmtUsd(engine?.open_pnl)}`;
  if (key === "ops") return `${fmtUsd(engine?.monthly_burn)}/mo`;
  return "--";
}

export function ThreeEngines({ engines }) {
  if (!engines || Object.keys(engines).length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Three Engines</div>
        <p className="text-sm text-jarvis-muted">Add deals, trades, and expenses to see your engines.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Three Engines</div>
      <div className="space-y-2">
        {ENGINE_CONFIG.map(({ key, label, Icon, color, bgColor }, i) => {
          const engine = engines[key];
          return (
            <div key={key} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${bgColor}`}>
                <Icon size={16} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-jarvis-muted">{label}</div>
                <div className={`text-lg font-semibold tabular-nums ${color}`}>{engineValue(engine, key)}</div>
              </div>
              <div className="text-[11px] text-jarvis-body max-w-[140px] text-right">{engine?.status ?? ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
