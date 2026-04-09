import { ArrowRight, Bot, Clock3, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { CommandSectionHeader } from '../command/CommandSectionHeader';

const iconMap = {
  missions: Rocket,
  approvals: ShieldCheck,
  operators: Bot,
  schedules: Clock3,
  system: Sparkles,
};

export function LaunchProtocolPanel({ actions, onNavigate, onOpenDetail, onAddOperator }) {
  function handleAction(action) {
    if (action.type === 'navigate') onNavigate?.(action.target);
    if (action.type === 'detail') onOpenDetail?.(action.target);
    if (action.type === 'operator') onAddOperator?.();
  }

  return (
    <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(45,212,191,0.05),rgba(255,255,255,0.02))] p-5">
      <CommandSectionHeader
        eyebrow="Launch Protocol"
        title="What the commander should do next"
        description="A curated sequence of the next best actions already available in the system."
        icon={Rocket}
        tone="teal"
      />

      <div className="space-y-3">
        {actions.map((action, index) => {
          const Icon = iconMap[action.icon] || Rocket;
          return (
            <button
              key={`${action.label}-${index}`}
              type="button"
              onClick={() => handleAction(action)}
              className="flex w-full items-start gap-4 rounded-[22px] border border-white/8 bg-black/20 p-4 text-left transition-colors hover:bg-white/[0.04]"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03]">
                <Icon className={`h-4.5 w-4.5 ${action.tone}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-text-primary">{action.label}</div>
                  <div className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                    {action.badge}
                  </div>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{action.detail}</p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-text-muted" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
