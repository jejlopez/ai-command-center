import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle } from "lucide-react";
import { FeedbackButtons, WhyThisDrawer } from "../FeedbackButtons.jsx";

function StatusPill({ status }) {
  const map = {
    completed: { Icon: CheckCircle2, cls: "bg-jarvis-green/10 text-jarvis-green border-jarvis-green/30" },
    running:   { Icon: Loader2,      cls: "bg-jarvis-cyan/10 text-jarvis-cyan border-jarvis-cyan/30",   spin: true },
    queued:    { Icon: Clock,        cls: "bg-jarvis-blue/10 text-jarvis-blue border-jarvis-blue/30" },
    failed:    { Icon: XCircle,      cls: "bg-jarvis-red/10 text-jarvis-red border-jarvis-red/30" },
    cancelled: { Icon: AlertTriangle, cls: "bg-jarvis-amber/10 text-jarvis-amber border-jarvis-amber/30" },
  };
  const entry = map[status] ?? map.queued;
  const { Icon, cls, spin } = entry;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-[0.14em] font-semibold border ${cls}`}>
      <Icon size={11} className={spin ? "animate-spin" : ""} />
      {status}
    </span>
  );
}

function formatDuration(ms) {
  if (typeof ms !== "number") return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatCost(usd) {
  if (typeof usd !== "number") return "—";
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

export default function SkillRunResult({ run }) {
  if (!run) return null;
  const { status, error, output, durationMs, costUsd, startedAt, completedAt } = run;

  const outputNode = (() => {
    if (error) return null;
    if (output == null) {
      return (
        <div className="text-[12px] text-jarvis-muted italic">No output.</div>
      );
    }
    if (typeof output === "string") {
      return (
        <div className="text-[13px] text-jarvis-ink whitespace-pre-wrap leading-relaxed">{output}</div>
      );
    }
    if (typeof output === "object" && typeof output.text === "string") {
      const rest = Object.entries(output).filter(([k]) => k !== "text");
      return (
        <div className="space-y-3">
          <div className="text-[13px] text-jarvis-ink whitespace-pre-wrap leading-relaxed">{output.text}</div>
          {rest.length > 0 && (
            <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 pt-2 border-t border-jarvis-border">
              {rest.map(([k, v]) => (
                <div key={k} className="contents">
                  <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-jarvis-muted">{k}</div>
                  <div className="text-[11px] text-jarvis-body break-all">
                    {typeof v === "object" ? JSON.stringify(v) : String(v)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return (
      <pre className="text-[11px] text-jarvis-body bg-jarvis-panel/40 border border-jarvis-border rounded-xl p-3 overflow-auto max-h-[400px] whitespace-pre-wrap">
        {JSON.stringify(output, null, 2)}
      </pre>
    );
  })();

  return (
    <div className="glass p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <StatusPill status={status} />
          <div className="text-[11px] text-jarvis-muted">
            {startedAt ? new Date(startedAt).toLocaleString() : "—"}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-jarvis-muted tabular-nums">
          <span>{formatDuration(durationMs)}</span>
          <span className="text-jarvis-border">|</span>
          <span>{formatCost(costUsd)}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-jarvis-red/5 border border-jarvis-red/30 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-jarvis-red mb-1">Error</div>
          <div className="text-[12px] text-jarvis-red whitespace-pre-wrap">{error}</div>
        </div>
      )}

      {!error && (
        <div>
          <div className="label mb-2">Output</div>
          {outputNode}
        </div>
      )}

      {(typeof run.tokensIn === "number" || typeof run.tokensOut === "number") && (
        <div className="flex items-center gap-3 text-[10px] text-jarvis-muted tabular-nums pt-2 border-t border-jarvis-border">
          <span>in: {run.tokensIn ?? 0}</span>
          <span>out: {run.tokensOut ?? 0}</span>
          {completedAt && <span className="ml-auto">completed {new Date(completedAt).toLocaleTimeString()}</span>}
        </div>
      )}

      {status === "completed" && (
        <div className="flex items-center justify-between pt-2 border-t border-jarvis-border">
          <FeedbackButtons runId={run.id} kind="skill_run" />
          <WhyThisDrawer runId={run.id} />
        </div>
      )}
    </div>
  );
}

export { StatusPill, formatDuration, formatCost };
