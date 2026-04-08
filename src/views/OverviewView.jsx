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
import { MemorySparkmap } from '../components/MemorySparkmap';
import { HealthRadial } from '../components/HealthRadial';
import { CreateAgentModal } from '../components/CreateAgentModal';
import { Plus, GitBranch, Edit2, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { WidgetActions } from '../components/WidgetActions';
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
  const { data: healthData } = useHealthMetrics();
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
      {/* Row 1: System pulse */}
      <motion.div variants={item} className="col-span-12">
        <SpotlightCard>
          <NeuralPulse systemHealth={94} agentCount={activeAgents} />
        </SpotlightCard>
      </motion.div>

      {/* Fleet status bar */}
      <motion.div variants={item} className="col-span-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 spatial-panel">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aurora-teal opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-aurora-teal" />
            </span>
            <span className="text-xs font-mono text-aurora-teal">{activeAgents} Active</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 spatial-panel">
            <span className="w-2 h-2 rounded-full bg-text-muted" />
            <span className="text-xs font-mono text-text-muted">{idleAgents} Idle</span>
          </div>
          {errorAgents > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 spatial-panel border border-aurora-rose/30">
              <span className="w-2 h-2 rounded-full bg-aurora-rose animate-pulse" />
              <span className="text-xs font-mono text-aurora-rose font-semibold">{errorAgents} Error</span>
            </div>
          )}
          <div className="px-3 py-1.5 border border-aurora-teal/30 bg-aurora-teal/10 rounded-xl">
            <span className="text-xs font-mono font-bold text-aurora-teal">{agents.length} Total</span>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-aurora-teal text-black rounded-xl text-sm font-semibold hover:bg-aurora-teal/90 transition-colors shadow-glow-teal"
        >
          <Plus className="w-4 h-4" />
          Deploy Agent
        </motion.button>
      </motion.div>

      {/* Row 2: Agent cards — AoE unit-selection grid */}
      <motion.div variants={item} className="col-span-12 overflow-visible">
        <div className="grid grid-cols-12 gap-5">
          <AnimatePresence mode="popLayout">
            {agents.map(a => (
              <motion.div key={a.id} variants={item} layout layoutId={a.id} className="col-span-4 relative z-10 hover:z-50 overflow-visible">
                <AgentVitalCard
                  agent={a}
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

      {/* Row 3: DAG + Throughput */}
      <motion.div variants={item} className="col-span-8 h-[380px]">
        <div className="spatial-panel p-6 h-full flex flex-col relative group">
          <WidgetActions onExpand={() => {}} onConfigure={() => {}} onRemove={() => {}} />
          <h3 className="text-xs uppercase tracking-widest text-text-muted mb-4 absolute top-6 left-6 z-10 flex items-center gap-2">
            <GitBranch className="w-4 h-4" /> Neural Execution Graph
          </h3>
          <div className="absolute inset-0 bg-gradient-to-b from-aurora-blue/5 to-transparent pointer-events-none rounded-2xl" />
          <div className="flex-1 w-full h-full relative -mx-4 -mb-4 pt-8">
            <TaskDAG onNodeClick={(id) => onOpenDetail(id)} tasks={tasks} />
          </div>
        </div>
      </motion.div>
      <motion.div variants={item} className="col-span-4 h-[380px]">
        <div className="spatial-panel p-6 h-full flex flex-col justify-between group overflow-hidden relative">
          <WidgetActions onExpand={() => {}} onConfigure={() => {}} onRemove={() => {}} />
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-aurora-blue/10 rounded-full blur-3xl pointer-events-none" />
          <div>
            <h3 className="text-xs uppercase tracking-widest text-text-muted mb-2">Live Throughput</h3>
            <div className="text-4xl font-mono text-aurora-blue mt-2 font-bold tracking-tight">419.2</div>
            <p className="text-xs text-text-body mt-2">Tokens resolved per compute cycle.</p>
          </div>
          <div className="mt-auto">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-text-muted font-medium">Pipeline Saturation</span>
              <span className="text-aurora-blue font-mono">62%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-raised rounded-full overflow-hidden border border-white/5">
              <motion.div initial={{ width: 0 }} animate={{ width: '62%' }} transition={{ duration: 1.5, delay: 0.2 }} className="h-full bg-aurora-blue shadow-glow-blue" />
            </div>
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
        <div className="spatial-panel flex flex-col gap-5 justify-center items-center h-full group relative">
          <WidgetActions onExpand={() => {}} onConfigure={() => {}} onRemove={() => {}} />
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
                <span className="font-mono text-xs text-text-disabled w-16 opacity-50">{`10:${String(4 + i).padStart(2, '0')}:22`}</span>
                <span className="font-medium text-sm text-text-primary w-32 truncate tracking-wide">{run.agentName}</span>
                <span className="px-3 py-1 text-[10px] font-mono text-text-muted bg-canvas border border-white/5 rounded">
                  {run.model || 'claude-opus-4-6'}
                </span>
                <span className="text-sm font-medium w-64 text-text-primary truncate">{run.name}</span>
              </div>
              <div className="flex items-center gap-8">
                <span className={cn('text-xs font-bold uppercase tracking-wider w-24 text-right', statusStyles[run.status]?.split(' ')[1])}>
                  {run.status}
                </span>
                <span className="font-mono text-xs text-text-muted tabular-nums w-12 text-right opacity-70">
                  {run.durationMs < 1000 ? `${run.durationMs}ms` : `${(run.durationMs / 1000).toFixed(1)}s`}
                </span>
                <span className="font-mono text-[11px] text-text-muted w-16 text-right">
                  420 tok
                </span>
                <span className="font-mono text-[11px] text-text-muted w-16 text-right opacity-50">
                  ${run.costUsd.toFixed(3)}
                </span>
                <div className="flex items-center gap-2 border-l border-white/10 pl-4 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => e.stopPropagation()} className="p-1.5 text-text-muted hover:text-[#a78bfa] hover:bg-white/5 rounded transition-all" title="Edit Task Config"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={(e) => e.stopPropagation()} className="p-1.5 text-text-muted hover:text-aurora-amber hover:bg-white/5 rounded transition-all" title="Force Restart"><RotateCcw className="w-3.5 h-3.5" /></button>
                  <button onClick={(e) => e.stopPropagation()} className="p-1.5 text-text-muted hover:text-aurora-rose hover:bg-white/5 rounded transition-all" title="Terminate"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
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
