import { useState } from "react";
import { X, Mail, FileText, GitBranch, Clock, Check, DollarSign, Database, FileSearch, MailOpen, StickyNote, Pencil } from "lucide-react";

const TYPE_META = {
  email:               { icon: Mail,       label: "Email" },
  proposal:            { icon: FileText,   label: "Proposal" },
  stage_change:        { icon: GitBranch,  label: "Stage Change" },
  deal_value_estimate: { icon: DollarSign, label: "Value Estimate" },
};

const DATA_SOURCE_META = {
  deal_notes:     { icon: StickyNote, label: "Deal Notes" },
  activities:     { icon: Clock,      label: "Activities" },
  contact_email:  { icon: MailOpen,   label: "Contact Email" },
  company_name:   { icon: FileSearch, label: "Company Name" },
  research:       { icon: Database,   label: "Research Packet" },
  emails:         { icon: Mail,       label: "Email History" },
  website:        { icon: FileSearch, label: "Website Data" },
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

function computeUserEdits(original, editedSubject, editedBody) {
  const origSubject = original?.subject ?? "";
  const origBody    = original?.body    ?? "";
  const subjectChanged = editedSubject !== origSubject;
  const bodyChanged    = editedBody    !== origBody;
  const origLen = origBody.length || 1;
  const editLen = editedBody.length;
  const ratio   = editLen / origLen;
  const toneChanged   = ratio < 0.8 || ratio > 1.2;
  const lengthChanged = Math.abs(editLen - origLen) / origLen > 0.2;
  return { subject_changed: subjectChanged, body_changed: bodyChanged, tone_changed: toneChanged, length_changed: lengthChanged };
}

function fmtUsd(n) {
  return `$${Number(n || 0).toLocaleString()}`;
}

// ── Confidence bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ pct, why }) {
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  const textColor = pct >= 70 ? "text-green-400" : pct >= 40 ? "text-amber-400" : "text-red-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-jarvis-muted uppercase tracking-wider">Confidence</span>
        <span className={`text-[11px] font-semibold tabular-nums ${textColor}`}>{pct}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {why && <p className="text-[9px] text-jarvis-muted leading-relaxed">{why}</p>}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ApprovalReview({ approval, onDecide, onClose }) {
  const draft = approval?.draft_content ?? {};
  const meta  = TYPE_META[approval?.type] || { icon: FileText, label: approval?.type };
  const Icon  = meta.icon;

  const isValueEstimate = approval?.type === "deal_value_estimate";
  const [editedSubject, setEditedSubject] = useState(draft.subject ?? "");
  const [editedBody,    setEditedBody]    = useState(draft.body    ?? "");
  const [editedValue,   setEditedValue]   = useState(draft.estimated_value ?? 0);
  const [comment,       setComment]       = useState("");
  const [denyMode,      setDenyMode]      = useState(false);
  const [denyReason,    setDenyReason]    = useState("");
  const [denied,        setDenied]        = useState(false);

  function handleApprove() {
    if (isValueEstimate) {
      onDecide({
        status:       "approved",
        finalContent: { estimated_value: draft.estimated_value },
        userComment:  comment || undefined,
      });
      return;
    }
    const userEdits = computeUserEdits(draft, editedSubject, editedBody);
    onDecide({
      status:       "approved",
      finalContent: { subject: editedSubject, body: editedBody },
      userEdits,
      userComment:  comment || undefined,
    });
  }

  function handleEditApprove() {
    onDecide({
      status:       "approved",
      finalContent: { estimated_value: editedValue },
      userEdits:    { value_changed: true, original: draft.estimated_value, corrected: editedValue },
      userComment:  comment || `Corrected from ${fmtUsd(draft.estimated_value)} to ${fmtUsd(editedValue)}`,
    });
  }

  function handleReject() {
    if (!denyReason.trim()) return;
    onDecide({
      status:      "rejected",
      userComment: denyReason.trim(),
      finalContent: isValueEstimate ? {
        original_estimate: draft.estimated_value,
        corrected_value: editedValue !== draft.estimated_value ? editedValue : undefined,
        company: draft.company,
        math: draft.math,
        data_sources: draft.data_sources,
      } : undefined,
    });
    setDenied(true);
  }

  // Compute math total from lines
  const mathLines = draft.math || [];
  const mathTotal = mathLines.reduce((s, m) => s + (Number(m.amount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg bg-jarvis-panel border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0">
          <Icon size={14} className="text-jarvis-accent" />
          <span className="text-[11px] font-semibold text-jarvis-text">{meta.label}</span>
          {approval?.source_agent && (
            <span className="text-[10px] text-jarvis-muted">· {approval.source_agent}</span>
          )}
          <div className="ml-auto flex items-center gap-1 text-[9px] text-jarvis-muted">
            <Clock size={10} />
            {relativeTime(approval?.created_at)}
          </div>
          <button
            onClick={onClose}
            className="ml-2 p-1 rounded hover:bg-white/10 text-jarvis-muted hover:text-jarvis-text transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-[11px]">

          {isValueEstimate ? (
            <>
              {/* ── Company + Value Header ─────────────────────────── */}
              <div className="rounded-lg bg-white/5 border border-white/8 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[13px] font-semibold text-jarvis-text">{draft.company}</div>
                    <div className="text-[9px] text-jarvis-muted">{draft.stage} · {draft.contact || "no contact"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[18px] font-bold text-jarvis-success tabular-nums">{fmtUsd(draft.estimated_value)}</div>
                    <div className="text-[8px] text-jarvis-muted uppercase">Annual Estimate</div>
                  </div>
                </div>
                <ConfidenceBar pct={draft.confidence_pct ?? 50} why={draft.confidence_why} />
              </div>

              {/* ── Data Sources Used ──────────────────────────────── */}
              <section>
                <h4 className="text-[9px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5">
                  Data Sources Used
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(draft.data_sources || []).map(src => {
                    const m = DATA_SOURCE_META[src] || { icon: Database, label: src };
                    const SrcIcon = m.icon;
                    return (
                      <span key={src} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-jarvis-primary/10 border border-jarvis-primary/20 text-[8px] text-jarvis-primary font-medium">
                        <SrcIcon size={8} />
                        {m.label}
                      </span>
                    );
                  })}
                  {(!draft.data_sources || draft.data_sources.length === 0) && (
                    <span className="text-[9px] text-jarvis-muted">No structured data — estimated from company name only</span>
                  )}
                </div>
              </section>

              {/* ── Math Breakdown ─────────────────────────────────── */}
              <section>
                <h4 className="text-[9px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5">
                  Pricing Breakdown
                </h4>
                <div className="rounded-lg bg-white/[0.03] border border-white/8 overflow-hidden">
                  {mathLines.length > 0 ? (
                    <>
                      {mathLines.map((m, i) => (
                        <div key={i} className="flex items-start justify-between px-3 py-2 border-b border-white/5 last:border-b-0">
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] text-jarvis-text font-medium">{m.line}</div>
                            <div className="text-[9px] text-jarvis-muted font-mono">{m.calc}</div>
                          </div>
                          <span className="text-[10px] text-jarvis-text font-semibold tabular-nums shrink-0 ml-3">
                            {fmtUsd(m.amount)}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03] border-t border-white/10">
                        <span className="text-[10px] text-jarvis-text font-semibold">Total (Annual)</span>
                        <span className="text-[12px] text-jarvis-success font-bold tabular-nums">{fmtUsd(mathTotal)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="px-3 py-3 text-[9px] text-jarvis-muted">
                      No line-item math available — estimate based on general 3PL benchmarks
                    </div>
                  )}
                </div>
              </section>

              {/* ── Assumptions ────────────────────────────────────── */}
              {draft.assumptions && (
                <section>
                  <h4 className="text-[9px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1">
                    Key Assumptions
                  </h4>
                  <p className="text-[10px] text-jarvis-body leading-relaxed">{draft.assumptions}</p>
                </section>
              )}

              {/* ── Inline Edit ────────────────────────────────────── */}
              <section>
                <h4 className="text-[9px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5">
                  Your Value
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] text-jarvis-muted">$</span>
                  <input
                    type="number"
                    value={editedValue}
                    onChange={e => setEditedValue(Number(e.target.value))}
                    className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-[16px] text-jarvis-text font-bold tabular-nums focus:outline-none focus:border-jarvis-accent/50"
                  />
                  {editedValue !== draft.estimated_value && (
                    <span className="text-[9px] text-jarvis-warning shrink-0">
                      {editedValue > draft.estimated_value ? "+" : ""}{fmtUsd(editedValue - draft.estimated_value)}
                    </span>
                  )}
                </div>
              </section>
            </>
          ) : (
            /* ── Email / Proposal view ────────────────────────────── */
            <>
              <section>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5">
                  Original Draft
                </h4>
                <div className="rounded-lg bg-white/5 border border-white/8 p-3 space-y-2">
                  {draft.subject !== undefined && (
                    <div>
                      <span className="text-[9px] text-jarvis-muted uppercase tracking-wider">Subject</span>
                      <p className="text-[11px] text-jarvis-text mt-0.5">{draft.subject || <em className="text-jarvis-muted">(empty)</em>}</p>
                    </div>
                  )}
                  {draft.body !== undefined && (
                    <div>
                      <span className="text-[9px] text-jarvis-muted uppercase tracking-wider">Body</span>
                      <p className="text-[11px] text-jarvis-text mt-0.5 whitespace-pre-wrap leading-relaxed">
                        {draft.body || <em className="text-jarvis-muted">(empty)</em>}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5">
                  Your Version
                </h4>
                <div className="space-y-2">
                  {draft.subject !== undefined && (
                    <div>
                      <label className="text-[9px] text-jarvis-muted uppercase tracking-wider block mb-1">Subject</label>
                      <input
                        type="text"
                        value={editedSubject}
                        onChange={e => setEditedSubject(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-jarvis-text placeholder-jarvis-muted focus:outline-none focus:border-jarvis-accent/50"
                      />
                    </div>
                  )}
                  {draft.body !== undefined && (
                    <div>
                      <label className="text-[9px] text-jarvis-muted uppercase tracking-wider block mb-1">Body</label>
                      <textarea
                        value={editedBody}
                        onChange={e => setEditedBody(e.target.value)}
                        rows={6}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-jarvis-text placeholder-jarvis-muted focus:outline-none focus:border-jarvis-accent/50 resize-none leading-relaxed"
                      />
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5">
                  Comment <span className="normal-case font-normal">(optional)</span>
                </h4>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Why are you changing this?"
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-jarvis-text placeholder-jarvis-muted focus:outline-none focus:border-jarvis-accent/50 resize-none"
                />
              </section>
            </>
          )}
        </div>

        {/* ── Action Buttons / Deny Flow ───────────────────────────── */}
        <div className="px-4 py-3 border-t border-white/10 shrink-0">
          {denied ? (
            <div className="flex items-center gap-2">
              <Check size={14} className="text-jarvis-primary" />
              <span className="text-[11px] text-jarvis-primary font-medium">
                Got it, I'll learn from this
              </span>
            </div>
          ) : denyMode ? (
            <div className="space-y-2">
              <label className="text-[9px] text-jarvis-muted uppercase tracking-wider block">
                Why is this estimate wrong?
              </label>
              <textarea
                autoFocus
                value={denyReason}
                onChange={e => setDenyReason(e.target.value)}
                placeholder="Value too high — they only ship 50 orders/month, not 1000. Real value closer to $30K."
                rows={3}
                className="w-full bg-white/5 border border-red-800/40 rounded px-2 py-1.5 text-[11px] text-jarvis-text placeholder-jarvis-muted focus:outline-none focus:border-red-600/60 resize-none"
              />
              {isValueEstimate && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-jarvis-muted">Correct value (optional): $</span>
                  <input
                    type="number"
                    value={editedValue}
                    onChange={e => setEditedValue(Number(e.target.value))}
                    className="w-28 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-jarvis-text tabular-nums focus:outline-none focus:border-jarvis-accent/50"
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => { setDenyMode(false); setDenyReason(""); }}
                  className="px-3 py-1.5 rounded text-[11px] text-jarvis-muted hover:text-jarvis-text hover:bg-white/5 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleReject}
                  disabled={!denyReason.trim()}
                  className="px-3 py-1.5 rounded text-[11px] font-medium bg-red-900/40 text-red-400 hover:bg-red-900/60 border border-red-800/50 transition-colors disabled:opacity-40"
                >
                  Deny & Teach
                </button>
              </div>
            </div>
          ) : isValueEstimate ? (
            /* ── Three value estimate buttons ──────────────────────── */
            <div className="flex items-center gap-2">
              <button
                onClick={handleApprove}
                className="px-3 py-1.5 rounded text-[10px] font-medium bg-green-900/40 text-green-400 hover:bg-green-900/60 border border-green-800/50 transition-colors"
              >
                Approve {fmtUsd(draft.estimated_value)}
              </button>
              {editedValue !== draft.estimated_value && (
                <button
                  onClick={handleEditApprove}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-medium bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 transition-colors"
                >
                  <Pencil size={10} />
                  Save {fmtUsd(editedValue)}
                </button>
              )}
              <button
                onClick={() => setDenyMode(true)}
                className="px-3 py-1.5 rounded text-[10px] font-medium bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/40 transition-colors ml-auto"
              >
                Deny + Why
              </button>
            </div>
          ) : (
            /* ── Standard approve/deny ─────────────────────────────── */
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded text-[11px] text-jarvis-muted hover:text-jarvis-text hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setDenyMode(true)}
                className="px-3 py-1.5 rounded text-[11px] font-medium bg-red-900/40 text-red-400 hover:bg-red-900/60 border border-red-800/50 transition-colors"
              >
                Deny
              </button>
              <button
                onClick={handleApprove}
                className="px-3 py-1.5 rounded text-[11px] font-medium bg-green-900/40 text-green-400 hover:bg-green-900/60 border border-green-800/50 transition-colors"
              >
                Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
