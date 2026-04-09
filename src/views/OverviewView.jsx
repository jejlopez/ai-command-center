import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { container, item } from '../utils/variants';
import { useHealthMetrics } from '../utils/useSupabase';
import { SpotlightCard } from '../components/SpotlightCard';
import { NeuralPulse } from '../components/NeuralPulse';
import { AgentVitalCard } from '../components/AgentVitalCard';
import { CostBurnWidget } from '../components/CostBurnWidget';
import { ActivityFeed } from '../components/ActivityFeed';
import { TaskDAG } from '../components/TaskDAG';
import { HealthRadial } from '../components/HealthRadial';
import { CreateAgentModal } from '../components/CreateAgentModal';
import { Plus, GitBranch, RotateCcw, Loader2 } from 'lucide-react';
import { retryTask } from '../lib/api';
import { cn } from '../utils/cn';

const statusStyles = {
  success: 'row-success text-aurora-green border-aurora-green/20',
  completed: 'row-success text-aurora-green border-aurora-green/20',
  error: 'row-error text-aurora-rose border-aurora-rose/20',
  running: 'row-running text-aurora-amber border-aurora-amber/20',
  idle: 'row-idle text-text-muted border-white/5',
  pending: 'row-idle text-text-muted border-white/5',
};

export function OverviewView({ agents, tasks, loading, addOptimistic, onOpenDetail, onQuickDispatch }) {
  const { data: healthData, errorsByAgent } = useHealthMetrics();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-aurora-teal animate-spin" />
      </div>
    );
  }

  const activeAgents = agents.filter(a => a.status === 'processing').length;
  const idleAgents = agents.filter(a => a.status === 'idle').length;
  const errorAgents = agents.filter(a => a.status === 'error').length;


  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-12 gap-5 pb-8"
    >
      {/* Row 1: System pulse + fleet status */}
      <motion.div variants={item} className="col-span-12">
        <SpotlightCard>
          <NeuralPulse
            systemHealth={healthData.length ? Math.round(healthData.reduce((s, m) => s + m.value, 0) / healthData.length) : 100}
            agentCount={activeAgents}
            idleCount={idleAgents}
            errorCount={errorAgents}
            totalCount={agents.length}
            onDeploy={() => setCreateModalOpen(true)}
          />
        </SpotlightCard>
      </motion.div>

      {/* Row 2: Agent cards — AoE unit-selection grid */}
      <motion.div variants={item} className="col-span-12 overflow-visible">
        <div className="grid grid-cols-12 gap-5">
          <AnimatePresence mode="popLayout">
            {agents.map(a => (
              <motion.div key={a.id} variants={item} layout layoutId={a.id} className="col-span-4 relative z-10 hover:z-50 overflow-visible">
                <AgentVitalCard
                  agent={a}
                  errorCount={errorsByAgent.counts[a.id] || 0}
                  latestErrorMessage={errorsByAgent.messages[a.id] || null}
                  onOpenDetail={() => onOpenDetail(a.id)}
                  onQuickDispatch={() => onQuickDispatch(a.id)}
                  onViewLogs={() => onOpenDetail(a.id, { mode: 'logs' })}
                  onTuneAgent={() => onOpenDetail(a.id, { mode: 'config' })}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Row 3: Neural Execution Graph (full width hero) */}
      <motion.div variants={item} className="col-span-12 h-[380px]">
        <div className="spatial-panel p-6 h-full flex flex-col relative">
          <h3 className="text-xs uppercase tracking-widest text-text-muted mb-4 absolute top-6 left-6 z-10 flex items-center gap-2">
            <GitBranch className="w-4 h-4" /> Neural Execution Graph
          </h3>
          <div className="absolute inset-0 bg-gradient-to-b from-aurora-blue/5 to-transparent pointer-events-none rounded-2xl" />
          <div className="flex-1 w-full h-full relative -mx-4 -mb-4 pt-8">
            <TaskDAG onNodeClick={(id) => onOpenDetail(id)} tasks={tasks} />
          </div>
        </div>
      </motion.div>

      {/* Row 4: Cost, Activity, Health */}
      <motion.div variants={item} className="col-span-4 h-72">
        <SpotlightCard className="h-full">
          <CostBurnWidget />
        </SpotlightCard>
      </motion.div>
      <motion.div variants={item} className="col-span-4 h-72">
        <SpotlightCard className="h-full">
          <ActivityFeed />
        </SpotlightCard>
      </motion.div>
      <motion.div variants={item} className="col-span-4 h-72">
        <div className="spatial-panel flex flex-col gap-5 justify-center items-center h-full">
          {healthData.map(m => (
            <HealthRadial key={m.label} label={m.label} value={m.value} color={m.color} history={m.history24h} />
          ))}
        </div>
      </motion.div>

      {/* Row 5: Live Tasks */}
      <motion.div variants={item} className="col-span-12">
        <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 border-b border-border pb-2">Live Tasks</h3>
        <AnimatePresence mode="popLayout">
          {tasks.map((run, i) => (
            <motion.div
              key={run.id}
              variants={item}
              layout
              whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.03)' }}
              onClick={() => run.agentId && onOpenDetail(run.agentId)}
              className={cn(
                'spatial-panel p-4 flex items-center justify-between group mb-2 border hover:shadow-card transition-all cursor-pointer',
                statusStyles[run.status] || 'row-idle'
              )}
            >
              <div className="flex items-center gap-6 flex-1">
                <span className="font-medium text-sm text-text-primary w-32 truncate tracking-wide">{run.agentName}</span>
                <span className="text-sm font-medium w-64 text-text-primary truncate">{run.name}</span>
              </div>
              <div className="flex items-center gap-6">
                <span className={cn('text-xs font-bold uppercase tracking-wider w-24 text-right', statusStyles[run.status]?.split(' ')[1])}>
                  {run.status}
                </span>
                <span className="font-mono text-xs text-text-muted tabular-nums w-16 text-right">
                  {run.durationMs < 1000 ? `${run.durationMs}ms` : `${(run.durationMs / 1000).toFixed(1)}s`}
                </span>
                <span className="font-mono text-[11px] text-text-muted w-16 text-right">
                  ${run.costUsd.toFixed(3)}
                </span>
                {run.status === 'error' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); retryTask(run.id).catch(console.error); }}
                    className="p-1.5 text-aurora-rose hover:text-aurora-rose hover:bg-white/5 rounded transition-all"
                    title="Retry Task"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <CreateAgentModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(optimisticAgent) => addOptimistic?.(optimisticAgent)}
      />
    </motion.div>
  );
}
