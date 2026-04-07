import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { agents } from '../utils/mockData';
import { AgentVitalCard } from '../components/AgentVitalCard';
import { container, item } from '../utils/variants';
import { ActivityFeed } from '../components/ActivityFeed';

export function FleetView({ onOpenDetail }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar pb-10">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">Agent Fleet</h2>
          <p className="text-sm text-text-muted">Monitor and control your deployed AI workforce.</p>
        </div>
        <div className="spatial-panel px-4 py-2 text-sm font-mono text-aurora-teal">
          {agents.length} Nodes Active
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5 h-[320px] mb-8">
        <div className="col-span-12 spatial-panel p-6 flex flex-col items-center justify-center border-aurora-violet/20 shadow-glow-violet">
           <h3 className="text-lg font-semibold text-aurora-violet mb-2">Swarm Intellect Aggregate</h3>
           <p className="text-text-body text-center max-w-lg mb-6">The collective is operating at optimal latency with zero OOM faults detected in the last hour.</p>
           <div className="flex gap-16">
             <div className="text-center">
               <div className="text-[10px] uppercase text-text-muted tracking-widest mb-1">Avg Latency</div>
               <div className="text-xl font-mono text-aurora-green">214ms</div>
             </div>
             <div className="text-center">
               <div className="text-[10px] uppercase text-text-muted tracking-widest mb-1">Compute Spike</div>
               <div className="text-xl font-mono text-aurora-amber">42%</div>
             </div>
             <div className="text-center">
               <div className="text-[10px] uppercase text-text-muted tracking-widest mb-1">Network Out</div>
               <div className="text-xl font-mono text-aurora-blue">84 MB/s</div>
             </div>
           </div>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-12 gap-5">
        <div className="col-span-12">
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Live Instances</h3>
        </div>
        <AnimatePresence mode="popLayout">
          {agents.map(a => (
            <motion.div key={a.id} variants={item} layout layoutId={`fleet-${a.id}`} className="col-span-4 h-64">
              <AgentVitalCard agent={a} onLogClick={() => onOpenDetail(a.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
