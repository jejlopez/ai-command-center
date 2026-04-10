import { Activity, Bot, Rocket, ShieldCheck } from 'lucide-react';

const telemetryConfig = {
  readiness: { icon: Rocket, tone: 'text-aurora-teal' },
  missions: { icon: Activity, tone: 'text-aurora-blue' },
  approvals: { icon: ShieldCheck, tone: 'text-aurora-amber' },
  autonomy: { icon: Bot, tone: 'text-aurora-violet' },
};

export function BridgeTelemetryStrip({ items }) {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = telemetryConfig[item.id]?.icon || Activity;
        const tone = telemetryConfig[item.id]?.tone || 'text-text-primary';
        return (
          <div
            key={item.id}
            className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{item.label}</div>
              <Icon className={`h-4 w-4 ${tone}`} />
            </div>
            <div className={`mt-3 text-3xl font-semibold tracking-[-0.03em] ${tone}`}>{item.value}</div>
            <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{item.detail}</p>
          </div>
        );
      })}
    </section>
  );
}
