import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';
import { container, item as itemVariant } from '../utils/variants';
import { AgentVitalCard } from '../components/AgentVitalCard';
import { CreateAgentModal } from '../components/CreateAgentModal';
import { TaskDAG } from '../components/TaskDAG';
import Globe from 'react-globe.gl';
import { GitBranch, Edit2, RotateCcw, Trash2, Plus, Loader2 } from 'lucide-react';
import { WidgetActions } from '../components/WidgetActions';

const statusStyles = {
  success: 'row-success text-aurora-green border-aurora-green/20',
  completed: 'row-success text-aurora-green border-aurora-green/20',
  error: 'row-error text-aurora-rose border-aurora-rose/20',
  running: 'row-running text-aurora-amber border-aurora-amber/20',
  idle: 'row-idle text-text-muted border-hairline',
  pending: 'row-idle text-text-muted border-hairline'
};

const MapWidget = () => {
  const [arcsData] = useState(() => {
    const N = 24;
    return [...Array(N).keys()].map(() => ({
      startLat: (Math.random() - 0.5) * 180,
      startLng: (Math.random() - 0.5) * 360,
      endLat: (Math.random() - 0.5) * 180,
      endLng: (Math.random() - 0.5) * 360,
      color: ['#00D9C8', '#a78bfa', '#60a5fa'][Math.floor(Math.random() * 3)]
    }));
  });

  return (
    <div className="col-span-12 ui-shell relative overflow-hidden h-[340px] flex items-center justify-center border-aurora-teal/20 shadow-glow-teal group">
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h3 className="text-xl font-bold text-text-primary tracking-wide">Global Protocol Trajectory</h3>
        <p className="text-sm font-mono text-aurora-teal mt-1">24 Active Satellite Downlinks</p>
      </div>
      <div className="absolute inset-0 -top-16 z-0 opacity-90 cursor-move mix-blend-screen scale-11 origin-center transition-transform duration-1000 group-hover:scale-125">
        <Globe
          width={1200}
          height={480}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          arcsData={arcsData}
          arcColor="color"
          arcDashLength={0.4}
          arcDashGap={2}
          arcDashAnimateTime={1500}
          backgroundColor="rgba(0,0,0,0)"
          atmosphereColor="#00D9C8"
          atmosphereAltitude={0.15}
        />
      </div>
    </div>
  );
};

export function FleetOperationsView({ agents, tasks, logData, loading, usingMock, addOptimistic, onOpenDetail, onQuickDispatch }) {
  const [createModalOpen, setCreateModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-aurora-teal animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar pb-12">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-1">Fleet Operations</h2>
          <div className="flex items-center gap-2">
            <p className="text-sm text-text-muted">Master overview of active agents, neural pipelines, and live tasks.</p>
            {usingMock && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-aurora-amber/10 text-aurora-amber border border-aurora-amber/20 font-mono">
                MOCK DATA
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCreateModalOpen(true)}
            className="ui-button-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-glow-teal"
          >
            <Plus className="w-4 h-4" />
            Deploy Agent
          </motion.button>

          {(() => {
            const active  = agents.filter(a => a.status === 'processing').length;
            const idle    = agents.filter(a => a.status === 'idle').length;
            const errored = agents.filter(a => a.status === 'error').length;
            return (
              <>
                <div className="flex items-center gap-2 px-4 py-2 ui-card-row">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aurora-teal opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-aurora-teal" />
                  </span>
                  <span className="text-sm font-mono text-aurora-teal">{active} Active</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 ui-card-row">
                  <span className="w-2 h-2 rounded-full bg-text-muted" />
                  <span className="text-sm font-mono text-text-muted">{idle} Idle</span>
                </div>
                {errored > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 ui-card-row border border-aurora-rose/30 shadow-elevated">
                    <span className="w-2 h-2 rounded-full bg-aurora-rose" />
                    <span className="text-sm font-mono text-aurora-rose font-semibold">{errored} Error</span>
                  </div>
                )}
              </>
            );
          })()}
          <div className="flex items-center gap-2 px-4 py-2 border border-aurora-teal/30 bg-aurora-teal/10 rounded-xl shadow-glow-teal ui-card-row">
            <span className="text-sm font-mono font-bold text-aurora-teal">{agents.length} Total</span>
          </div>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-8">
        
        <motion.div variants={itemVariant} className="flex flex-col gap-4">
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border pb-2">Active Workforce</h3>
          <div className="grid grid-cols-12 gap-5 pb-6 pl-14 pr-6 pt-3 overflow-visible">
            <AnimatePresence mode="popLayout">
                {agents.map(a => (
                <motion.div key={a.id} variants={itemVariant} layout layoutId={`fleet-${a.id}`} className="col-span-4 h-64 relative z-10 hover:z-50 overflow-visible">
                    <AgentVitalCard
                      agent={a}
                      onOpenDetail={() => onOpenDetail(a.id)}
                      onQuickDispatch={() => onQuickDispatch(a.id)}
                      allAgents={agents}
                      activityLog={logData}
                    />
                </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div variants={itemVariant} className="grid grid-cols-12 gap-6 min-h-[380px]">
          <div className="col-span-8 ui-shell p-6 flex flex-col relative group">
            <WidgetActions onExpand={() => {}} onConfigure={() => {}} onRemove={() => {}} />
            <h3 className="text-xs uppercase tracking-widest text-text-muted mb-4 absolute top-6 left-6 z-10 flex items-center gap-2">
              <GitBranch className="w-4 h-4" /> Neural Execution Graph
            </h3>
            <div className="absolute inset-0 bg-gradient-to-b from-aurora-blue/5 to-transparent pointer-events-none" />
            <div className="flex-1 w-full h-full relative -mx-4 -mb-4 pt-8">
              <TaskDAG onNodeClick={(id) => onOpenDetail(id)} tasks={tasks} />
            </div>
          </div>

          <div className="col-span-4 ui-shell p-6 flex flex-col justify-between group overflow-hidden relative">
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
               <div className="w-full h-1.5 ui-surface-dim rounded-full overflow-hidden border border-hairline">
                 <motion.div initial={{ width: 0 }} animate={{ width: '62%' }} transition={{ duration: 1.5, delay: 0.2 }} className="h-full bg-aurora-blue shadow-glow-blue" />
               </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariant}>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 border-b border-border pb-2 mt-4">Live Tasks</h3>
          <AnimatePresence mode="popLayout">
            {tasks.map((run, i) => (
              <motion.div
                key={run.id}
                variants={itemVariant}
                layout
                whileHover={{ x: 4, backgroundColor: 'var(--color-panel-soft)' }}
                onClick={() => run.agentId && onOpenDetail(run.agentId)}
                className={cn(
                  "ui-card-row p-4 flex items-center justify-between group mb-2 border hover:shadow-card transition-all cursor-pointer",
                  statusStyles[run.status] || "row-idle"
                )}
              >
                <div className="flex items-center gap-6 flex-1">
                  <span className="font-mono text-xs text-text-disabled w-16 opacity-50">10:0{4 + i}:22</span>
                  <span className="font-medium text-sm text-text-primary w-32 truncate tracking-wide">{run.agentName}</span>
                  <span className="px-3 py-1 text-[10px] font-mono text-text-muted bg-canvas border border-hairline rounded">
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

                  <div className="flex items-center gap-2 border-l border-hairline pl-4 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 text-text-muted hover:text-[#a78bfa] hover:ui-panel-soft rounded transition-all" title="Edit Task Config"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 text-text-muted hover:text-aurora-amber hover:ui-panel-soft rounded transition-all" title="Force Restart"><RotateCcw className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 text-text-muted hover:text-aurora-rose hover:ui-panel-soft rounded transition-all" title="Terminate Data"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

      </motion.div>

      <CreateAgentModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(optimisticAgent) => {
          addOptimistic(optimisticAgent);
        }}
      />
    </div>
  );
}
