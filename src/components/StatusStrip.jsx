import { Activity, Clock, Wallet, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { useSocketStatus } from "../hooks/useJarvisSocket.js";

function Chip({ Icon, label, value, tone = "cyan" }) {
  const toneClass = {
    cyan:  "text-jarvis-cyan",
    amber: "text-jarvis-amber",
    green: "text-jarvis-green",
    blue:  "text-jarvis-blue",
    red:   "text-jarvis-red",
    muted: "text-jarvis-muted",
  }[tone];
  return (
    <div className="glass px-3 py-1.5 flex items-center gap-2 rounded-xl">
      <Icon size={14} className={toneClass} />
      <div className="flex items-center gap-1.5">
        <span className="label">{label}</span>
        <span className="text-[12px] text-jarvis-ink font-medium">{value}</span>
      </div>
    </div>
  );
}

function costTone(cost) {
  if (!cost || typeof cost.spentUsd !== "number" || typeof cost.budgetUsd !== "number" || cost.budgetUsd <= 0) {
    return "muted";
  }
  const frac = cost.spentUsd / cost.budgetUsd;
  if (frac < 0.5) return "green";
  if (frac < 0.9) return "amber";
  return "red";
}

function costValue(cost) {
  if (!cost || typeof cost.spentUsd !== "number" || typeof cost.budgetUsd !== "number") {
    return "—/—";
  }
  return `$${cost.spentUsd.toFixed(2)} / $${cost.budgetUsd}`;
}

export function StatusStrip({ vaultLocked, uptimeSec, cost }) {
  const uptimeMin = Math.max(0, Math.floor((uptimeSec ?? 0) / 60));
  const tone = costTone(cost);
  const wsConnected = useSocketStatus();
  return (
    <div className="flex items-center gap-2">
      <Chip Icon={Activity} label="Mode"   value="Deep Work" tone="cyan" />
      <Chip Icon={Clock}    label="Open"   value={`${uptimeMin}m`} tone="blue" />
      <Chip Icon={Wallet}   label="Today"  value={costValue(cost)} tone={tone} />
      <Chip Icon={ShieldCheck} label="Trust" value={vaultLocked ? "Locked" : "Open"} tone={vaultLocked ? "amber" : "green"} />
      <Chip Icon={wsConnected ? Wifi : WifiOff} label="Live" value={wsConnected ? "On" : "Off"} tone={wsConnected ? "green" : "muted"} />
    </div>
  );
}
