import { BrainCircuit } from 'lucide-react';
import { cn } from "../../utils/cn";

export function CommandReadFirst({ items }) {
  const primaryItems = items.slice(0, 2);
  const tertiaryItem = items[2];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {primaryItems.map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className="ui-panel p-6 shadow-main border-hairline bg-panel"
        >
          <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.25em] text-text-dim opacity-70">
            <BrainCircuit className={cn("h-4 w-4", item.tone || 'text-aurora-teal')} />
            {item.eyebrow}
          </div>
          <div className="mt-4 text-2xl font-black tracking-tight text-text uppercase">{item.title}</div>
          <p className="mt-4 text-[13px] leading-relaxed text-text-dim font-medium italic opacity-90">"{item.detail}"</p>
        </div>
      ))}
      </div>
      {tertiaryItem ? (
        <div className="ui-panel-soft px-5 py-4 border-hairline bg-panel-soft shadow-inner rounded-xl">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-text-dim">
              <BrainCircuit className={cn("h-4 w-4", tertiaryItem.tone || 'text-aurora-teal')} />
              {tertiaryItem.eyebrow}
            </div>
            <div className="text-xs font-black text-text uppercase tracking-widest">{tertiaryItem.title}</div>
            <div className="text-[12px] leading-relaxed text-text-dim font-medium italic">"{tertiaryItem.detail}"</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
