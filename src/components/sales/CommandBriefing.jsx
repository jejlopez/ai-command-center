// Command Briefing — what to do RIGHT NOW, ranked by revenue impact.
// Shows at the top of the Sales tab.

import { motion } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { Phone, Send, Calendar, AlertTriangle, TrendingUp, Clock } from "lucide-react";

const ACTION_ICONS = {
  call: Phone,
  send: Send,
  meeting: Calendar,
  overdue: Clock,
  default: AlertTriangle,
};

function ActionRow({ action, onOpen }) {
  const urgency = action.reason?.toLowerCase().includes("overdue") ? "danger"
    : action.reason?.toLowerCase().includes("walking") ? "danger"
    : action.value > 50000 ? "warning"
    : "primary";

  const colors = {
    danger: "border-jarvis-danger/10 bg-jarvis-danger/[0.02]",
    warning: "border-jarvis-warning/10 bg-jarvis-warning/[0.02]",
    primary: "border-jarvis-primary/8 bg-jarvis-primary/[0.02]",
  };

  const dotColors = {
    danger: "bg-jarvis-danger",
    warning: "bg-jarvis-warning",
    primary: "bg-jarvis-primary",
  };

  return (
    <motion.button
      variants={stagger.item}
      onClick={() => onOpen?.(action)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border ${colors[urgency]} transition-all hover:bg-white/[0.02] text-left`}
    >
      <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${dotColors[urgency]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-jarvis-ink truncate">
          {action.title} {action.value > 0 && <span className="text-jarvis-muted">(${(action.value / 1000).toFixed(0)}K)</span>}
        </div>
        <div className="text-[9px] text-jarvis-muted truncate">{action.reason}</div>
      </div>
      <div className="text-[9px] text-jarvis-muted uppercase shrink-0">{action.stage?.slice(0, 12)}</div>
    </motion.button>
  );
}

export function CommandBriefing({ command, onOpenDeal }) {
  if (!command) return null;

  const { doNow = [], doToday = [], hotDeals = [], stats } = command;

  if (doNow.length === 0 && doToday.length === 0) {
    return (
      <div className="surface p-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-jarvis-success" />
          <span className="text-[12px] text-jarvis-ink">Clear board — no urgent actions right now.</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-2">
      {doNow.length > 0 && (
        <div className="surface p-3">
          <div className="label text-jarvis-danger mb-2">Do Now</div>
          <div className="space-y-1">
            {doNow.map((a, i) => (
              <ActionRow key={a.id || i} action={a} onOpen={onOpenDeal} />
            ))}
          </div>
        </div>
      )}

      {doToday.length > 0 && (
        <div className="surface p-3">
          <div className="label text-jarvis-warning mb-2">Do Today</div>
          <div className="space-y-1">
            {doToday.map((a, i) => (
              <ActionRow key={a.id || i} action={a} onOpen={onOpenDeal} />
            ))}
          </div>
        </div>
      )}

      {/* Stats strip */}
      {stats && (
        <div className="flex gap-2">
          <div className="flex-1 surface p-2.5 text-center">
            <div className="text-jarvis-ink text-[16px] font-light">{stats.totalDeals}</div>
            <div className="text-[8px] text-jarvis-muted uppercase tracking-wider">pipeline</div>
          </div>
          <div className="flex-1 surface p-2.5 text-center">
            <div className="text-jarvis-ink text-[16px] font-light">${(stats.totalValue / 1000).toFixed(0)}K</div>
            <div className="text-[8px] text-jarvis-muted uppercase tracking-wider">value</div>
          </div>
          <div className="flex-1 surface p-2.5 text-center">
            <div className="text-jarvis-danger text-[16px] font-light">{stats.overdue}</div>
            <div className="text-[8px] text-jarvis-muted uppercase tracking-wider">overdue</div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
