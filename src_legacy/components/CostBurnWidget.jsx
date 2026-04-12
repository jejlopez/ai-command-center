import React from 'react';
import { motion as Motion } from 'framer-motion';
import { useCostData } from '../utils/useSupabase';
import { useAnimatedCounter } from '../utils/useAnimatedCounter';

const colors = {
  'Claude': '#a78bfa',
  'GPT-4o': '#60a5fa',
  'Gemini': '#fbbf24'
};

export function CostBurnWidget() {
  const { data: costData } = useCostData();
  const displayTotal = useAnimatedCounter(costData.total, { decimals: 2 });

  return (
    <div className="ui-shell p-6 h-full flex flex-col justify-between">
      <div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted mb-2 font-semibold">Cost Today</div>
        <div className="font-mono text-3xl font-light text-text-primary font-tabular flex items-baseline">
          <span className="text-text-muted text-xl mr-1">$</span>
          <Motion.span>{displayTotal}</Motion.span>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-6">
        {costData.models.map((m, i) => (
          <div key={m.name}>
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-xs font-medium text-text-primary">{m.name}</span>
              <span className="font-mono text-[11px] text-text-muted font-tabular">${m.cost.toFixed(2)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden w-full">
              <Motion.div 
                className="h-full rounded-full"
                style={{ backgroundColor: colors[m.name] || '#fff' }}
                initial={{ width: 0 }}
                animate={{ width: `${m.percentage}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: i * 0.15 }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-border pt-4 text-center">
        <Motion.div 
          className="text-aurora-teal font-mono text-sm font-tabular"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          ${costData.burnRate.toFixed(2)}/hr
        </Motion.div>
      </div>
    </div>
  );
}
