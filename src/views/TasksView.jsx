import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';
import { container, item } from '../utils/variants';
import { TaskDAG } from '../components/TaskDAG';
import { GitBranch, Activity, Zap, CheckCircle2, Edit2, RotateCcw, Trash2 } from 'lucide-react';
import { WidgetActions } from '../components/WidgetActions';
import { useTasks } from '../utils/useSupabase';

const statusStyles = {
  success: 'row-success text-aurora-green border-aurora-green/20',
  completed: 'row-success text-aurora-green border-aurora-green/20',
  error: 'row-error text-aurora-rose border-aurora-rose/20',
  running: 'row-running text-aurora-amber border-aurora-amber/20',
  idle: 'row-idle text-text-muted border-white/5',
  pending: 'row-idle text-text-muted border-white/5'
};

export function TasksView({ onOpenDetail }) {
  const { tasks } = useTasks();
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const active = tasks.filter((task) => task.status === 'running').length;

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar pb-12">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-1">Pipeline Orchestration</h2>
          <p className="text-sm text-text-muted">High-fidelity tracing and task pipeline visualization.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 spatial-panel">
            <CheckCircle2 className="w-4 h-4 text-aurora-green" />
            <span className="text-sm font-mono text-text-primary">{tasks.length ? Math.round((completed / tasks.length) * 100) : 0}% success</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 spatial-panel">
            <Zap className="w-4 h-4 text-aurora-amber" />
            <span className="text-sm font-mono text-text-primary">{active} active tasks</span>
          </div>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-6">
        
        {/* Tier 1: Neural Task DAG */}
        <motion.div variants={item} className="grid grid-cols-12 gap-6 min-h-[380px]">
          <div className="col-span-8 spatial-panel p-6 flex flex-col relative group">
            <WidgetActions onExpand={() => {}} onConfigure={() => {}} onRemove={() => {}} />
            <h3 className="text-xs uppercase tracking-widest text-text-muted mb-4 absolute top-6 left-6 z-10 flex items-center gap-2">
              <GitBranch className="w-4 h-4" /> Neural Execution Graph
            </h3>
            <div className="absolute inset-0 bg-gradient-to-b from-aurora-blue/5 to-transparent pointer-events-none" />
            <div className="flex-1 w-full h-full relative -mx-4 -mb-4 pt-8">
              <TaskDAG onNodeClick={onOpenDetail} tasks={tasks} />
            </div>
          </div>

          <div className="col-span-4 spatial-panel p-6 flex flex-col justify-between group overflow-hidden relative">
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

        {/* Removed Thread Waterfall to unclutter the top of the Pipeline */}

        {/* Tier 3: High-Density Run Matrix */}
        <motion.div variants={item}>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 border-b border-border pb-2 mt-4">Live Tasks</h3>
          <AnimatePresence mode="popLayout">
            {tasks.map((run, i) => (
              <motion.div
                key={run.id}
                variants={item}
                layout
                whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.03)' }}
                onClick={() => run.agentId && onOpenDetail(run.agentId)}
                className={cn(
                  "spatial-panel p-4 flex items-center justify-between group cursor-pointer mb-2 border hover:shadow-card transition-all",
                  statusStyles[run.status] || "row-idle"
                )}
              >
                <div className="flex items-center gap-6 flex-1">
                  <span className="font-mono text-xs text-text-disabled w-16 opacity-50">10:0{4 + i}:22</span>
                  <span className="font-medium text-sm text-text-primary w-32 truncate tracking-wide">{run.agentName}</span>
                  <span className="px-3 py-1 text-[10px] font-mono text-text-muted bg-canvas border border-white/5 rounded">
                    claude-opus-4-6
                  </span>
                  <span className="text-sm font-medium w-64 text-text-primary truncate">{run.name}</span>
                </div>

                <div className="flex items-center gap-8">
                  <span className={cn("text-xs font-bold uppercase tracking-wider w-24 text-right", statusStyles[run.status]?.split(' ')[1])}>
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

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 border-l border-white/10 pl-4 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 text-text-muted hover:text-[#a78bfa] hover:bg-white/5 rounded transition-all" title="Edit Task Config"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 text-text-muted hover:text-aurora-amber hover:bg-white/5 rounded transition-all" title="Force Restart"><RotateCcw className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 text-text-muted hover:text-aurora-rose hover:bg-white/5 rounded transition-all" title="Terminate"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </motion.div>
            ))}
            {tasks.length === 0 && (
              <div className="spatial-panel p-6 text-sm text-text-muted">
                No tasks have been created for this account yet.
              </div>
            )}
          </AnimatePresence>
        </motion.div>

      </motion.div>
    </div>
  );
}
