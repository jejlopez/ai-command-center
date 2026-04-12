import { Trophy, XCircle } from "lucide-react";

const REASON_STYLE = {
  price:      "bg-jarvis-warning/15 text-jarvis-warning",
  timing:     "bg-blue-500/15 text-blue-400",
  service:    "bg-jarvis-primary/15 text-jarvis-primary",
  competitor: "bg-jarvis-purple/15 text-jarvis-purple",
  other:      "bg-jarvis-ghost text-jarvis-muted",
};

const fmtUsd = (n) => n == null ? "—" : `$${Number(n).toLocaleString()}`;
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

export function WinLossJournal({ deals = [] }) {
  const closed = deals
    .filter(d => d.stage === "closed_won" || d.stage === "closed_lost")
    .slice(0, 6);

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Trophy size={13} className="text-jarvis-muted" />
        <span className="label">Win / Loss Journal</span>
      </div>

      {closed.length === 0 && (
        <p className="text-xs text-jarvis-ghost py-2">No closed deals yet.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {closed.map((d) => {
          const won = d.stage === "closed_won";
          return (
            <div key={d.id} className="flex items-start gap-2 py-1.5 border-b border-jarvis-border/50 last:border-0">
              <div className="mt-0.5 shrink-0">
                {won
                  ? <Trophy size={11} className="text-jarvis-success" />
                  : <XCircle size={11} className="text-jarvis-danger" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-jarvis-ink font-medium truncate">{d.company || d.name || "Unnamed"}</div>
                <div className="text-[10px] text-jarvis-muted mt-0.5">{fmtDate(d.updated_at)} · {fmtUsd(d.value)}</div>
              </div>
              {!won && d.loss_reason && (
                <span className={`chip shrink-0 ${REASON_STYLE[d.loss_reason] ?? REASON_STYLE.other}`}>
                  {d.loss_reason}
                </span>
              )}
              {won && (
                <span className="chip bg-jarvis-success/15 text-jarvis-success shrink-0">won</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
