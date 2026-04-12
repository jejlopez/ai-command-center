import { useCallback, useEffect, useState } from "react";
import { Activity, ShieldCheck, ShieldAlert, Scroll } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export function AboutPanel() {
  const [health, setHealth] = useState(null);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const h = await jarvis.health();
      setHealth(h);
    } catch (e) {
      setError(String(e.message ?? e));
    }
    try {
      const a = await jarvis.auditVerify();
      setAudit(a);
    } catch {
      setAudit({ ok: false, error: "unavailable" });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const auditOk = audit?.ok === true;

  return (
    <div>
      <div className="mb-5">
        <div className="label">About</div>
        <h3 className="font-display text-2xl text-jarvis-ink mt-1">System & integrity</h3>
        <p className="text-jarvis-body text-sm mt-1">
          Daemon telemetry and audit trail verification.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-jarvis-red/30 bg-jarvis-red/5 px-4 py-3 text-xs text-jarvis-red">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-jarvis-cyan/15 shadow-glow-cyan grid place-items-center">
              <Activity size={18} className="text-jarvis-cyan" />
            </div>
            <div>
              <div className="text-sm text-jarvis-ink font-semibold">Daemon</div>
              <div className="text-[11px] text-jarvis-muted">jarvisd</div>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-jarvis-muted">Status</dt>
              <dd className="text-jarvis-ink">{health?.status ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-jarvis-muted">Version</dt>
              <dd className="text-jarvis-ink font-mono">{health?.version ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-jarvis-muted">Uptime</dt>
              <dd className="text-jarvis-ink font-mono">{formatUptime(health?.uptimeSec)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-5">
          <div className="flex items-center gap-3">
            <div className={[
              "w-10 h-10 rounded-full grid place-items-center",
              auditOk ? "bg-jarvis-green/15 shadow-glow-green" : "bg-jarvis-amber/15 shadow-glow-amber",
            ].join(" ")}>
              {auditOk ? (
                <ShieldCheck size={18} className="text-jarvis-green" />
              ) : (
                <ShieldAlert size={18} className="text-jarvis-amber" />
              )}
            </div>
            <div>
              <div className="text-sm text-jarvis-ink font-semibold">Audit log</div>
              <div className="text-[11px] text-jarvis-muted">Tamper-evident ledger</div>
            </div>
          </div>
          <div className="mt-4">
            <span
              className={[
                "chip",
                auditOk
                  ? "bg-jarvis-green/10 text-jarvis-green"
                  : "bg-jarvis-amber/10 text-jarvis-amber",
              ].join(" ")}
            >
              {auditOk ? "Chain verified" : audit?.error ?? "Unverified"}
            </span>
            {typeof audit?.count === "number" && (
              <div className="text-[11px] text-jarvis-muted mt-2">
                {audit.count.toLocaleString()} entries
              </div>
            )}
          </div>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="mt-4 px-3 py-2 rounded-xl text-xs bg-white/5 text-jarvis-muted cursor-not-allowed flex items-center gap-1.5"
          >
            <Scroll size={12} /> View audit log
          </button>
        </div>
      </div>
    </div>
  );
}
