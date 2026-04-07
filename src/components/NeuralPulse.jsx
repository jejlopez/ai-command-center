import React from 'react';
import { motion } from 'framer-motion';
import { useAnimatedCounter } from '../utils/useAnimatedCounter';
import { useTypewriter } from '../utils/useTypewriter';

export function NeuralPulse({ systemHealth = 100, agentCount = 0 }) {
  const displayCount = useAnimatedCounter(agentCount);
  
  const placeholders = [
    "Ask about agent status...",
    "Search tasks and pipelines...",
    "Query memory store..."
  ];
  const placeholderText = useTypewriter(placeholders);

  let orbColor = '#00D9C8'; // teal
  if (systemHealth <= 70) orbColor = '#fb7185'; // rose
  else if (systemHealth <= 90) orbColor = '#fbbf24'; // amber

  return (
    <div className="flex items-center justify-between p-6 spatial-panel">
      <div className="flex items-center gap-6">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <motion.div
            animate={{ scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
            className="w-full h-full rounded-full"
            style={{
              backgroundColor: `${orbColor}66`,
              boxShadow: `0 0 20px ${orbColor}33, 0 0 40px ${orbColor}22, 0 0 80px ${orbColor}11`
            }}
          />
          <div className="absolute w-8 h-8 rounded-full z-10" style={{ backgroundColor: orbColor }} />
        </div>
        <div>
          <div className="text-sm text-text-muted font-medium mb-1 tracking-wider uppercase">System Core</div>
          <div className="text-2xl font-bold text-text-primary">
            <motion.span>{displayCount}</motion.span> agents active
          </div>
        </div>
      </div>
      
      <div className="relative w-96 flex items-center">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: orbColor }} />
        </div>
        <input 
          type="text"
          className="w-full h-12 bg-white/[0.03] border border-white/[0.05] rounded-xl pl-10 pr-16 text-text-primary placeholder-text-muted outline-none focus:border-aurora-violet/50 transition-colors shadow-inner"
          placeholder={placeholderText}
          readOnly
        />
        <div className="absolute inset-y-0 right-3 flex items-center">
          <div className="spatial-panel px-2 py-1 text-[10px] font-mono text-text-muted rounded-md border-white/10">
            ⌘K
          </div>
        </div>
      </div>
    </div>
  );
}
