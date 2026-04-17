import { useState, useEffect } from "react";
import { useSocketStatus } from "../hooks/useJarvisSocket.js";
import { jarvis } from "../lib/jarvis.js";

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
  const [googleStatus, setGoogleStatus] = useState(null);
  const [learningCount, setLearningCount] = useState(0);

  // Poll Google + learning status every 30s
  useEffect(() => {
    const check = () => {
      jarvis.emailConnectionStatus?.()
        .then(s => setGoogleStatus(s?.gmail ?? null))
        .catch(() => setGoogleStatus(null));
      jarvis.learningDashboard?.()
        .then(d => setLearningCount(d?.eventsToday ?? d?.totalEvents ?? 0))
        .catch(() => {});
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const spent = cost?.spentUsd != null ? `$${cost.spentUsd.toFixed(2)}` : "—";
  const budget = cost?.budgetUsd != null ? `$${cost.budgetUsd}` : "—";
  const frac = (cost?.spentUsd && cost?.budgetUsd) ? cost.spentUsd / cost.budgetUsd : 0;
  const costColor = frac < 0.5 ? "text-jarvis-success" : frac < 0.9 ? "text-jarvis-warning" : "text-jarvis-danger";

  const googleConnected = googleStatus === "connected";
  const googleLabel = googleStatus === "connected" ? "Google" :
    googleStatus === "no_refresh" ? "Google: re-auth" :
    googleStatus === "no_creds" ? "Google: setup" :
    googleStatus === "vault_locked" ? "Google: locked" : "Google";

  return (
    <div className="flex items-center gap-5">
      <Indicator label="Spend" value={`${spent} / ${budget}`} color={costColor} />
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-jarvis-success" : "bg-jarvis-danger"}`} />
        <span className="text-[10px] text-jarvis-muted">{connected ? "Live" : "Off"}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${googleConnected ? "bg-jarvis-success" : "bg-jarvis-danger"}`} />
        <span className={`text-[10px] ${googleConnected ? "text-jarvis-muted" : "text-jarvis-warning"}`}>{googleLabel}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-jarvis-primary animate-pulse" />
        <span className="text-[10px] text-jarvis-primary">Learning{learningCount > 0 ? ` (${learningCount})` : ""}</span>
      </div>
      <span className={`text-[10px] ${vaultLocked ? "text-jarvis-warning" : "text-jarvis-muted"}`}>
        {vaultLocked ? "Locked" : "Vault open"}
      </span>
    </div>
  );
}
