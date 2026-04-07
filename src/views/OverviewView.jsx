import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { container, item } from '../utils/variants';
import { agents, mockSpans } from '../utils/mockData';
import { SpotlightCard } from '../components/SpotlightCard';
import { NeuralPulse } from '../components/NeuralPulse';
import { AgentVitalCard } from '../components/AgentVitalCard';
import { CostBurnWidget } from '../components/CostBurnWidget';
import { ActivityFeed } from '../components/ActivityFeed';
import { TaskDAG } from '../components/TaskDAG';
import { MemorySparkmap } from '../components/MemorySparkmap';
import { HealthRadial } from '../components/HealthRadial';
import { TraceWaterfall } from '../components/TraceWaterfall';

export function OverviewView({ onOpenDetail }) {
  return (
    <motion.div 
      variants={container} 
      initial="hidden" 
      animate="show"
      className="grid grid-cols-12 gap-5 pb-8"
    >
      {/* Row 1 */}
      <motion.div variants={item} className="col-span-12">
        <SpotlightCard>
          <NeuralPulse systemHealth={94} agentCount={4} />
        </SpotlightCard>
      </motion.div>

      {/* Row 2 */}
      <AnimatePresence mode="popLayout">
        {agents.map(a => (
          <motion.div key={a.id} variants={item} layout layoutId={a.id} className="col-span-3">
            <AgentVitalCard agent={a} onLogClick={() => onOpenDetail(a.id)} />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Row 3 */}
      <motion.div variants={item} className="col-span-4 h-80">
        <SpotlightCard className="h-full">
          <CostBurnWidget />
        </SpotlightCard>
      </motion.div>
      <motion.div variants={item} className="col-span-4 h-80">
        <SpotlightCard className="h-full">
          <ActivityFeed />
        </SpotlightCard>
      </motion.div>
      <motion.div variants={item} className="col-span-4 h-80">
        <SpotlightCard className="h-full">
          <TaskDAG />
        </SpotlightCard>
      </motion.div>

      {/* Row 4 */}
      <motion.div variants={item} className="col-span-5 h-[300px]">
        <SpotlightCard className="h-full">
          <MemorySparkmap />
        </SpotlightCard>
      </motion.div>
      <motion.div variants={item} className="col-span-3 h-[300px]">
        <div className="spatial-panel flex gap-6 justify-center items-center h-full">
          <HealthRadial label="CPU" value={72} color="#00D9C8" />
          <HealthRadial label="MEM" value={58} color="#a78bfa" />
          <HealthRadial label="API" value={94} color="#60a5fa" />
        </div>
      </motion.div>
      <motion.div variants={item} className="col-span-4 h-[300px]">
        <SpotlightCard className="h-full">
          <TraceWaterfall spans={mockSpans} />
        </SpotlightCard>
      </motion.div>
    </motion.div>
  );
}
