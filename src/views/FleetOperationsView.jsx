import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tasks as initialTasks, agents } from '../utils/mockData';
import { cn } from '../utils/cn';
import { container, item as itemVariant } from '../utils/variants';
import { AgentVitalCard } from '../components/AgentVitalCard';
import { TaskDAG } from '../components/TaskDAG';
import { GitBranch, Zap, CheckCircle2, Edit2, RotateCcw, Trash2, AlertTriangle, ChevronDown, Save } from 'lucide-react';
import { WidgetActions } from '../components/WidgetActions';

const statusStyles = {
  success: 'row-success text-aurora-green border-aurora-green/20',
  completed: 'row-success text-aurora-green border-aurora-green/20',
  error: 'row-error text-aurora-rose border-aurora-rose/20',
  running: 'row-running text-aurora-amber border-aurora-amber/20',
  idle: 'row-idle text-text-muted border-white/5',
  pending: 'row-idle text-text-muted border-white/5'
};


// ── Inline Edit Row ─────────────────────────────────────────────
function EditRow({ task, onSave, onCancel }) {
  const [name, setName] = useState(task.name);
  const [agentId, setAgentId] = useState(task.agentId);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="px-4 py-3 bg-white/[0.02] border border-aurora-violet/20 rounded-lg mb-2 flex items-end gap-4">
        {/* Task Name */}
        <div className="flex-1 min-w-0">
          <label className="text-[9px] uppercase tracking-[0.15em] text-text-disabled font-semibold mb-1 block">Task Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.07] rounded-md text-xs font-mono text-text-primary focus:border-aurora-teal/40 outline-none transition-colors"
          />
        </div>

        {/* Agent Assignment */}
        <div className="w-44 shrink-0">
          <label className="text-[9px] uppercase tracking-[0.15em] text-text-disabled font-semibold mb-1 block">Agent</label>
          <div className="relative">
            <select
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
              className="w-full appearance-none px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.07] rounded-md text-xs font-mono text-text-primary focus:border-aurora-teal/40 outline-none transition-colors pr-7"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-text-disabled absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
          <button
            onClick={() => onSave({ name, agentId, agentName: agents.find(a => a.id === agentId)?.name || task.agentName })}
            className="flex items-center gap-1 px-3 py-1.5 bg-aurora-teal text-[#000] text-[10px] font-bold rounded-md hover:bg-aurora-teal/90 transition-colors"
          >
            <Save className="w-3 h-3" /> Save
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 border border-white/[0.07] text-text-muted text-[10px] font-medium rounded-md hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function FleetOperationsView({ onOpenDetail }) {
  const [taskList, setTaskList] = useState(initialTasks);
  const [editingId, setEditingId] = useState(null);
  const [confirmTerminate, setConfirmTerminate] = useState(null);

  function handleRestart(taskId) {
    setTaskList(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: 'running', durationMs: 0 } : t
    ));
  }

  function handleTerminate(taskId) {
    setTaskList(prev => prev.filter(t => t.id !== taskId));
    setConfirmTerminate(null);
  }

  function handleEditSave(taskId, updates) {
    setTaskList(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...updates } : t
    ));
    setEditingId(null);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar pb-12">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-1">Fleet Operations</h2>
          <p className="text-sm text-text-muted">Master overview of active agents, neural pipelines, and live tasks.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 spatial-panel">
            <CheckCircle2 className="w-4 h-4 text-aurora-green" />
            <span className="text-sm font-mono text-text-primary">98.4% SNR</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 spatial-panel">
            <Zap className="w-4 h-4 text-aurora-amber" />
            <span className="text-sm font-mono text-text-primary">2,404 ops/sec</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border border-aurora-teal/30 bg-aurora-teal/10 rounded-xl shadow-glow-teal">
            <span className="text-sm font-mono font-bold text-aurora-teal">{agents.length} Active Workforce</span>
          </div>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-8">

        {/* Tier 1: Agent Fleet Grid */}
        <motion.div variants={itemVariant} className="flex flex-col gap-4">
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider border-b border-border pb-2">Active Workforce</h3>
          {/* -mx-8 px-8 matches App.jsx content padding to prevent hover scale clipping */}
          <div className="grid grid-cols-12 gap-5 px-8 -mx-8 pb-6 pt-2 overflow-visible">
            <AnimatePresence mode="popLayout">
                {agents.map(a => (
                <motion.div key={a.id} variants={itemVariant} layout layoutId={`fleet-${a.id}`} className="col-span-4 h-64 relative z-10 hover:z-50">
                    <AgentVitalCard agent={a} onLogClick={() => onOpenDetail(a.id)} />
                </motion.div>
                ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Tier 2: Neural Task DAG */}
        <motion.div variants={itemVariant} className="grid grid-cols-12 gap-6 min-h-[380px]">
          <div className="col-span-8 spatial-panel p-6 flex flex-col relative group">
            <WidgetActions onExpand={() => {}} onConfigure={() => {}} onRemove={() => {}} />
            <h3 className="text-xs uppercase tracking-widest text-text-muted mb-4 absolute top-6 left-6 z-10 flex items-center gap-2">
              <GitBranch className="w-4 h-4" /> Neural Execution Graph
            </h3>
            <div className="absolute inset-0 bg-gradient-to-b from-aurora-blue/5 to-transparent pointer-events-none" />
            <div className="flex-1 w-full h-full relative -mx-4 -mb-4 pt-8">
              <TaskDAG onNodeClick={(id) => onOpenDetail(id)} />
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

        {/* Tier 3: Live Tasks */}
        <motion.div variants={itemVariant}>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 border-b border-border pb-2 mt-4">Live Tasks</h3>

          {taskList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-text-disabled">
              <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
              <span className="text-sm">No active tasks</span>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {taskList.map((run, i) => (
              <motion.div
                key={run.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0, transition: { duration: 0.25 } }}
              >
                {/* Task Row */}
                <div
                  onClick={() => run.agentId && onOpenDetail(run.agentId)}
                  className={cn(
                    "spatial-panel p-4 flex items-center justify-between group mb-2 border hover:shadow-card transition-all cursor-pointer",
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

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 border-l border-white/10 pl-4 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingId(editingId === run.id ? null : run.id); setConfirmTerminate(null); }}
                        className={cn(
                          "p-1.5 rounded transition-all",
                          editingId === run.id
                            ? "text-aurora-violet bg-aurora-violet/10"
                            : "text-text-muted hover:text-[#a78bfa] hover:bg-white/5"
                        )}
                        title="Edit Task Config"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestart(run.id); }}
                        className="p-1.5 text-text-muted hover:text-aurora-amber hover:bg-white/5 rounded transition-all"
                        title="Restart Task"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmTerminate(confirmTerminate === run.id ? null : run.id); setEditingId(null); }}
                        className={cn(
                          "p-1.5 rounded transition-all",
                          confirmTerminate === run.id
                            ? "text-aurora-rose bg-aurora-rose/10"
                            : "text-text-muted hover:text-aurora-rose hover:bg-white/5"
                        )}
                        title="Terminate Task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Terminate Confirmation — inline below row */}
                <AnimatePresence>
                  {confirmTerminate === run.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 py-3 mb-2 bg-aurora-rose/[0.04] border border-aurora-rose/20 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-aurora-rose shrink-0" />
                          <span className="text-xs text-text-primary">
                            Terminate <span className="font-mono font-bold text-aurora-rose">{run.name}</span>? This cannot be undone.
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmTerminate(null); }}
                            className="px-3 py-1.5 border border-white/[0.07] text-text-muted text-[10px] font-medium rounded-md hover:bg-white/[0.04] transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleTerminate(run.id); }}
                            className="px-3 py-1.5 bg-aurora-rose text-white text-[10px] font-bold rounded-md hover:bg-aurora-rose/90 transition-colors"
                          >
                            Terminate Task
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Edit Row — inline below row */}
                <AnimatePresence>
                  {editingId === run.id && (
                    <EditRow
                      task={run}
                      onSave={(updates) => handleEditSave(run.id, updates)}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

      </motion.div>
    </div>
  );
}
