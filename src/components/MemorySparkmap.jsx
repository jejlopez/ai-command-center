import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WidgetActions } from './WidgetActions';
import { useActivityLog } from '../utils/useSupabase';

export function MemorySparkmap() {
  const { logs } = useActivityLog();
  const [hoveredChunk, setHoveredChunk] = useState(null);
  const memoryChunks = useMemo(() => {
    const source = logs.slice(-36);
    return source.map((entry, index) => ({
      key: `mem_${String(index + 1).padStart(2, '0')}`,
      recency: index >= source.length - 12 ? 'recent' : index >= source.length - 24 ? 'medium' : 'old',
      lastAccessed: entry.timestamp || new Date().toISOString(),
      animationDelay: `${(index % 6) * 0.35}s`,
    }));
  }, [logs]);

  const getCellColor = (recency) => {
    switch(recency) {
      case 'recent': return 'rgba(0,217,200,0.6)';
      case 'medium': return 'rgba(167,139,250,0.3)';
      case 'old': return 'rgba(255,255,255,0.05)';
      default: return 'rgba(255,255,255,0.05)';
    }
  };

  return (
    <div className="spatial-panel p-6 h-full flex flex-col items-center justify-center relative group">
      <WidgetActions onExpand={() => {}} onConfigure={() => {}} onRemove={() => {}} />
      <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted mb-4 font-semibold w-full text-center">
        Memory Core
      </div>
      
      <div className="grid grid-cols-6 gap-0.5 relative">
        {memoryChunks.map((chunk) => (
          <div
            key={chunk.key}
            className="w-[10px] h-[10px] rounded-[2px]"
            style={{ 
              backgroundColor: getCellColor(chunk.recency),
              animation: 'cell-pulse 3s ease-in-out infinite',
              animationDelay: chunk.animationDelay,
            }}
            onMouseEnter={() => setHoveredChunk(chunk)}
            onMouseLeave={() => setHoveredChunk(null)}
          />
        ))}
        {memoryChunks.length === 0 && (
          <div className="col-span-6 py-4 text-center text-[10px] text-text-muted">
            No memory activity yet.
          </div>
        )}

        <AnimatePresence>
          {hoveredChunk && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="absolute top-[-44px] left-1/2 -translate-x-1/2 px-2 py-1.5 bg-surface border border-border rounded shadow-xl pointer-events-none whitespace-nowrap z-10"
            >
              <div className="text-[10px] font-mono text-aurora-violet mb-0.5">{hoveredChunk.key}</div>
              <div className="text-[9px] text-text-muted">Last access: {new Date(hoveredChunk.lastAccessed).toLocaleTimeString()}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
