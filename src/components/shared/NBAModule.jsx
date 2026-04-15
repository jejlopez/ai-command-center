const ACTION_STYLES = {
  call_now: { color: "text-jarvis-danger", border: "border-jarvis-danger", bg: "bg-jarvis-danger/8", label: "CALL NOW" },
  send_email: { color: "text-jarvis-primary", border: "border-jarvis-primary", bg: "bg-jarvis-primary/8", label: "SEND EMAIL" },
  follow_up: { color: "text-jarvis-warning", border: "border-jarvis-warning", bg: "bg-jarvis-warning/8", label: "SEND FOLLOW-UP" },
  wait: { color: "text-blue-400", border: "border-blue-400", bg: "bg-blue-400/8", label: "WAIT" },
  research: { color: "text-jarvis-purple", border: "border-jarvis-purple", bg: "bg-jarvis-purple/8", label: "RESEARCH IN PROGRESS" },
  wait_research: { color: "text-jarvis-purple", border: "border-jarvis-purple", bg: "bg-jarvis-purple/8", label: "RESEARCH IN PROGRESS" },
  prep_call: { color: "text-jarvis-success", border: "border-jarvis-success", bg: "bg-jarvis-success/8", label: "PREP FOR CALL" },
  convert: { color: "text-cyan-400", border: "border-cyan-400", bg: "bg-cyan-400/8", label: "CONVERT TO DEAL" },
  draft_proposal: { color: "text-jarvis-success", border: "border-jarvis-success", bg: "bg-jarvis-success/8", label: "DRAFT PROPOSAL" },
  rescue: { color: "text-jarvis-danger", border: "border-jarvis-danger", bg: "bg-jarvis-danger/8", label: "RESCUE DEAL" },
  nurture_or_close: { color: "text-jarvis-muted", border: "border-jarvis-ghost", bg: "bg-white/3", label: "MOVE TO NURTURE" },
  review: { color: "text-jarvis-muted", border: "border-jarvis-ghost", bg: "bg-white/3", label: "REVIEW" },
};

export function NBAModule({ nba, contact, onAction }) {
  if (!nba) return null;
  const style = ACTION_STYLES[nba.action] || ACTION_STYLES.review;

  return (
    <div className={`${style.bg} border-l-[3px] ${style.border} px-3 py-2.5 rounded-r-lg`}>
      <div className={`text-xs font-bold ${style.color}`}>{style.label}</div>
      <div className="text-[10px] text-jarvis-muted mt-0.5">{nba.reason}</div>
      <div className="flex gap-2 mt-2">
        {(nba.action === "call_now" || nba.action === "prep_call") && contact?.phone && (
          <button onClick={() => onAction?.("call", contact)} className="text-[9px] bg-jarvis-danger/15 text-jarvis-danger px-2.5 py-1 rounded-md font-semibold">
            📞 Call {contact.phone}
          </button>
        )}
        {(nba.action === "send_email" || nba.action === "follow_up") && (
          <button onClick={() => onAction?.("email")} className="text-[9px] bg-jarvis-primary/15 text-jarvis-primary px-2.5 py-1 rounded-md font-semibold">
            ✉ Draft Email
          </button>
        )}
        {nba.action === "convert" && (
          <button onClick={() => onAction?.("convert")} className="text-[9px] bg-cyan-400/15 text-cyan-400 px-2.5 py-1 rounded-md font-semibold">
            → Convert to Deal
          </button>
        )}
        <button onClick={() => onAction?.("snooze")} className="text-[9px] bg-white/5 text-jarvis-muted px-2.5 py-1 rounded-md">
          ⏸ Snooze
        </button>
      </div>
    </div>
  );
}
