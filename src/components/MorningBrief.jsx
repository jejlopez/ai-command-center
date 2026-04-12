import { AlertTriangle, ArrowRight, Clock, Target, Hourglass, Rewind, Wallet } from "lucide-react";

const TONE = {
  cyan:   { text: "text-jarvis-cyan",   dot: "bg-jarvis-cyan",   border: "border-jarvis-cyan/20",   bg: "bg-jarvis-cyan/5" },
  amber:  { text: "text-jarvis-amber",  dot: "bg-jarvis-amber",  border: "border-jarvis-amber/20",  bg: "bg-jarvis-amber/5" },
  red:    { text: "text-jarvis-red",    dot: "bg-jarvis-red",    border: "border-jarvis-red/20",    bg: "bg-jarvis-red/5" },
  blue:   { text: "text-jarvis-blue",   dot: "bg-jarvis-blue",   border: "border-jarvis-blue/20",   bg: "bg-jarvis-blue/5" },
  green:  { text: "text-jarvis-green",  dot: "bg-jarvis-green",  border: "border-jarvis-green/20",  bg: "bg-jarvis-green/5" },
  purple: { text: "text-jarvis-purple", dot: "bg-jarvis-purple", border: "border-jarvis-purple/20", bg: "bg-jarvis-purple/5" },
};

function Section({ Icon, title, tone = "cyan", children }) {
  const t = TONE[tone];
  return (
    <div className={`rounded-2xl border ${t.border} ${t.bg} p-4 backdrop-blur-xl`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={13} className={t.text} />
        <span className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${t.text}`}>
          {title}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Item({ title, detail, meta, tone = "cyan" }) {
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
    <div className="space-y-4">
      {/* Hero briefing */}
      <div className="glass p-5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-jarvis-grid [background-size:24px_24px]" />
        <div className="relative">
          <div className="label mb-2 text-jarvis-cyan">Today Briefing</div>
          <div className="text-[15px] text-jarvis-ink leading-relaxed">{brief.todayBriefing}</div>
        </div>
      </div>

      {/* Compact 2-col stacked sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section Icon={AlertTriangle} title="Critical Items" tone="red">
          {brief.criticalItems.map((i) => (
            <Item key={i.id} title={i.title} detail={i.detail} tone="red" />
          ))}
        </Section>

        <Section Icon={ArrowRight} title="Next Best Move" tone="cyan">
          {brief.nextBestMove && (
            <Item
              title={brief.nextBestMove.title}
              detail={brief.nextBestMove.detail}
              tone="cyan"
            />
          )}
        </Section>

        <Section Icon={Clock} title="Schedule Summary" tone="blue">
          {brief.schedule.map((s) => (
            <Item
              key={s.id}
              title={s.title}
              meta={new Date(s.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              tone="blue"
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

        <Section Icon={Rewind} title="Follow-Ups" tone="blue">
          {brief.followUps.map((i) => (
            <Item key={i.id} title={i.title} meta={i.source} tone="blue" />
          ))}
        </Section>
      </div>

      {/* Focus ribbon */}
      <div className="rounded-2xl border border-jarvis-green/20 bg-jarvis-green/5 p-4 flex items-start gap-3">
        <Target size={14} className="text-jarvis-green mt-0.5 shrink-0" />
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-jarvis-green mb-1">
            Focus
          </div>
          <div className="text-[13px] text-jarvis-ink leading-snug">{brief.focus}</div>
        </div>
      </div>
    </div>
  );
}
