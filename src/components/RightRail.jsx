import { ShieldAlert, BellRing, Ban, CheckCircle2 } from "lucide-react";
import SkillsRailWidget from "./skills/SkillsRailWidget.jsx";

function Card({ Icon, title, tone = "cyan", count, children }) {
  const toneClass = {
    amber: "text-jarvis-amber",
    red: "text-jarvis-red",
    green: "text-jarvis-green",
    cyan: "text-jarvis-cyan",
    blue: "text-jarvis-blue",
  }[tone];
  return (
    <div className="glass p-4">
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
    </div>
  );
}

export function RightRail({ rail, onDecide, recentRuns = [] }) {
  if (!rail) return null;
  return (
    <div className="w-[300px] space-y-4 shrink-0">
      <Card Icon={ShieldAlert} title="Pending Approvals" tone="amber" count={rail.approvals.length}>
        {rail.approvals.length === 0 && (
          <div className="text-[11px] text-jarvis-muted italic">No approvals pending.</div>
        )}
        {rail.approvals.map((a) => (
          <div key={a.id} className="rounded-xl bg-jarvis-amber/5 border border-jarvis-amber/20 p-3">
            <div className="text-[13px] text-jarvis-ink font-medium">{a.title}</div>
            <div className="text-[11px] text-jarvis-body mt-1">{a.reason}</div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onDecide?.(a.id, "approve")}
                className="flex-1 py-1.5 rounded-lg bg-jarvis-green/15 text-jarvis-green text-[11px] font-semibold hover:bg-jarvis-green/25 transition"
              >
                Approve
              </button>
              <button
                onClick={() => onDecide?.(a.id, "deny")}
                className="flex-1 py-1.5 rounded-lg bg-white/5 text-jarvis-body text-[11px] font-semibold hover:bg-white/10 transition"
              >
                Deny
              </button>
            </div>
          </div>
        ))}
      </Card>

      <Card Icon={BellRing} title="Reminders" tone="cyan" count={rail.reminders.length}>
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
    </div>
  );
}
