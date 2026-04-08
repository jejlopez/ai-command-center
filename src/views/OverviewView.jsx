import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { container, item } from '../utils/variants';
import { fetchAgents, fetchTasks, fetchActivityLog, fetchCostData, fetchHealthMetrics } from '../lib/api';
import { SpotlightCard } from '../components/SpotlightCard';
import { NeuralPulse } from '../components/NeuralPulse';
import { AgentVitalCard } from '../components/AgentVitalCard';
import { CostBurnWidget } from '../components/CostBurnWidget';
import { ActivityFeed } from '../components/ActivityFeed';
import { TaskDAG } from '../components/TaskDAG';
import { MemorySparkmap } from '../components/MemorySparkmap';
import { HealthRadial } from '../components/HealthRadial';
import { Crown, ArrowUpRight, Zap, AlertTriangle, Loader2 } from 'lucide-react';
import { WidgetActions } from '../components/WidgetActions';

// Commander's delegation tree for overview
function DelegationWidget({ agents }) {
  const commander = agents.find(a => a.role === 'commander');
  const subagents = agents.filter(a => a.parentId === commander?.id);

  return (
    <div className="spatial-panel p-5 h-full flex flex-col group relative">
      <WidgetActions onExpand={() => {}} onConfigure={() => {}} onRemove={() => {}} />
      <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted mb-4 font-semibold">
        Delegation Tree
      </div>

      {/* Commander */}
      {commander && (
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/[0.05]">
          <Crown className="w-4 h-4 text-aurora-amber shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text-primary">{commander.name}</div>
            <div className="text-[10px] font-mono text-text-disabled">{commander.model}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-aurora-teal animate-pulse" />
            <span className="text-[10px] font-mono text-aurora-teal">Active</span>
          </div>
        </div>
      )}

      {/* Sub-agents */}
      <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
        {subagents.map(agent => {
          const statusColor = {
            processing: 'bg-aurora-teal',
            idle: 'bg-text-muted',
            error: 'bg-aurora-rose',
          }[agent.status] || 'bg-text-muted';

          return (
            <div key={agent.id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] rounded-lg border border-white/[0.04] hover:border-white/[0.08] transition-colors">
              <ArrowUpRight className="w-3 h-3 text-text-disabled shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-primary">{agent.name}</span>
                  <span className="text-[9px] font-mono text-text-disabled uppercase">{agent.role}</span>
                </div>
                <div className="text-[10px] font-mono text-text-disabled mt-0.5">{agent.model}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-mono text-text-disabled">{agent.taskCompletion}%</span>
                <div className={`w-1.5 h-1.5 rounded-full ${statusColor} ${agent.status === 'processing' ? 'animate-pulse' : ''}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Quick stats summary
function QuickStats({ agents, costTotal }) {
  const activeCount = agents.filter(a => a.status === 'processing').length;
  const errorCount = agents.filter(a => a.status === 'error').length;
  const totalTokens = agents.reduce((sum, a) => sum + (a.totalTokens || 0), 0);

  const stats = [
    { label: 'Active', value: activeCount, icon: Zap, color: 'text-aurora-teal' },
    { label: 'Errors', value: errorCount, icon: AlertTriangle, color: errorCount > 0 ? 'text-aurora-rose' : 'text-text-muted' },
    { label: 'Tokens', value: `${(totalTokens / 1000).toFixed(1)}k`, icon: null, color: 'text-text-primary' },
    { label: 'Cost', value: `$${costTotal}`, icon: null, color: 'text-aurora-amber' },
  ];

  return (
    <div className="spatial-panel p-5 h-full flex flex-col justify-between group relative">
      <WidgetActions onExpand={() => {}} onConfigure={() => {}} onRemove={() => {}} />
      <div className="text-[10px] uppercase tracking-[0.15em] text-text-muted mb-4 font-semibold">
        Session Stats
      </div>
      <div className="grid grid-cols-2 gap-4 flex-1">
        {stats.map(s => (
          <div key={s.label} className="flex flex-col justify-center">
            <div className="text-[10px] text-text-disabled uppercase tracking-wider mb-1">{s.label}</div>
            <div className={`text-2xl font-mono font-semibold font-tabular ${s.color}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OverviewView({ onOpenDetail }) {
  const [agents, setAgents]     = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [logData, setLogData]   = useState([]);
  const [cost, setCost]         = useState(null);
  const [health, setHealth]     = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [agentsData, tasksData, logEntries, costData, healthData] = await Promise.all([
        fetchAgents(),
        fetchTasks(),
        fetchActivityLog(),
        fetchCostData(),
        fetchHealthMetrics(),
      ]);
      if (!cancelled) {
        setAgents(agentsData);
        setTasks(tasksData);
        setLogData(logEntries);
        setCost(costData);
        setHealth(healthData);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-aurora-teal animate-spin" />
      </div>
    );
  }

  const activeAgents = agents.filter(a => a.status === 'processing').length;

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

      {/* Row 2: Agent cards */}
      <motion.div variants={item} className="col-span-12 -mx-8 px-8 overflow-visible">
        <div className="grid grid-cols-12 gap-5">
          <AnimatePresence mode="popLayout">
            {agents.map(a => (
              <motion.div key={a.id} variants={item} layout layoutId={a.id} className="col-span-2 relative z-10 hover:z-50">
                <AgentVitalCard agent={a} onLogClick={() => onOpenDetail(a.id)} allAgents={agents} activityLog={logData} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Row 3: Cost, Activity, Task DAG */}
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
          <TaskDAG onNodeClick={onOpenDetail} tasks={tasks} />
        </SpotlightCard>
      </motion.div>

      {/* Row 4: Memory, Health, Delegation, Stats */}
      <motion.div variants={item} className="col-span-4 h-[300px]">
        <SpotlightCard className="h-full">
          <MemorySparkmap />
        </SpotlightCard>
      </motion.div>
      <motion.div variants={item} className="col-span-2 h-[300px]">
        <div className="spatial-panel flex flex-col gap-5 justify-center items-center h-full group relative">
          <WidgetActions onExpand={() => {}} onConfigure={() => {}} onRemove={() => {}} />
          {health.map(m => (
            <HealthRadial key={m.label} label={m.label} value={m.value} color={m.color} history={m.history24h} />
          ))}
        </div>
      </motion.div>
      <motion.div variants={item} className="col-span-3 h-[300px]">
        <DelegationWidget agents={agents} />
      </motion.div>
      <motion.div variants={item} className="col-span-3 h-[300px]">
        <QuickStats agents={agents} costTotal={cost?.total ?? 0} />
      </motion.div>
    </motion.div>
  );
}
