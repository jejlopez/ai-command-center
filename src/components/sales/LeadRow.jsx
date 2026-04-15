// Single row in the leads table — badges, score, NBA.

const NBA_COLORS = {
  call_now: "border-jarvis-danger text-jarvis-danger",
  send_email: "border-jarvis-primary text-jarvis-primary",
  follow_up: "border-jarvis-warning text-jarvis-warning",
  wait: "border-blue-400 text-blue-400",
  research: "border-jarvis-purple text-jarvis-purple",
  wait_research: "border-jarvis-purple text-jarvis-purple",
  prep_call: "border-jarvis-success text-jarvis-success",
  convert: "border-cyan-400 text-cyan-400",
  draft_proposal: "border-jarvis-success text-jarvis-success",
  nurture_or_close: "border-jarvis-ghost text-jarvis-muted",
  review: "border-jarvis-ghost text-jarvis-muted",
  rescue: "border-jarvis-danger text-jarvis-danger",
};

const NBA_LABELS = {
  call_now: "CALL NOW", send_email: "SEND EMAIL", follow_up: "FOLLOW UP",
  wait: "WAIT", research: "RESEARCHING", wait_research: "RESEARCHING",
  prep_call: "PREP FOR CALL", convert: "CONVERT", draft_proposal: "DRAFT PROPOSAL",
  nurture_or_close: "NURTURE / CLOSE", review: "REVIEW", rescue: "RESCUE",
};

export function LeadRow({ lead, onClick }) {
  const contact = lead.contacts || {};
  const nba = lead.next_best_action || {};
  const nbaStyle = NBA_COLORS[nba.action] || NBA_COLORS.review;
  const scoreColor = (lead.lead_score || 0) >= 70 ? "text-jarvis-success"
    : (lead.lead_score || 0) >= 40 ? "text-jarvis-warning" : "text-jarvis-muted";

  return (
    <div
      className={`grid grid-cols-[2fr_0.8fr_0.6fr_0.6fr_0.6fr_1fr_1.2fr] gap-1 px-5 py-2.5 border-b border-jarvis-border/20 items-center cursor-pointer transition hover:bg-jarvis-surface-hover ${lead.attention === "hot" ? "bg-jarvis-danger/[0.02]" : ""}`}
      onClick={() => onClick?.(lead)}
    >
      {/* Company + Contact */}
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-jarvis-ink truncate">{lead.company}</div>
        <div className="text-[10px] text-jarvis-muted truncate">
          {contact.name || "—"}{contact.email ? ` · ${contact.email}` : ""}
        </div>
      </div>

      {/* Quality */}
      <div>
        {lead.quality && (
          <span className={`text-[8px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
            lead.quality === "whale"
              ? "bg-gradient-to-r from-green-400 to-cyan-400 text-slate-900"
              : lead.quality === "excellent" ? "bg-jarvis-success text-jarvis-bg"
              : lead.quality === "strong" ? "bg-jarvis-success/15 text-jarvis-success"
              : lead.quality === "medium" ? "bg-jarvis-warning/15 text-jarvis-warning"
              : "bg-white/5 text-jarvis-muted"
          }`}>
            {lead.quality === "whale" ? "🐋 WHALE" : lead.quality}
          </span>
        )}
      </div>

      {/* Attention */}
      <div>
        {lead.attention && (
          <span className={`text-[8px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
            lead.attention === "hot" ? "bg-jarvis-danger text-white"
            : lead.attention === "warm" ? "bg-jarvis-warning/15 text-jarvis-warning"
            : lead.attention === "stale" ? "bg-white/5 text-jarvis-muted"
            : lead.attention === "at_risk" ? "bg-jarvis-danger/12 text-jarvis-danger"
            : "bg-jarvis-danger/20 text-jarvis-danger"
          }`}>
            {lead.attention === "hot" ? "🔥 HOT" : lead.attention === "at_risk" ? "⚠ At Risk" : lead.attention}
          </span>
        )}
      </div>

      {/* Strike */}
      <div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
          lead.strike_count >= 4 ? "bg-jarvis-danger/15 text-jarvis-danger"
          : lead.strike_count >= 2 ? "bg-jarvis-warning/15 text-jarvis-warning"
          : "bg-blue-500/10 text-blue-400"
        }`}>
          S{lead.strike_count || 0}
        </span>
      </div>

      {/* Score */}
      <div className={`text-sm font-bold tabular-nums ${scoreColor}`}>
        {lead.lead_score ?? "—"}
      </div>

      {/* Status */}
      <div>
        <span className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-jarvis-muted">
          {(lead.status || "new").replace(/_/g, " ")}
        </span>
      </div>

      {/* NBA */}
      <div className={`border-l-2 pl-2 ${nbaStyle}`}>
        <div className="text-[10px] font-semibold">{NBA_LABELS[nba.action] || "—"}</div>
        <div className="text-[9px] text-jarvis-ghost truncate">{nba.reason || ""}</div>
      </div>
    </div>
  );
}
