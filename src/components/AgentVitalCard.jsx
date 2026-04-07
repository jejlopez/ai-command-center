import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn } from '../utils/cn';
import { useAnimatedCounter } from '../utils/useAnimatedCounter';

export function AgentVitalCard({ agent, onLogClick }) {
  const isProcessing = agent.status === 'processing';
  const progressAnim = useAnimatedCounter(agent.taskCompletion);
  
  const formattedData = agent.tokenBurn.map((v, i) => ({ val: v, i }));
  
  let latencyColor = 'text-aurora-green';
  if (agent.latencyMs > 2000) latencyColor = 'text-aurora-rose';
  else if (agent.latencyMs > 500) latencyColor = 'text-aurora-amber';

  return (
    <motion.div 
      whileHover={{ scale: 1.012 }}
      className={cn(
        "relative p-5 h-full flex flex-col justify-between group overflow-hidden",
        isProcessing ? "agent-card-active" : "spatial-panel"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-semibold text-sm text-text-primary flex items-center gap-2">
            {agent.name}
            <div className="relative flex items-center justify-center">
              {isProcessing && (
                <div className="absolute w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: agent.color }} />
              )}
              <div className="w-1.5 h-1.5 rounded-full z-10" style={{ backgroundColor: agent.color }} />
            </div>
          </div>
          <div className="spatial-panel inline-block px-1.5 py-0.5 mt-1 font-mono text-[10px] text-text-muted border-none bg-white/[0.02]">
            {agent.model}
          </div>
        </div>
        
        <div className="text-right">
          <div className={cn("font-mono text-xs font-semibold", latencyColor)}>
            {agent.latencyMs}ms
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center py-4">
        <div className="relative w-[80px] h-[80px]">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <motion.circle 
              cx="50" cy="50" r="40" 
              fill="transparent" 
              stroke={agent.color} 
              strokeWidth="6"
              strokeDasharray="251.2"
              strokeDashoffset={251.2 - (251.2 * agent.taskCompletion) / 100}
              strokeLinecap="round"
              initial={{ strokeDashoffset: 251.2 }}
              animate={{ strokeDashoffset: 251.2 - (251.2 * agent.taskCompletion) / 100 }}
              transition={{ type: 'spring', stiffness: 60, damping: 15 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="font-mono font-semibold text-lg font-tabular text-text-primary">
              <motion.span>{progressAnim}</motion.span>%
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-8 relative w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData}>
            <Line 
              type="monotone" 
              dataKey="val" 
              stroke={agent.color} 
              strokeWidth={1.5} 
              dot={false}
              isAnimationActive={true}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <AnimatePresence>
        <motion.div
          className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-surface via-surface/80 to-transparent flex justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity"
          initial={{ y: 8, opacity: 0 }}
          whileHover={{ y: 0, opacity: 1 }}
        >
          <button 
            onClick={onLogClick}
            className="text-aurora-teal text-xs font-semibold hover:text-white transition-colors"
          >
            Inspect →
          </button>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
