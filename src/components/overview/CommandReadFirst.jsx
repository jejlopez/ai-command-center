import { BrainCircuit } from 'lucide-react';

export function CommandReadFirst({ items }) {
  const primaryItems = items.slice(0, 2);
  const tertiaryItem = items[2];

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {primaryItems.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5"
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
            <BrainCircuit className={`h-3.5 w-3.5 ${item.tone || 'text-aurora-teal'}`} />
            {item.eyebrow}
          </div>
          <div className="mt-3 text-xl font-semibold tracking-tight text-text-primary">{item.title}</div>
          <p className="mt-3 text-[13px] leading-6 text-text-body">{item.detail}</p>
        </div>
      ))}
      </div>
      {tertiaryItem ? (
        <div className="rounded-[22px] border border-white/8 bg-black/15 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
              <BrainCircuit className={`h-3.5 w-3.5 ${tertiaryItem.tone || 'text-aurora-teal'}`} />
              {tertiaryItem.eyebrow}
            </div>
            <div className="text-sm font-semibold text-text-primary">{tertiaryItem.title}</div>
            <div className="text-[12px] leading-relaxed text-text-muted">{tertiaryItem.detail}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
