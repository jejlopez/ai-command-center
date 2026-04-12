import { AlertTriangle, ArrowRight, Clock, Target, Hourglass, Rewind, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";

const TONE = {
  primary: { text: "text-jarvis-primary", dot: "bg-jarvis-primary", border: "border-jarvis-primary/15", bg: "bg-jarvis-primary/[0.03]" },
  amber:   { text: "text-jarvis-warning", dot: "bg-jarvis-warning", border: "border-jarvis-warning/15", bg: "bg-jarvis-warning/[0.03]" },
  red:     { text: "text-jarvis-danger",  dot: "bg-jarvis-danger",  border: "border-jarvis-danger/15",  bg: "bg-jarvis-danger/[0.03]" },
  green:   { text: "text-jarvis-success", dot: "bg-jarvis-success", border: "border-jarvis-success/15", bg: "bg-jarvis-success/[0.03]" },
  purple:  { text: "text-jarvis-purple",  dot: "bg-jarvis-purple",  border: "border-jarvis-purple/15",  bg: "bg-jarvis-purple/[0.03]" },
};

function Section({ Icon, title, tone = "primary", children }) {
  const t = TONE[tone];
  return (
    <motion.div variants={stagger.item} className={`surface p-4 ${t.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={13} className={t.text} />
        <span className={`label ${t.text}`}>{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </motion.div>
  );
}

function Item({ title, detail, meta, tone = "primary" }) {
  const t = TONE[tone];
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-jarvis-ink font-medium leading-snug">{title}</div>
        {detail && <div className="text-[11px] text-jarvis-body mt-0.5 leading-snug">{detail}</div>}
        {meta && <div className="text-[10px] text-jarvis-muted mt-0.5 uppercase tracking-wide">{meta}</div>}
      </div>
    </div>
  );
}

export function MorningBrief({ brief }) {
  if (!brief) return null;
  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      {/* Hero briefing */}
      <motion.div variants={stagger.item} className="surface p-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-jarvis-grid [background-size:24px_24px]" />
        <div className="relative">
          <div className="label mb-2 text-jarvis-primary">Today Briefing</div>
          <div className="text-[15px] text-jarvis-ink leading-relaxed">{brief.todayBriefing}</div>
        </div>
      </motion.div>

      {/* Compact 2-col stacked sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section Icon={AlertTriangle} title="Critical Items" tone="red">
          {brief.criticalItems.map((i) => (
            <Item key={i.id} title={i.title} detail={i.detail} tone="red" />
          ))}
        </Section>

        <Section Icon={ArrowRight} title="Next Best Move" tone="primary">
          {brief.nextBestMove && (
            <Item
              title={brief.nextBestMove.title}
              detail={brief.nextBestMove.detail}
              tone="primary"
            />
          )}
        </Section>

        <Section Icon={Clock} title="Schedule Summary" tone="primary">
          {brief.schedule.map((s) => (
            <Item
              key={s.id}
              title={s.title}
              meta={new Date(s.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              tone="primary"
            />
          ))}
        </Section>

        <Section Icon={Wallet} title="Budget Overview" tone="amber">
          <Item
            title={`$${brief.budget.spentToday} / $${brief.budget.budgetToday} ${brief.budget.currency}`}
            meta={brief.budget.topCategory ? `Top: ${brief.budget.topCategory}` : undefined}
            tone="amber"
          />
        </Section>

        <Section Icon={Hourglass} title="Waiting On" tone="amber">
          {brief.waitingOn.map((i) => (
            <Item key={i.id} title={i.title} meta={i.source} tone="amber" />
          ))}
        </Section>

        <Section Icon={Rewind} title="Follow-Ups" tone="primary">
          {brief.followUps.map((i) => (
            <Item key={i.id} title={i.title} meta={i.source} tone="primary" />
          ))}
        </Section>
      </div>

      {/* Focus ribbon */}
      <motion.div variants={stagger.item} className="surface p-4 flex items-start gap-3">
        <Target size={14} className="text-jarvis-success mt-0.5 shrink-0" />
        <div>
          <div className="label text-jarvis-success mb-1">
            Focus
          </div>
          <div className="text-[13px] text-jarvis-ink leading-snug">{brief.focus}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}
