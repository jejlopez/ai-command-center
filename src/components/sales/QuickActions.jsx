// QuickActions — hover overlay with action buttons for leads/deals.

import { Phone, Mail, Mic, StickyNote, Check, Clock, ArrowRight } from "lucide-react";

const ACTIONS = {
  lead: [
    { id: "call", icon: Phone, label: "Call", color: "bg-jarvis-danger/12 text-jarvis-danger" },
    { id: "email", icon: Mail, label: "Email", color: "bg-jarvis-primary/12 text-jarvis-primary" },
    { id: "log_call", icon: Mic, label: "Log Call", color: "bg-jarvis-purple/12 text-jarvis-purple" },
    { id: "note", icon: StickyNote, label: "Note", color: "bg-jarvis-warning/12 text-jarvis-warning" },
    { id: "approve", icon: Check, label: "Approve", color: "bg-jarvis-success/12 text-jarvis-success" },
    { id: "snooze", icon: Clock, label: "Snooze", color: "bg-white/5 text-jarvis-muted" },
    { id: "convert", icon: ArrowRight, label: "Convert", color: "bg-cyan-400/12 text-cyan-400" },
  ],
  deal: [
    { id: "call", icon: Phone, label: "Call", color: "bg-jarvis-danger/12 text-jarvis-danger" },
    { id: "email", icon: Mail, label: "Email", color: "bg-jarvis-primary/12 text-jarvis-primary" },
    { id: "log_call", icon: Mic, label: "Log Call", color: "bg-jarvis-purple/12 text-jarvis-purple" },
    { id: "note", icon: StickyNote, label: "Note", color: "bg-jarvis-warning/12 text-jarvis-warning" },
    { id: "approve", icon: Check, label: "Approve", color: "bg-jarvis-success/12 text-jarvis-success" },
    { id: "snooze", icon: Clock, label: "Snooze", color: "bg-white/5 text-jarvis-muted" },
  ],
};

export function QuickActions({ type = "lead", record, onAction }) {
  const actions = ACTIONS[type] || ACTIONS.lead;

  return (
    <div className="flex gap-1 items-center" onClick={e => e.stopPropagation()}>
      {actions.map(a => (
        <button
          key={a.id}
          onClick={() => onAction?.(a.id, record)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-semibold transition hover:scale-105 ${a.color}`}
          title={a.label}
        >
          <a.icon size={10} />
          <span className="hidden xl:inline">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
