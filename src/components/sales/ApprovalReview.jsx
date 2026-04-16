import { useState } from "react";
import { X, Mail, FileText, GitBranch, Clock, Check, DollarSign } from "lucide-react";

const TYPE_META = {
  email:               { icon: Mail,       label: "Email" },
  proposal:            { icon: FileText,   label: "Proposal" },
  stage_change:        { icon: GitBranch,  label: "Stage Change" },
  deal_value_estimate: { icon: DollarSign, label: "Value Estimate" },
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
        finalContent: { estimated_value: editedValue },
        userEdits:    editedValue !== draft.estimated_value ? { value_changed: true } : undefined,
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

  function handleReject() {
    if (!denyReason.trim()) return;
    onDecide({
      status:      "rejected",
      userComment: denyReason.trim(),
    });
    setDenied(true);
  }

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
            /* ── Deal Value Estimate view ─────────────────────────── */
            <>
              <section>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5">
                  Value Estimate — {draft.company}
                </h4>
                <div className="rounded-lg bg-white/5 border border-white/8 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-jarvis-muted uppercase tracking-wider">Estimated Annual Value</span>
                    <span className="text-[16px] font-semibold text-jarvis-success tabular-nums">
                      ${(draft.estimated_value ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-jarvis-muted uppercase tracking-wider">Confidence</span>
                    <span className={`text-[11px] font-medium ${
                      draft.confidence === "high" ? "text-jarvis-success" :
                      draft.confidence === "medium" ? "text-jarvis-warning" :
                      "text-jarvis-muted"
                    }`}>{draft.confidence}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-jarvis-muted uppercase tracking-wider block mb-1">Reasoning</span>
                    <p className="text-[11px] text-jarvis-text leading-relaxed">{draft.reasoning}</p>
                  </div>
                  {draft.stage && (
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-jarvis-muted uppercase tracking-wider">Stage</span>
                      <span className="text-[11px] text-jarvis-text">{draft.stage}</span>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5">
                  Adjust Value
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-jarvis-muted">$</span>
                  <input
                    type="number"
                    value={editedValue}
                    onChange={e => setEditedValue(Number(e.target.value))}
                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[14px] text-jarvis-text font-semibold tabular-nums focus:outline-none focus:border-jarvis-accent/50"
                  />
                </div>
              </section>
            </>
          ) : (
            /* ── Email / Proposal view ────────────────────────────── */
            <>
              {/* Original Draft */}
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

              {/* Your Version */}
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
            </>
          )}

          {/* Comment */}
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
        </div>

        {/* Action Buttons / Deny Flow */}
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
                Why are you denying this?
              </label>
              <textarea
                autoFocus
                value={denyReason}
                onChange={e => setDenyReason(e.target.value)}
                placeholder="Too aggressive, wrong tone, inaccurate info…"
                rows={2}
                className="w-full bg-white/5 border border-red-800/40 rounded px-2 py-1.5 text-[11px] text-jarvis-text placeholder-jarvis-muted focus:outline-none focus:border-red-600/60 resize-none"
              />
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
          ) : (
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
