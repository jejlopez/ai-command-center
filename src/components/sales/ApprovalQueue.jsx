import { useState } from "react";
import { Mail, FileText, GitBranch, Clock } from "lucide-react";
import { useApprovalsSupa } from "../../hooks/useApprovalsSupa.js";
import ApprovalReview from "./ApprovalReview.jsx";

const TYPE_META = {
  email:        { icon: Mail,       label: "Email" },
  proposal:     { icon: FileText,   label: "Proposal" },
  stage_change: { icon: GitBranch,  label: "Stage Change" },
};

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function preview(draft) {
  if (!draft) return "—";
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

export function ApprovalQueue({ leadId, dealId }) {
  const { approvals, pending, loading, decideApproval, refresh } = useApprovalsSupa({ leadId, dealId });
  const [selected, setSelected] = useState(null);

  const recent = approvals
    .filter(a => a.status !== "pending")
    .slice(0, 10);

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
        {/* Pending */}
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5 px-1">
            Pending{pending.length > 0 && <span className="ml-1.5 text-jarvis-accent">{pending.length}</span>}
          </h3>

          {pending.length === 0 ? (
            <p className="text-[10px] text-jarvis-muted px-1">No pending approvals.</p>
          ) : (
            <ul className="space-y-1">
              {pending.map(a => (
                <li
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className="flex items-start gap-2 px-2 py-2 rounded cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <TypeIcon type={a.approval_type} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-jarvis-text">
                        {TYPE_META[a.approval_type]?.label ?? a.approval_type}
                      </span>
                      {a.source_agent && (
                        <span className="text-[9px] text-jarvis-muted truncate">· {a.source_agent}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-jarvis-muted truncate leading-tight mt-0.5">
                      {preview(a.draft_content)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-[9px] text-jarvis-muted">
                    <Clock size={10} />
                    {relativeTime(a.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent Decisions */}
        {recent.length > 0 && (
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-jarvis-muted mb-1.5 px-1">
              Recent Decisions
            </h3>
            <ul className="space-y-0.5 opacity-60">
              {recent.map(a => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded"
                >
                  <TypeIcon type={a.approval_type} />
                  <span className="text-[10px] text-jarvis-muted flex-1 truncate">
                    {TYPE_META[a.approval_type]?.label ?? a.approval_type}
                    {" — "}
                    {preview(a.draft_content)}
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
