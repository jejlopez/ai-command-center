import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, BellRing, Ban, CheckCircle2, DollarSign, ChevronDown, ChevronRight, Pencil, ThumbsDown, Check, Loader2 } from "lucide-react";
import { stagger } from "../lib/motion.js";
import { jarvis } from "../lib/jarvis.js";
import SkillsRailWidget from "./skills/SkillsRailWidget.jsx";

function Card({ Icon, title, tone = "primary", count, children }) {
  const toneClass = {
    amber: "text-jarvis-amber",
    red: "text-jarvis-red",
    green: "text-jarvis-green",
    primary: "text-jarvis-primary",
  }[tone];
  return (
    <motion.div variants={stagger.item} className="surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={14} className={toneClass} />
          <span className="label">{title}</span>
        </div>
        {typeof count === "number" && (
          <span className="text-[11px] text-jarvis-muted font-medium">{count}</span>
        )}
      </div>
      <div className="space-y-2.5">{children}</div>
    </motion.div>
  );
}

function fmtUsd(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

// ── Inline value estimate card for the rail ──────────────────────────────────

function ValueEstimateRailCard({ approval, onDecided }) {
  const [expanded, setExpanded] = useState(false);
  const [currentApproval, setCurrentApproval] = useState(approval);
  const p = currentApproval.payload || {};
  const math = p.math || [];
  const mathTotal = math.reduce((s, m) => s + (Number(m.amount) || 0), 0);
  const [editedValue, setEditedValue] = useState(p.estimated_value ?? 0);
  const [denyMode, setDenyMode] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [decided, setDecided] = useState(null); // "approved" | "reestimating" | "denied"
  const [busy, setBusy] = useState(false);

  const confPct = p.confidence_pct ?? 50;
  const confColor = confPct >= 70 ? "text-green-400" : confPct >= 40 ? "text-amber-400" : "text-red-400";
  const barColor = confPct >= 70 ? "bg-green-500" : confPct >= 40 ? "bg-amber-500" : "bg-red-500";

  const handleApprove = async () => {
    setBusy(true);
    await jarvis.decideApproval(approval.id, "approve", "");
    setDecided("approved");
    setBusy(false);
    onDecided?.();
  };

  const handleEditApprove = async () => {
    setBusy(true);
    await jarvis.decideApproval(approval.id, "approve", `Corrected to ${fmtUsd(editedValue)}`);
    setDecided("approved");
    setBusy(false);
    onDecided?.();
  };

  const handleDeny = async () => {
    if (!denyReason.trim()) return;
    setBusy(true);
    setDecided("reestimating");

    try {
      // Dismiss the old approval
      await jarvis.decideApproval(currentApproval.id, "deny", denyReason.trim());

      // Send feedback — this triggers re-estimation on the backend
      await fetch("http://127.0.0.1:8787/crm/value-estimate-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_id: p.deal_id,
          company: p.company,
          original_estimate: p.estimated_value,
          corrected_value: editedValue !== p.estimated_value ? editedValue : null,
          math: p.math,
          data_sources: p.data_sources,
          reason: denyReason.trim(),
          decision: "rejected",
        }),
      });

      // Poll for the new approval (backend re-estimates async, usually 5-15s)
      let newApproval = null;
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const all = await jarvis.approvals();
          newApproval = all.find(a =>
            a.payload?.deal_id === p.deal_id &&
            a.id !== currentApproval.id &&
            (a.payload?.attempt ?? 1) > (p.attempt ?? 1)
          );
          if (newApproval) break;
        } catch {}
      }

      if (newApproval) {
        // Swap in the new estimate — reset the card state
        setCurrentApproval(newApproval);
        setEditedValue(newApproval.payload?.estimated_value ?? 0);
        setDenyMode(false);
        setDenyReason("");
        setDecided(null);
        setExpanded(true);
        setBusy(false);
        return;
      }
    } catch {}

    // If re-estimation didn't produce a result, show denied
    setDecided("denied");
    setBusy(false);
    onDecided?.();
  };

  if (decided === "approved") {
    return (
      <div className="rounded-lg bg-white/[0.03] border border-jarvis-border/30 p-2 flex items-center gap-2">
        <Check size={11} className="text-green-400" />
        <span className="text-[10px] text-jarvis-muted truncate">{p.company} — {fmtUsd(editedValue)} saved</span>
      </div>
    );
  }

  if (decided === "reestimating") {
    return (
      <div className="rounded-xl bg-jarvis-primary/5 border border-jarvis-primary/20 p-3 flex items-center gap-2">
        <Loader2 size={12} className="animate-spin text-jarvis-primary" />
        <div>
          <div className="text-[11px] text-jarvis-ink font-medium">{p.company}</div>
          <div className="text-[9px] text-jarvis-primary">Re-estimating with your feedback...</div>
        </div>
      </div>
    );
  }

  if (decided === "denied") {
    return (
      <div className="rounded-lg bg-white/[0.03] border border-jarvis-border/30 p-2 flex items-center gap-2">
        <Check size={11} className="text-jarvis-primary" />
        <span className="text-[10px] text-jarvis-muted truncate">{p.company} — denied, no re-estimate available</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-jarvis-amber/5 border border-jarvis-amber/20 overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-white/[0.02] transition"
      >
        <DollarSign size={11} className="text-jarvis-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-jarvis-ink font-medium truncate">{p.company || approval.title}</div>
          <div className="text-[9px] text-jarvis-muted">
            {p.stage}
            {p.attempt > 1 && <span className="ml-1.5 text-jarvis-warning">· attempt {p.attempt}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[12px] font-bold text-jarvis-success tabular-nums">{fmtUsd(p.estimated_value)}<span className="text-[8px] text-jarvis-muted font-normal">/yr</span></div>
          {p.monthly_total > 0 && <div className="text-[8px] text-jarvis-muted tabular-nums">{fmtUsd(p.monthly_total)}/mo</div>}
        </div>
        <span className={`text-[9px] font-medium tabular-nums shrink-0 ${confColor}`}>{confPct}%</span>
        {expanded ? <ChevronDown size={11} className="text-jarvis-muted" /> : <ChevronRight size={11} className="text-jarvis-muted" />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-jarvis-amber/10 pt-2.5">
          {/* Data sources */}
          {p.data_sources?.length > 0 && (
            <div>
              <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold">Data Sources</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {p.data_sources.map(src => (
                  <span key={src} className="px-1.5 py-0.5 rounded-full bg-jarvis-primary/10 border border-jarvis-primary/20 text-[7px] text-jarvis-primary font-medium">
                    {src.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Math breakdown */}
          <div>
            <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold">Pricing Math</span>
            <div className="mt-0.5 rounded bg-white/[0.03] border border-white/5 overflow-hidden">
              {math.length > 0 ? (
                <>
                  {math.map((m, i) => (
                    <div key={i} className="flex items-start justify-between px-2 py-1 border-b border-white/5 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] text-jarvis-ink">{m.line}</div>
                        <div className="text-[7px] text-jarvis-muted font-mono">{m.calc}</div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        {m.monthly > 0 && <div className="text-[7px] text-jarvis-muted tabular-nums">{fmtUsd(m.monthly)}/mo</div>}
                        <div className="text-[9px] text-jarvis-ink font-semibold tabular-nums">{fmtUsd(m.amount)}/yr</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between px-2 py-1 bg-white/[0.03] border-t border-white/8">
                    <span className="text-[9px] font-semibold text-jarvis-ink">Total</span>
                    <div className="text-right">
                      {p.monthly_total > 0 && <div className="text-[7px] text-jarvis-muted tabular-nums">{fmtUsd(p.monthly_total)}/mo</div>}
                      <div className="text-[10px] text-jarvis-success font-bold tabular-nums">{fmtUsd(mathTotal)}/yr</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="px-2 py-1.5 text-[8px] text-jarvis-muted">Benchmark estimate — no line items</div>
              )}
            </div>
          </div>

          {/* Confidence */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold">Confidence</span>
              <span className={`text-[10px] font-bold tabular-nums ${confColor}`}>{confPct}%</span>
            </div>
            <div className="w-full h-1 rounded-full bg-white/10 mt-0.5">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${confPct}%` }} />
            </div>
            {p.confidence_why && <p className="text-[8px] text-jarvis-muted mt-0.5">{p.confidence_why}</p>}
          </div>

          {/* Assumptions */}
          {p.assumptions && (
            <div>
              <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold">Assumptions</span>
              <p className="text-[8px] text-jarvis-body mt-0.5 leading-relaxed">{p.assumptions}</p>
            </div>
          )}

          {/* Inline edit */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-jarvis-muted">$</span>
            <input
              type="number"
              value={editedValue}
              onChange={e => setEditedValue(Number(e.target.value))}
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] text-jarvis-ink font-bold tabular-nums focus:outline-none focus:border-jarvis-accent/50"
            />
            {editedValue !== p.estimated_value && (
              <span className="text-[8px] text-jarvis-warning">{editedValue > p.estimated_value ? "+" : ""}{fmtUsd(editedValue - p.estimated_value)}</span>
            )}
          </div>

          {/* Actions */}
          {denyMode ? (
            <div className="space-y-1.5">
              <textarea
                autoFocus
                value={denyReason}
                onChange={e => setDenyReason(e.target.value)}
                placeholder="Why is this estimate wrong?"
                rows={2}
                className="w-full bg-white/5 border border-red-800/40 rounded px-2 py-1 text-[10px] text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-red-600/60 resize-none"
              />
              <div className="flex gap-1.5">
                <button onClick={() => { setDenyMode(false); setDenyReason(""); }} className="text-[9px] text-jarvis-muted hover:text-jarvis-ink">Back</button>
                <button
                  onClick={handleDeny}
                  disabled={!denyReason.trim() || busy}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium bg-red-900/40 text-red-400 border border-red-800/50 disabled:opacity-40 ml-auto"
                >
                  {busy ? <Loader2 size={9} className="animate-spin" /> : <ThumbsDown size={9} />}
                  Deny & Teach
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-1.5">
              <button
                onClick={handleApprove}
                disabled={busy}
                className="flex-1 py-1.5 rounded-lg bg-jarvis-green/15 text-jarvis-green text-[10px] font-semibold hover:bg-jarvis-green/25 transition disabled:opacity-40"
              >
                Approve {fmtUsd(p.estimated_value)}
              </button>
              {editedValue !== p.estimated_value && (
                <button
                  onClick={handleEditApprove}
                  disabled={busy}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-jarvis-primary/15 text-jarvis-primary text-[10px] font-semibold hover:bg-jarvis-primary/25 transition disabled:opacity-40"
                >
                  <Pencil size={9} />
                  {fmtUsd(editedValue)}
                </button>
              )}
              <button
                onClick={() => setDenyMode(true)}
                className="px-2 py-1.5 rounded-lg bg-white/5 text-jarvis-body text-[10px] font-semibold hover:bg-white/10 transition"
              >
                Deny
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Standard approval card (non-value-estimate) ──────────────────────────────

function StandardApprovalCard({ approval, onDecide }) {
  return (
    <div className="rounded-xl bg-jarvis-amber/5 border border-jarvis-amber/20 p-3">
      <div className="text-[13px] text-jarvis-ink font-medium">{approval.title}</div>
      <div className="text-[11px] text-jarvis-body mt-1">{approval.reason}</div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onDecide?.(approval.id, "approve")}
          className="flex-1 py-1.5 rounded-lg bg-jarvis-green/15 text-jarvis-green text-[11px] font-semibold hover:bg-jarvis-green/25 transition"
        >
          Approve
        </button>
        <button
          onClick={() => onDecide?.(approval.id, "deny")}
          className="flex-1 py-1.5 rounded-lg bg-white/5 text-jarvis-body text-[11px] font-semibold hover:bg-white/10 transition"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

// ── Main RightRail ───────────────────────────────────────────────────────────

export function RightRail({ rail, onDecide, recentRuns = [] }) {
  if (!rail) return null;

  const valueEstimates = rail.approvals.filter(a => a.skill === "deal_value_estimator");
  const otherApprovals = rail.approvals.filter(a => a.skill !== "deal_value_estimator");

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="show"
      className="w-[300px] space-y-4 shrink-0"
    >
      <Card Icon={ShieldAlert} title="Pending Approvals" tone="amber" count={rail.approvals.length}>
        {rail.approvals.length === 0 && (
          <div className="text-[11px] text-jarvis-muted italic">No approvals pending.</div>
        )}
        {valueEstimates.map(a => (
          <ValueEstimateRailCard key={a.id} approval={a} onDecided={() => {}} />
        ))}
        {otherApprovals.map(a => (
          <StandardApprovalCard key={a.id} approval={a} onDecide={onDecide} />
        ))}
      </Card>

      <Card Icon={BellRing} title="Reminders" tone="primary" count={rail.reminders.length}>
        {rail.reminders.map((r) => (
          <div key={r.id} className="text-[12px] text-jarvis-body">
            <span className="text-jarvis-ink">{r.title}</span>
          </div>
        ))}
      </Card>

      <Card Icon={Ban} title="Blocked" tone="red" count={rail.blocked.length}>
        {rail.blocked.map((b) => (
          <div key={b.id} className="text-[12px]">
            <div className="text-jarvis-ink">{b.title}</div>
            <div className="text-[11px] text-jarvis-muted">{b.blockedBy}</div>
          </div>
        ))}
      </Card>

      <Card Icon={CheckCircle2} title="Recently Completed" tone="green" count={rail.completed.length}>
        {rail.completed.map((c) => (
          <div key={c.id} className="text-[12px] text-jarvis-body">
            {c.title}
          </div>
        ))}
      </Card>

      <SkillsRailWidget runs={recentRuns} />
    </motion.div>
  );
}
