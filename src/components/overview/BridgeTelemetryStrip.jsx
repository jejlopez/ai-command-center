import { Activity, Bot, Rocket, ShieldCheck } from 'lucide-react';
import { cn } from "../../utils/cn";

const telemetryConfig = {
  readiness: { icon: Rocket, tone: 'text-aurora-teal' },
  missions: { icon: Activity, tone: 'text-aurora-blue' },
  approvals: { icon: ShieldCheck, tone: 'text-aurora-amber' },
  autonomy: { icon: Bot, tone: 'text-aurora-violet' },
};

export function BridgeTelemetryStrip({ items }) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = telemetryConfig[item.id]?.icon || Activity;
        const tone = telemetryConfig[item.id]?.tone || 'text-text';
        return (
          <div
            key={item.id}
            className="group rounded-[24px] border border-hairline bg-panel p-6 shadow-sm transition-all hover:shadow-main hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[9px] font-black uppercase tracking-[0.25em] text-text-dim opacity-70 group-hover:opacity-100 transition-opacity">
                {item.label}
              </div>
              <Icon className={cn("h-5 w-5", tone)} />
            </div>
            <div className={cn("mt-4 text-4xl font-black tracking-tighter uppercase", tone)}>
              {item.value}
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-text-dim font-medium italic opacity-80">
              "{item.detail}"
            </p>
          </div>
        );
      })}
    </section>
  );
}
