import { useState } from "react";
import {
  Mail, FileText, GitBranch, Clock, DollarSign, ChevronDown, ChevronRight,
  Check, Database, FileSearch, MailOpen, StickyNote, Pencil, ThumbsDown, Loader2,
} from "lucide-react";
import { useApprovalsSupa } from "../../hooks/useApprovalsSupa.js";
import ApprovalReview from "./ApprovalReview.jsx";

const TYPE_META = {
  email:               { icon: Mail,       label: "Email" },
  proposal:            { icon: FileText,   label: "Proposal" },
  stage_change:        { icon: GitBranch,  label: "Stage Change" },
  deal_value_estimate: { icon: DollarSign, label: "Value Estimate" },
};

const DATA_SOURCE_META = {
  deal_notes:    { icon: StickyNote, label: "Deal Notes" },
  crm_notes:     { icon: StickyNote, label: "CRM Notes" },
  activities:    { icon: Clock,      label: "Activities" },
  contact_email: { icon: MailOpen,   label: "Contact Email" },
  company_name:  { icon: FileSearch, label: "Company Name" },
  research:      { icon: Database,   label: "Research" },
  emails:        { icon: Mail,       label: "Emails" },
  website:       { icon: FileSearch, label: "Website" },
};

function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function fmtUsd(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

function preview(approval) {
  const draft = approval?.draft_content;
  if (!draft) return approval?.title || "—";
  if (draft.estimated_value) {
    return `${draft.company || ""} — ${fmtUsd(draft.estimated_value)} (${draft.confidence_pct ?? draft.confidence ?? "?"}%)`;
  }
  const text = draft.subject || draft.body || "";
  return text.slice(0, 80) + (text.length > 80 ? "…" : "");
}

function TypeIcon({ type }) {
  const meta = TYPE_META[type] || { icon: FileText, label: type };
  const Icon = meta.icon;
  return <Icon size={13} className="shrink-0 text-jarvis-muted" />;
}

function StatusBadge({ status }) {
  if (status === "approved")
    return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-900/50 text-green-400">approved</span>;
  if (status === "rejected")
    return <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-900/50 text-red-400">rejected</span>;
  return null;
}

// ── Inline expandable value estimate card ────────────────────────────────────

function ValueEstimateCard({ approval, onDecide }) {
  const [expanded, setExpanded] = useState(false);
  const d = approval.draft_content || {};
  const math = d.math || [];
  const mathTotal = math.reduce((s, m) => s + (Number(m.amount) || 0), 0);
  const [editedValue, setEditedValue] = useState(d.estimated_value ?? 0);
  const [denyMode, setDenyMode] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [decided, setDecided] = useState(null); // "approved" | "denied"
  const [busy, setBusy] = useState(false);

  const confPct = d.confidence_pct ?? 50;
  const confColor = confPct >= 70 ? "text-green-400" : confPct >= 40 ? "text-amber-400" : "text-red-400";
  const barColor = confPct >= 70 ? "bg-green-500" : confPct >= 40 ? "bg-amber-500" : "bg-red-500";

  const handleApprove = async () => {
    setBusy(true);
    await onDecide(approval.id, {
      status: "approved",
      finalContent: { estimated_value: d.estimated_value },
    });
    setDecided("approved");
    setBusy(false);
  };

  const handleEditApprove = async () => {
    setBusy(true);
    await onDecide(approval.id, {
      status: "approved",
      finalContent: { estimated_value: editedValue },
      userEdits: { value_changed: true, original: d.estimated_value, corrected: editedValue },
      userComment: `Corrected from ${fmtUsd(d.estimated_value)} to ${fmtUsd(editedValue)}`,
    });
    setDecided("approved");
    setBusy(false);
  };

  const handleDeny = async () => {
    if (!denyReason.trim()) return;
    setBusy(true);
    await onDecide(approval.id, {
      status: "rejected",
      userComment: denyReason.trim(),
      finalContent: {
        original_estimate: d.estimated_value,
        corrected_value: editedValue !== d.estimated_value ? editedValue : undefined,
        company: d.company,
        math: d.math,
        data_sources: d.data_sources,
      },
    });
    setDecided("denied");
    setBusy(false);
  };

  if (decided) {
    return (
      <div className="px-3 py-2 rounded-lg bg-white/[0.02] border border-jarvis-border/30 flex items-center gap-2">
        <Check size={12} className={decided === "approved" ? "text-green-400" : "text-jarvis-primary"} />
        <span className="text-[10px] text-jarvis-muted">
          {d.company} — {decided === "approved" ? `${fmtUsd(editedValue !== d.estimated_value ? editedValue : d.estimated_value)} saved` : "denied, Jarvis will learn"}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-jarvis-border/40 overflow-hidden bg-white/[0.015]">
      {/* ── Collapsed row ──────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.03] transition"
      >
        <DollarSign size={12} className="text-jarvis-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-jarvis-ink truncate">{d.company || "Unknown"}</span>
            <span className="text-[9px] text-jarvis-muted">{d.stage}</span>
          </div>
        </div>
        <span className="text-[12px] font-bold text-jarvis-success tabular-nums shrink-0">{fmtUsd(d.estimated_value)}</span>
        <span className={`text-[9px] font-medium tabular-nums shrink-0 ${confColor}`}>{confPct}%</span>
        {expanded ? <ChevronDown size={12} className="text-jarvis-muted shrink-0" /> : <ChevronRight size={12} className="text-jarvis-muted shrink-0" />}
      </button>

      {/* ── Expanded detail ────────────────────────────────────── */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-jarvis-border/20 pt-3">
          {/* Data Sources */}
          <div>
            <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold">Data Sources</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {(d.data_sources || []).map(src => {
                const m = DATA_SOURCE_META[src] || { icon: Database, label: src };
                const SrcIcon = m.icon;
                return (
                  <span key={src} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-jarvis-primary/10 border border-jarvis-primary/20 text-[7px] text-jarvis-primary font-medium">
                    <SrcIcon size={7} />
                    {m.label}
                  </span>
                );
              })}
              {(!d.data_sources || d.data_sources.length === 0) && (
                <span className="text-[8px] text-jarvis-muted">Company name only</span>
              )}
            </div>
          </div>

          {/* Math Breakdown */}
          <div>
            <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold">Pricing Breakdown</span>
            <div className="mt-1 rounded bg-white/[0.03] border border-white/5 overflow-hidden">
              {math.length > 0 ? (
                <>
                  {math.map((m, i) => (
                    <div key={i} className="flex items-start justify-between px-2.5 py-1.5 border-b border-white/5 last:border-b-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] text-jarvis-ink font-medium">{m.line}</div>
                        <div className="text-[8px] text-jarvis-muted font-mono">{m.calc}</div>
                      </div>
                      <span className="text-[9px] text-jarvis-ink font-semibold tabular-nums shrink-0 ml-2">{fmtUsd(m.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/[0.03] border-t border-white/8">
                    <span className="text-[9px] text-jarvis-ink font-semibold">Total (Annual)</span>
                    <span className="text-[11px] text-jarvis-success font-bold tabular-nums">{fmtUsd(mathTotal)}</span>
                  </div>
                </>
              ) : (
                <div className="px-2.5 py-2 text-[8px] text-jarvis-muted">General 3PL benchmark estimate — no line-item data</div>
              )}
            </div>
          </div>

          {/* Confidence */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold">Confidence</span>
              <span className={`text-[10px] font-bold tabular-nums ${confColor}`}>{confPct}%</span>
            </div>
            <div className="w-full h-1 rounded-full bg-white/10 mt-1">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${confPct}%` }} />
            </div>
            {d.confidence_why && <p className="text-[8px] text-jarvis-muted mt-1 leading-relaxed">{d.confidence_why}</p>}
          </div>

          {/* Assumptions */}
          {d.assumptions && (
            <div>
              <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold">Assumptions</span>
              <p className="text-[9px] text-jarvis-body mt-0.5 leading-relaxed">{d.assumptions}</p>
            </div>
          )}

          {/* Inline edit */}
          <div>
            <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold">Your Value</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[12px] text-jarvis-muted">$</span>
              <input
                type="number"
                value={editedValue}
                onChange={e => setEditedValue(Number(e.target.value))}
                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[13px] text-jarvis-ink font-bold tabular-nums focus:outline-none focus:border-jarvis-accent/50"
              />
              {editedValue !== d.estimated_value && (
                <span className="text-[8px] text-jarvis-warning shrink-0">
                  {editedValue > d.estimated_value ? "+" : ""}{fmtUsd(editedValue - d.estimated_value)}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          {denyMode ? (
            <div className="space-y-2">
              <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold block">Why is this wrong?</span>
              <textarea
                autoFocus
                value={denyReason}
                onChange={e => setDenyReason(e.target.value)}
                placeholder="Value too high — they only ship 50 orders/month. Real value closer to $30K."
                rows={2}
                className="w-full bg-white/5 border border-red-800/40 rounded px-2 py-1.5 text-[10px] text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-red-600/60 resize-none"
              />
              <div className="flex items-center gap-2">
                <button onClick={() => { setDenyMode(false); setDenyReason(""); }} className="text-[9px] text-jarvis-muted hover:text-jarvis-ink transition">
                  Back
                </button>
                <button
                  onClick={handleDeny}
                  disabled={!denyReason.trim() || busy}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-medium bg-red-900/40 text-red-400 hover:bg-red-900/60 border border-red-800/50 transition disabled:opacity-40 ml-auto"
                >
                  {busy ? <Loader2 size={9} className="animate-spin" /> : <ThumbsDown size={9} />}
                  Deny & Teach
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleApprove}
                disabled={busy}
                className="px-2.5 py-1 rounded text-[9px] font-medium bg-green-900/40 text-green-400 hover:bg-green-900/60 border border-green-800/50 transition disabled:opacity-40"
              >
                {busy ? <Loader2 size={9} className="animate-spin" /> : null}
                Approve {fmtUsd(d.estimated_value)}
              </button>
              {editedValue !== d.estimated_value && (
                <button
                  onClick={handleEditApprove}
                  disabled={busy}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-medium bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 transition disabled:opacity-40"
                >
                  <Pencil size={9} />
                  Save {fmtUsd(editedValue)}
                </button>
              )}
              <button
                onClick={() => setDenyMode(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-medium bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/40 transition ml-auto"
              >
                <ThumbsDown size={9} />
                Deny
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main queue component ─────────────────────────────────────────────────────

export function ApprovalQueue({ leadId, dealId }) {
  const { approvals, pending, loading, decideApproval, refresh } = useApprovalsSupa({ leadId, dealId });
  const [selected, setSelected] = useState(null);

  const valueEstimates = pending.filter(a => a.type === "deal_value_estimate");
  const otherPending = pending.filter(a => a.type !== "deal_value_estimate");
  const recent = approvals.filter(a => a.status !== "pending").slice(0, 10);

  async function handleDecide(id, payload) {
    await decideApproval(id, payload);
    setSelected(null);
    refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20 text-[10px] text-jarvis-muted">
        Loading approvals…
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Value Estimates — inline expandable cards */}
        {valueEstimates.length > 0 && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5 px-1">
              Value Estimates<span className="ml-1.5 text-jarvis-accent">{valueEstimates.length}</span>
            </h3>
            <div className="space-y-1.5">
              {valueEstimates.map(a => (
                <ValueEstimateCard key={a.id} approval={a} onDecide={handleDecide} />
              ))}
            </div>
          </section>
        )}

        {/* Other Pending */}
        {otherPending.length > 0 && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5 px-1">
              Pending{otherPending.length > 0 && <span className="ml-1.5 text-jarvis-accent">{otherPending.length}</span>}
            </h3>
            <ul className="space-y-1">
              {otherPending.map(a => (
                <li
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="flex items-start gap-2 px-2 py-2 rounded cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <TypeIcon type={a.type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-jarvis-text">
                        {TYPE_META[a.type]?.label ?? a.type}
                      </span>
                      {a.source_agent && (
                        <span className="text-[9px] text-jarvis-muted truncate">· {a.source_agent}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-jarvis-muted truncate leading-tight mt-0.5">
                      {preview(a)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-[9px] text-jarvis-muted">
                    <Clock size={10} />
                    {relativeTime(a.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Empty state */}
        {pending.length === 0 && (
          <p className="text-[10px] text-jarvis-muted px-1">No pending approvals.</p>
        )}

        {/* Recent Decisions */}
        {recent.length > 0 && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5 px-1">
              Recent Decisions
            </h3>
            <ul className="space-y-0.5 opacity-60">
              {recent.map(a => (
                <li key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded">
                  <TypeIcon type={a.type} />
                  <span className="text-[10px] text-jarvis-muted flex-1 truncate">
                    {TYPE_META[a.type]?.label ?? a.type} — {preview(a)}
                  </span>
                  <StatusBadge status={a.status} />
                  <span className="text-[9px] text-jarvis-muted shrink-0">
                    {relativeTime(a.decided_at || a.updated_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Modal for non-value-estimate approvals */}
      {selected && (
        <ApprovalReview
          approval={selected}
          onDecide={(payload) => handleDecide(selected.id, payload)}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
