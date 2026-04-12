import { useSocketStatus } from "../hooks/useJarvisSocket.js";

function Indicator({ label, value, color = "text-jarvis-muted" }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-jarvis-muted">{label}</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  );
}

export function StatusStrip({ vaultLocked, cost }) {
  const connected = useSocketStatus();
  const spent = cost?.spentUsd != null ? `$${cost.spentUsd.toFixed(2)}` : "—";
  const budget = cost?.budgetUsd != null ? `$${cost.budgetUsd}` : "—";
  const frac = (cost?.spentUsd && cost?.budgetUsd) ? cost.spentUsd / cost.budgetUsd : 0;
  const costColor = frac < 0.5 ? "text-jarvis-success" : frac < 0.9 ? "text-jarvis-warning" : "text-jarvis-danger";

  return (
    <div className="flex items-center gap-5">
      <Indicator label="Spend" value={`${spent} / ${budget}`} color={costColor} />
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-jarvis-success" : "bg-jarvis-danger"}`} />
        <span className="text-[10px] text-jarvis-muted">{connected ? "Live" : "Off"}</span>
      </div>
      <span className={`text-[10px] ${vaultLocked ? "text-jarvis-warning" : "text-jarvis-muted"}`}>
        {vaultLocked ? "Locked" : "Vault open"}
      </span>
    </div>
  );
}
