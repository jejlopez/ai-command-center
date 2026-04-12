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
    <div className="ui-panel p-5">
      <CommandSectionHeader
        eyebrow="Launch Protocol"
        title="What the commander should do next"
        description="The next actions that improve throughput, reduce drag, or open the cleanest lane."
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
              className="ui-card-row flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35"
            >
              <div className="ui-panel-soft flex h-11 w-11 shrink-0 items-center justify-center">
                <Icon className={`h-4.5 w-4.5 ${action.tone}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-text-primary">{action.label}</div>
                  <div className="ui-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
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
