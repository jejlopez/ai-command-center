import React, { useState } from 'react';
import { motion } from 'framer-motion';

const typeColors = {
  llm: '#a78bfa',
  tool: '#fbbf24',
  retrieval: '#60a5fa',
  agent: '#00D9C8',
  error: '#fb7185'
};

export function TraceWaterfall({ spans }) {
  const [hoveredSpan, setHoveredSpan] = useState(null);

  if (!spans || spans.length === 0) return null;

  const totalMs = Math.max(...spans.map(s => s.startMs + s.durationMs));

  // compute depths
  const depthMap = new Map();
  spans.forEach(span => {
    let depth = 0;
    let current = span;
    while(current.parentId) {
      depth++;
      current = spans.find(s => s.id === current.parentId) || {};
    }
    depthMap.set(span.id, depth);
  });

  return (
    <div className="p-6 h-full flex flex-col relative w-full">
      <div className="flex justify-between items-center mb-6">
        <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold">
          Execution Trace
        </div>
        <div className="ui-card-row px-2 py-1 text-[10px] font-mono text-text-muted border-none bg-white/[0.02]">
          Total: {totalMs}ms
        </div>
      </div>

      <div className="flex-1 w-full overflow-y-auto pr-2 no-scrollbar">
        <div className="space-y-1">
          {spans.map((span, index) => {
            const depth = depthMap.get(span.id) || 0;
            const startPct = (span.startMs / totalMs) * 100;
            const widthPct = (span.durationMs / totalMs) * 100;
            const color = typeColors[span.type] || '#fff';

            return (
              <div 
                key={span.id} 
                className="relative flex items-center group cursor-pointer"
                onMouseEnter={() => setHoveredSpan(span)}
                onMouseLeave={() => setHoveredSpan(null)}
              >
                {/* Text Label Area */}
                <div 
                  className="w-1/3 shrink-0 py-1 truncate text-[11px] font-mono text-text-primary transition-colors group-hover:text-white"
                  style={{ paddingLeft: `${depth * 12}px` }}
                >
                  <span className="opacity-50 mr-1.5" style={{ color }}>●</span>
                  {span.name}
                </div>
                
                {/* Gantt Bar Area */}
                <div className="flex-1 h-5 relative mx-2 rounded-[2px] bg-white/[0.02]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: depth * 0.1 }}
                    className="absolute h-full rounded-[2px] border-l-2"
                    style={{ 
                      left: `${startPct}%`,
                      backgroundColor: `${color}33`,
                      borderColor: color 
                    }}
                  />
                </div>
                
                <div className="w-10 shrink-0 text-right text-[10px] font-mono text-text-muted tabular-nums">
                  {span.durationMs}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hoveredSpan && (
        <div className="absolute bottom-6 right-6 ui-shell p-3 text-xs bg-surface/90 border-border shadow-2xl z-10 w-48 pointer-events-none">
          <div className="font-semibold text-text-primary truncate mb-1">{hoveredSpan.name}</div>
          <div className="flex justify-between items-center text-[10px] text-text-muted font-mono mb-2">
            <span>{hoveredSpan.type}</span>
            <span>{hoveredSpan.durationMs}ms</span>
          </div>
          {hoveredSpan.model && (
            <div className="text-[10px] text-aurora-violet truncate">Model: {hoveredSpan.model}</div>
          )}
          {hoveredSpan.tokens > 0 && (
            <div className="text-[10px] text-aurora-blue">Tokens: {hoveredSpan.tokens}</div>
          )}
        </div>
      )}
    </div>
  );
}
