import React from 'react';
import { motion } from 'framer-motion';
import { useAnimatedCounter } from '../utils/useAnimatedCounter';
import { Plus } from 'lucide-react';

export function NeuralPulse({ systemHealth = 100, agentCount = 0, idleCount = 0, errorCount = 0, totalCount = 0, onDeploy }) {
  const displayCount = useAnimatedCounter(agentCount);

  let orbColor = '#00D9C8'; // teal
  if (systemHealth <= 70) orbColor = '#fb7185'; // rose
  else if (systemHealth <= 90) orbColor = '#fbbf24'; // amber

  return (
    <div className="flex items-center justify-between p-5 spatial-panel">
      <div className="flex items-center gap-5">
        <div className="relative w-12 h-12 flex items-center justify-center">
          <motion.div
            animate={{ scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
            className="w-full h-full rounded-full"
            style={{
              backgroundColor: `${orbColor}66`,
              boxShadow: `0 0 20px ${orbColor}33, 0 0 40px ${orbColor}22, 0 0 80px ${orbColor}11`
            }}
          />
          <div className="absolute w-6 h-6 rounded-full z-10" style={{ backgroundColor: orbColor }} />
        </div>
        <div>
          <div className="text-[10px] text-text-muted font-semibold tracking-[0.15em] uppercase">System Core</div>
          <div className="text-lg font-bold text-text-primary font-mono">
            <motion.span>{displayCount}</motion.span> active
            <span className="text-sm font-normal text-text-muted ml-2">/ {totalCount} agents</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 spatial-panel">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aurora-teal opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-aurora-teal" />
          </span>
          <span className="text-xs font-mono text-aurora-teal">{agentCount} Active</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 spatial-panel">
          <span className="w-2 h-2 rounded-full bg-text-muted" />
          <span className="text-xs font-mono text-text-muted">{idleCount} Idle</span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 spatial-panel border border-aurora-rose/30">
            <span className="w-2 h-2 rounded-full bg-aurora-rose animate-pulse" />
            <span className="text-xs font-mono text-aurora-rose font-semibold">{errorCount} Error</span>
          </div>
        )}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onDeploy}
          className="flex items-center gap-2 px-4 py-2 bg-aurora-teal text-black rounded-xl text-sm font-semibold hover:bg-aurora-teal/90 transition-colors shadow-glow-teal"
        >
          <Plus className="w-4 h-4" />
          Deploy Agent
        </motion.button>
      </div>
    </div>
  );
}
