import { ArrowRight, Bot, Clock3, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from "../../utils/cn";
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
    <div className="ui-panel p-6 shadow-main border-hairline bg-panel">
      <CommandSectionHeader
        eyebrow="Launch Protocol"
        title="Command Directives"
        description="The next actions that improve throughput, reduce drag, or open the cleanest mission lane."
        icon={Rocket}
        tone="teal"
      />

      <div className="mt-6 space-y-3">
        {actions.map((action, index) => {
          const Icon = iconMap[action.icon] || Rocket;
          return (
            <button
              key={`${action.label}-${index}`}
              type="button"
              onClick={() => handleAction(action)}
              className="ui-card-row group flex w-full items-center gap-5 p-5 text-left transition-all hover:bg-panel-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35 shadow-sm border border-hairline bg-panel"
            >
              <div className="ui-panel-soft flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-canvas border border-hairline shadow-inner">
                <Icon className={cn("h-5 w-5", action.tone)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-text uppercase tracking-tight">{action.label}</div>
                  <div className="ui-chip px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] bg-panel-soft border border-hairline">
                    {action.badge}
                  </div>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-dim font-medium italic opacity-80">"{action.detail}"</p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-text-dim opacity-40 transition-transform group-hover:translate-x-1" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
