import { useState } from "react";
import { X, Mail, FileText, GitBranch, Clock } from "lucide-react";

const TYPE_META = {
  email:        { icon: Mail,      label: "Email" },
  proposal:     { icon: FileText,  label: "Proposal" },
  stage_change: { icon: GitBranch, label: "Stage Change" },
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
  const meta  = TYPE_META[approval?.approval_type] || { icon: FileText, label: approval?.approval_type };
  const Icon  = meta.icon;

  const [editedSubject, setEditedSubject] = useState(draft.subject ?? "");
  const [editedBody,    setEditedBody]    = useState(draft.body    ?? "");
  const [comment,       setComment]       = useState("");

  function handleApprove() {
    const userEdits = computeUserEdits(draft, editedSubject, editedBody);
    onDecide({
      status:       "approved",
      finalContent: { subject: editedSubject, body: editedBody },
      userEdits,
      userComment:  comment || undefined,
    });
  }

  function handleReject() {
    onDecide({
      status:      "rejected",
      userComment: comment || undefined,
    });
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

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-[11px] text-jarvis-muted hover:text-jarvis-text hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReject}
            className="px-3 py-1.5 rounded text-[11px] font-medium bg-red-900/40 text-red-400 hover:bg-red-900/60 border border-red-800/50 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={handleApprove}
            className="px-3 py-1.5 rounded text-[11px] font-medium bg-green-900/40 text-green-400 hover:bg-green-900/60 border border-green-800/50 transition-colors"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
