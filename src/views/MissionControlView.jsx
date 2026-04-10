/**
 * Mission Control — Production View
 * Unified command center: Operations / Planner / Approvals
 * Real data from api.js and shared command-state surfaces
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Target, Clock, Zap, ShieldCheck, AlertTriangle, X,
  StopCircle, RotateCcw, Copy, CheckCircle2, XCircle,
  FileText, Brain, TrendingUp, Calendar, Repeat, Ban,
  DollarSign, Timer, GitBranch, Sparkles,
  Radio, Lock, Send, Archive, Eye, AlarmClock,
  ChevronDown, Bookmark, Plus, Loader2,
} from 'lucide-react';
import { cn } from '../utils/cn';
import {
  fetchAgents, fetchTasks, fetchActivityLog,
  fetchPendingReviews, fetchCompletedOutputs,
  approveReview, rejectReview, retryTask, stopTask,
  approveMissionTask, cancelMissionTask,
  subscribeToPendingReviews,
  subscribeToTasks,
  fetchTaskNotes, createTaskNote,
  acknowledgeItem, reopenReview, snoozeReview,
  fetchSchedules, toggleSchedule, dispatchFromSchedule,
  previewMissionPlan, createMission, updateMissionBranchRouting, updateMissionBranchDependencies,
} from '../lib/api';
import { useSystemState } from '../context/SystemStateContext';
import { MissionCreatorPanel } from '../components/mission/MissionCreatorPanel';
import { CommandDeckHero } from '../components/command/CommandDeckHero';
import { AnimatedNumber } from '../components/command/AnimatedNumber';
import { CommandSectionHeader } from '../components/command/CommandSectionHeader';
import { useLearningMemory } from '../utils/useLearningMemory';
import { DoctrineCards } from '../components/command/DoctrineCards';
import { TruthAuditStrip } from '../components/command/TruthAuditStrip';
import { useCommandCenterTruth } from '../utils/useCommandCenterTruth';
import { useConnectedSystems } from '../utils/useSupabase';
import { ReactorCoreBoard } from '../components/command/ReactorCoreBoard';
import { CommandTimelineRail } from '../components/command/CommandTimelineRail';
import { TacticalInterventionConsole } from '../components/command/TacticalInterventionConsole';
import { buildTimelineEntries } from '../utils/buildCommandTimeline';
import { TaskDAG } from '../components/TaskDAG';
import { getWorkflowMeta } from '../utils/missionLifecycle';
import { parseDoctrineFeedbackLogs, parseOutcomeScoreLogs } from '../utils/commanderAnalytics';

// ═══════════════════════════════════════════════════════════════
// UI ATOMS
// ═══════════════════════════════════════════════════════════════

function AgentAvatar({ agent, name, size = 'sm' }) {
  const n = agent?.name || name || '?';
  const c = agent?.color || '#60a5fa';
  const big = size === 'lg';
  return (
    <div className="flex items-center gap-2">
      <div className={cn("rounded-full flex items-center justify-center font-bold shrink-0 relative ring-1 ring-white/10", big ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-[10px]')}
        style={{ backgroundColor: `${c}15`, color: c }}>
        {n[0]}
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-canvas" style={{ backgroundColor: c }} />
      </div>
      {big && <div><span className="text-sm font-semibold text-text-primary">{n}</span>{agent?.role && <span className="text-[10px] text-text-muted block font-mono">{agent.role}</span>}</div>}
      {!big && <span className="text-[11px] font-medium text-text-muted">{n}</span>}
    </div>
  );
}

function ModelChip({ model }) {
  if (!model) return null;
  return <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-surface-raised text-text-muted border border-border">{model}</span>;
}

function PriBadge({ v }) {
  if (v == null) return null;
  const c = v >= 8 ? '#fb7185' : v >= 5 ? '#fbbf24' : '#34d399';
  return (<div className="flex items-center gap-1"><div className="w-8 h-1.5 rounded-full bg-surface-raised overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(v*10,100)}%`, backgroundColor: c }} /></div><span className="text-[9px] font-mono font-bold" style={{ color: c }}>{v}</span></div>);
}

function formatTaskMoment(task) {
  const base = task.startedAt || task.runAt || task.createdAt;
  if (!base) return null;
  const date = new Date(base);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatProgress(task) {
  if (task.progressPercent == null) return null;
  return `${Math.max(0, Math.min(100, task.progressPercent))}%`;
}

function getDependencySummary(task, tasks) {
  const dependencies = (task.dependsOn || [])
    .map((dependencyId) => tasks.find((candidate) => candidate.id === dependencyId))
    .filter(Boolean);
  const unlocks = tasks.filter((candidate) => (candidate.dependsOn || []).includes(task.id));
  return { dependencies, unlocks };
}

function wouldCreateDependencyCycle(tasks, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return true;
  const visited = new Set();
  const stack = [sourceId];

  while (stack.length) {
    const currentId = stack.pop();
    if (!currentId || visited.has(currentId)) continue;
    if (currentId === targetId) return true;
    visited.add(currentId);
    const currentTask = tasks.find((task) => task.id === currentId);
    (currentTask?.dependsOn || []).forEach((dependencyId) => stack.push(dependencyId));
  }

  return false;
}

const stColor = {
  queued:              { bg: 'bg-aurora-blue/10', tx: 'text-aurora-blue', lb: 'Queued' },
  running:             { bg: 'bg-aurora-amber/10', tx: 'text-aurora-amber', lb: 'Running' },
  done:                { bg: 'bg-aurora-green/10', tx: 'text-aurora-green', lb: 'Done' },
  completed:           { bg: 'bg-aurora-green/10', tx: 'text-aurora-green', lb: 'Done' },
  blocked:             { bg: 'bg-aurora-rose/10', tx: 'text-aurora-rose', lb: 'Blocked' },
  cancelled:           { bg: 'bg-white/5', tx: 'text-text-muted', lb: 'Cancelled' },
  failed:              { bg: 'bg-aurora-rose/10', tx: 'text-aurora-rose', lb: 'Failed' },
  error:               { bg: 'bg-aurora-rose/10', tx: 'text-aurora-rose', lb: 'Failed' },
  pending:             { bg: 'bg-aurora-blue/10', tx: 'text-aurora-blue', lb: 'Queued' },
  needs_approval:      { bg: 'bg-aurora-amber/10', tx: 'text-aurora-amber', lb: 'Approval' },
  idle:                { bg: 'bg-white/5', tx: 'text-text-muted', lb: 'Idle' },
  awaiting_approval:   { bg: 'bg-aurora-amber/10', tx: 'text-aurora-amber', lb: 'Review' },
  needs_intervention:  { bg: 'bg-aurora-rose/10', tx: 'text-aurora-rose', lb: 'Alert' },
  approved:            { bg: 'bg-aurora-green/10', tx: 'text-aurora-green', lb: 'Approved' },
  enabled:             { bg: 'bg-aurora-teal/10', tx: 'text-aurora-teal', lb: 'Active' },
  paused:              { bg: 'bg-white/5', tx: 'text-text-muted', lb: 'Paused' },
  success:             { bg: 'bg-aurora-green/10', tx: 'text-aurora-green', lb: 'Pass' },
};

const urgColors = { critical: '#fb7185', high: '#fbbf24', normal: '#00D9C8' };
const workflowTone = {
  teal: 'bg-aurora-teal/10 text-aurora-teal border-aurora-teal/20',
  amber: 'bg-aurora-amber/10 text-aurora-amber border-aurora-amber/20',
  blue: 'bg-aurora-blue/10 text-aurora-blue border-aurora-blue/20',
  rose: 'bg-aurora-rose/10 text-aurora-rose border-aurora-rose/20',
  green: 'bg-aurora-green/10 text-aurora-green border-aurora-green/20',
  slate: 'bg-white/5 text-text-muted border-white/10',
};

function Card({ children, className, onClick, selected }) {
  return (
    <Motion.button
      whileHover={{ y: -2, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className={cn("w-full text-left rounded-2xl border transition-all duration-200 relative overflow-hidden",
        selected ? "bg-surface-raised border-aurora-teal/30 shadow-glow-teal ring-1 ring-aurora-teal/20" : "bg-surface border-border hover:bg-surface-raised hover:border-border-strong",
        className)}
    >
      {children}
    </Motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// ITEM ROW (tasks + approvals)
// ═══════════════════════════════════════════════════════════════

function ItemRow({ item, agents, selected, onClick }) {
  const cfg = stColor[item.status] || stColor.pending;
  const workflow = getWorkflowMeta(item.workflowStatus);
  const isRun = item.status === 'running';
  const agent = agents.find(a => a.id === (item.agentId || item.agent_id));
  const isEphemeral = !!agent?.isEphemeral;
  const urgC = item.urgency ? urgColors[item.urgency] : null;
  const progress = formatProgress(item);
  const relativeTime = formatTaskMoment(item);
  const costLabel = item.actualCostCents != null
    ? `$${(item.actualCostCents / 100).toFixed(2)}`
    : item.estimatedCostCents != null
      ? `~$${(item.estimatedCostCents / 100).toFixed(2)}`
      : item.costUsd > 0
        ? `$${item.costUsd.toFixed(3)}`
        : null;

  return (
    <Card onClick={onClick} selected={selected} className={cn("p-4", urgC && "border-l-[3px]")} style={urgC ? { borderLeftColor: urgC } : undefined}>
      {urgC && <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ backgroundColor: urgC }} />}
      {isRun && <div className="absolute right-4 top-4"><span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-aurora-amber opacity-75" /><span className="relative rounded-full h-2 w-2 bg-aurora-amber" /></span></div>}

      <div className="flex items-center gap-3 mb-2">
        <AgentAvatar agent={agent} name={item.agentName} />
        <span className="text-[13px] font-semibold text-text-primary flex-1 truncate">{item.name || item.title}</span>
        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold", cfg.bg, cfg.tx)}>{cfg.lb}</span>
      </div>

      <div className="flex items-center gap-3 ml-8 flex-wrap">
        {agent?.model && <ModelChip model={agent.model} />}
        <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]", workflowTone[workflow.tone])}>
          {workflow.label}
        </span>
        {isEphemeral && <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-aurora-violet/10 text-aurora-violet border border-aurora-violet/20 uppercase">Spawned Specialist</span>}
        {item.agentRole && <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-white/[0.04] text-text-muted border border-border uppercase">{item.agentRole}</span>}
        {item.branchLabel && <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-white/[0.04] text-text-muted border border-border">{item.branchLabel}</span>}
        {item.mode && <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-surface-raised text-text-muted border border-border uppercase">{item.mode}</span>}
        {item.domain && <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-white/[0.04] text-text-muted border border-border uppercase">{item.domain}</span>}
        {item.durationMs > 0 && <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Timer className="w-3 h-3" />{item.durationMs < 1000 ? `${item.durationMs}ms` : `${(item.durationMs/1000).toFixed(1)}s`}</span>}
        {costLabel && <span className="text-[10px] font-mono text-text-disabled">{costLabel}</span>}
        {item.waitingMs > 0 && <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round(item.waitingMs/60000)}m waiting</span>}
        {relativeTime && <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Clock className="w-3 h-3" />{relativeTime}</span>}
        {item.status === 'needs_intervention' && <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-aurora-rose"><AlertTriangle className="w-3 h-3" />Needs Me</span>}
        {item.status === 'needs_approval' && <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-aurora-amber"><Lock className="w-3 h-3" />Needs Approval</span>}
      </div>

      {item.summary && <p className="text-[10px] text-text-muted mt-1.5 ml-8 leading-relaxed line-clamp-1">{item.summary}</p>}
      {!item.summary && item.description && <p className="text-[10px] text-text-muted mt-1.5 ml-8 leading-relaxed line-clamp-1">{item.description}</p>}
      {item.routingReason && <p className="ml-8 mt-1 text-[10px] font-mono text-text-disabled line-clamp-1">Route: {item.routingReason}</p>}
      {progress && (
        <div className="ml-8 mt-2">
          <div className="w-full h-1.5 rounded-full bg-surface-raised overflow-hidden">
            <div className="h-full rounded-full bg-aurora-teal transition-all" style={{ width: progress }} />
          </div>
        </div>
      )}
    </Card>
  );
}

function ApprovalCard({ item, agents, onClick, onApprove, onReject }) {
  const agent = agents.find(a => a.id === (item.agentId || item.agent_id));
  const isMissionApproval = item.status === 'needs_approval';

  return (
    <Motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.005 }}
      className="rounded-[24px] border border-aurora-amber/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(255,255,255,0.02))] p-4 shadow-[0_0_24px_rgba(251,191,36,0.08)]"
    >
      <div className="flex items-center gap-3 mb-2">
        <AgentAvatar agent={agent} name={item.agentName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text-primary truncate">{item.name || item.title}</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-aurora-amber/10 text-aurora-amber border border-aurora-amber/20">Approval Gate</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {agent?.model && <ModelChip model={agent.model} />}
            {item.mode && <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-white/[0.04] text-text-muted border border-border uppercase">{item.mode}</span>}
            <span className="text-[10px] font-mono text-text-disabled">{formatTaskMoment(item) || 'Awaiting review'}</span>
          </div>
        </div>
      </div>

      <p className="text-[12px] text-text-body leading-relaxed mb-3">{item.summary || item.description || 'Mission is paused at a decision gate and needs your call.'}</p>

      <div className="flex items-center gap-2">
        <button onClick={() => onApprove(item.id)} className="flex-1 h-10 rounded-xl bg-aurora-teal text-black text-[11px] font-bold uppercase shadow-glow-teal hover:bg-[#00ebd8] transition-colors">
          {isMissionApproval ? 'Approve & Continue' : 'Approve'}
        </button>
        <button onClick={() => onReject(item.id)} className="flex-1 h-10 rounded-xl border border-aurora-rose/30 bg-aurora-rose/5 text-aurora-rose text-[11px] font-bold uppercase hover:bg-aurora-rose/10 transition-colors">
          {isMissionApproval ? 'Cancel Mission' : 'Reject'}
        </button>
        <button onClick={onClick} className="px-3 h-10 rounded-xl border border-border bg-surface text-[11px] font-semibold text-text-muted hover:bg-surface-raised transition-colors">
          Open
        </button>
      </div>
    </Motion.div>
  );
}

function MissionGraphPanel({ tasks, agents, logs, selectedId, onSelect, onRetry, onStop, onApprove, onCancel, onUpdateBranchRouting, onUpdateBranchDependencies }) {
  const graphTaskSet = useMemo(() => {
    if (!tasks.length) return [];
    const selectedTask = tasks.find((task) => task.id === selectedId) || tasks[0];
    const rootMissionId = selectedTask?.rootMissionId || selectedTask?.id;
    return tasks.filter((task) => (task.rootMissionId || task.id) === rootMissionId);
  }, [selectedId, tasks]);

  const dagTasks = useMemo(() => (
    graphTaskSet.map((task) => ({
      ...task,
      status: getWorkflowMeta(task.workflowStatus).dagStatus,
    }))
  ), [graphTaskSet]);

  const spawnedSpecialists = useMemo(() => {
    const graphAgentIds = [...new Set(graphTaskSet.map((task) => task.agentId).filter(Boolean))];
    return agents.filter((agent) => graphAgentIds.includes(agent.id) && agent.isEphemeral);
  }, [agents, graphTaskSet]);
  const selectedTask = graphTaskSet.find((task) => task.id === selectedId) || graphTaskSet[0] || null;
  const [routingDraft, setRoutingDraft] = useState({ agentId: '', providerOverride: '', modelOverride: '' });
  const [routingSaving, setRoutingSaving] = useState(false);
  const [routingMessage, setRoutingMessage] = useState('');
  const [dependencyDraft, setDependencyDraft] = useState([]);
  const [dependencySaving, setDependencySaving] = useState(false);
  const [dependencyMessage, setDependencyMessage] = useState('');
  const selectedRootMissionId = selectedTask?.rootMissionId || selectedTask?.id || null;
  const selectedDependencySummary = selectedTask ? getDependencySummary(selectedTask, graphTaskSet) : { dependencies: [], unlocks: [] };
  const retirementEvents = (
    logs
      .filter((entry) => {
        const message = String(entry.message || '');
        return message.includes('[specialist-retired]')
          && (!selectedRootMissionId || message.includes(selectedRootMissionId));
      })
      .slice(-4)
      .reverse()
  );
  const outcomeHistory = parseOutcomeScoreLogs(logs).filter((entry) => !selectedRootMissionId || entry.rootMissionId === selectedRootMissionId).slice(0, 6);
  const doctrineFeedback = parseDoctrineFeedbackLogs(logs).filter((entry) => !selectedRootMissionId || entry.cleanMessage.includes(selectedRootMissionId)).slice(0, 6);
  const branchHistory = (
    logs
      .filter((entry) => {
        const message = String(entry.message || '');
        if (!selectedRootMissionId) return false;
        return (
          message.includes(selectedRootMissionId)
          && (message.includes('[branch-routing]') || message.includes('[branch-dependency]') || message.includes('[specialist-spawned]') || message.includes('[specialist-retired]') || message.includes('[specialist-persistent]') || message.includes('[outcome-score]') || message.includes('[doctrine-feedback]'))
        );
      })
      .slice(-8)
      .reverse()
  );
  const persistentSpecialists = agents.filter((agent) => !agent.isEphemeral && !['commander', 'executor'].includes(agent.role || ''));

  const branchSummary = useMemo(() => {
    const running = graphTaskSet.filter((task) => task.workflowStatus === 'running').length;
    const waiting = graphTaskSet.filter((task) => task.workflowStatus === 'waiting_on_human').length;
    const blocked = graphTaskSet.filter((task) => ['blocked', 'failed', 'cancelled'].includes(task.workflowStatus)).length;
    return { running, waiting, blocked };
  }, [graphTaskSet]);

  useEffect(() => {
    if (!selectedTask) return;
    setRoutingDraft({
      agentId: selectedTask.agentId || '',
      providerOverride: selectedTask.providerOverride || '',
      modelOverride: selectedTask.modelOverride || '',
    });
    setRoutingMessage('');
    setDependencyDraft(selectedTask.dependsOn || []);
    setDependencyMessage('');
  }, [selectedTask]);

  if (!graphTaskSet.length) {
    return (
      <div className="rounded-[24px] border border-white/[0.06] bg-black/15 px-5 py-6">
        <div className="text-sm font-semibold text-text-primary">No mission graph yet</div>
        <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
          Launch a mission or create the first delegated branch to see the parent/child execution graph appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-white/[0.06] bg-black/15 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Mission Graph</div>
          <div className="mt-2 text-lg font-semibold text-text-primary">Parent / child execution map</div>
          <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
            First canonical graph view for the selected mission root. Click a node to open the mission drawer.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Nodes', value: graphTaskSet.length, tone: 'text-text-primary' },
            { label: 'Running', value: branchSummary.running, tone: 'text-aurora-amber' },
            { label: 'Waiting', value: branchSummary.waiting + branchSummary.blocked, tone: branchSummary.blocked > 0 ? 'text-aurora-rose' : 'text-aurora-blue' },
          ].map((metric) => (
            <div key={metric.label} className="rounded-[18px] border border-white/8 bg-white/[0.02] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{metric.label}</div>
              <div className={cn('mt-2 text-lg font-semibold', metric.tone)}>{metric.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 h-[320px] rounded-[22px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.06),transparent_40%),rgba(255,255,255,0.02)] p-3">
        <TaskDAG
          tasks={dagTasks}
          onNodeClick={(task) => onSelect(task.id)}
          editable
          selectedNodeId={selectedTask?.id || null}
          onDependencyConnect={(sourceId, targetId) => {
            const targetTask = graphTaskSet.find((task) => task.id === targetId);
            if (!targetTask) return;
            if (wouldCreateDependencyCycle(graphTaskSet, sourceId, targetId)) {
              setDependencyMessage('That dependency would create a cycle. Choose a branch that does not already trace back to this node.');
              return;
            }
            const nextDependencies = [...new Set([...(targetTask.dependsOn || []), sourceId])];
            onUpdateBranchDependencies?.(targetId, nextDependencies);
            onSelect(targetId);
          }}
        />
      </div>
      {selectedTask && (
        <div className="mt-4 grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Branch Dependencies</div>
            <div className="mt-2 text-sm font-semibold text-text-primary">{selectedTask.name || selectedTask.title}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedDependencySummary.dependencies.length === 0 && (
                <span className="rounded-full border border-aurora-teal/20 bg-aurora-teal/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-teal">
                  Ready at launch
                </span>
              )}
              {selectedDependencySummary.dependencies.map((dependency) => (
                <span key={dependency.id} className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-text-body">
                  depends on {dependency.branchLabel || dependency.name || dependency.title}
                </span>
              ))}
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-[0.18em] text-text-muted">Unlocks next</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedDependencySummary.unlocks.length === 0 && (
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-text-muted">
                  Terminal branch
                </span>
              )}
              {selectedDependencySummary.unlocks.map((branch) => (
                <span key={branch.id} className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-2 py-1 text-[10px] font-semibold text-aurora-blue">
                  {branch.branchLabel || branch.name || branch.title}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Branch Controls</div>
                <div className="mt-1 text-[12px] text-text-body">Intervene on the selected branch without losing the whole mission graph.</div>
              </div>
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {selectedTask.agentRole || 'executor'}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedTask.workflowStatus === 'waiting_on_human' || selectedTask.status === 'needs_approval' ? (
                <>
                  <button onClick={() => onApprove(selectedTask.id)} className="rounded-xl border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[11px] font-semibold text-aurora-teal transition-colors hover:bg-aurora-teal/14">
                    Approve branch
                  </button>
                  <button onClick={() => onCancel(selectedTask.id)} className="rounded-xl border border-aurora-rose/20 bg-aurora-rose/10 px-3 py-2 text-[11px] font-semibold text-aurora-rose transition-colors hover:bg-aurora-rose/14">
                    Cancel branch
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => onRetry(selectedTask.id)} className="rounded-xl border border-aurora-amber/20 bg-aurora-amber/10 px-3 py-2 text-[11px] font-semibold text-aurora-amber transition-colors hover:bg-aurora-amber/14">
                    Rerun branch
                  </button>
                  {(selectedTask.workflowStatus === 'running' || selectedTask.status === 'running') && (
                    <button onClick={() => onStop(selectedTask.id)} className="rounded-xl border border-aurora-rose/20 bg-aurora-rose/10 px-3 py-2 text-[11px] font-semibold text-aurora-rose transition-colors hover:bg-aurora-rose/14">
                      Stop branch
                    </button>
                  )}
                </>
              )}
            </div>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <div className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Execution strategy</div>
                  <div className="mt-2 text-[12px] font-semibold text-text-primary">{selectedTask.executionStrategy || 'sequential'}</div>
                </div>
              <div className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Assigned lane</div>
                  <div className="mt-2 text-[12px] font-semibold text-text-primary">{selectedTask.providerOverride || 'adaptive'} / {selectedTask.modelOverride || 'default model'}</div>
                </div>
              </div>
            <div className="mt-4 rounded-[16px] border border-white/8 bg-white/[0.02] p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Reassign branch lane</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Agent</div>
                  <select
                    value={routingDraft.agentId}
                    onChange={(event) => setRoutingDraft((current) => ({ ...current, agentId: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] text-text-primary outline-none"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name} · {agent.role}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Provider override</div>
                  <select
                    value={routingDraft.providerOverride}
                    onChange={(event) => setRoutingDraft((current) => ({ ...current, providerOverride: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] text-text-primary outline-none"
                  >
                    <option value="">Policy default</option>
                    {['Anthropic', 'OpenAI', 'Google', 'Ollama', 'Custom'].map((provider) => (
                      <option key={provider} value={provider}>{provider}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Model override</div>
                  <input
                    value={routingDraft.modelOverride}
                    onChange={(event) => setRoutingDraft((current) => ({ ...current, modelOverride: event.target.value }))}
                    placeholder="Leave blank for lane default"
                    className="mt-2 w-full rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] text-text-primary outline-none placeholder:text-text-disabled"
                  />
                </label>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-[11px] text-text-muted">Use this to redirect one branch without rewriting the full mission policy.</div>
                <button
                  type="button"
                  disabled={routingSaving}
                  onClick={async () => {
                    if (!selectedTask) return;
                    setRoutingSaving(true);
                    setRoutingMessage('');
                    try {
                      await onUpdateBranchRouting(selectedTask.id, routingDraft);
                      setRoutingMessage('Branch lane updated.');
                    } catch (error) {
                      setRoutingMessage(error.message || 'Could not update branch lane.');
                    } finally {
                      setRoutingSaving(false);
                    }
                  }}
                  className="rounded-xl border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[11px] font-semibold text-aurora-teal transition-colors hover:bg-aurora-teal/14 disabled:opacity-50"
                >
                  {routingSaving ? 'Saving...' : 'Save branch lane'}
                </button>
              </div>
              {routingMessage && (
                <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-text-body">
                  {routingMessage}
                </div>
              )}
            </div>
            <div className="mt-4 rounded-[16px] border border-white/8 bg-white/[0.02] p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Edit branch dependencies</div>
              <div className="mt-2 text-[11px] text-text-muted">Choose which branches must complete before this branch becomes runnable.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {graphTaskSet.filter((task) => task.id !== selectedTask.id).map((task) => {
                  const active = dependencyDraft.includes(task.id);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setDependencyDraft((current) => (
                        active ? current.filter((id) => id !== task.id) : [...current, task.id]
                      ))}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-colors',
                        active
                          ? 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue'
                          : 'border-white/8 bg-black/20 text-text-muted hover:border-white/12'
                      )}
                    >
                      {task.branchLabel || task.name || task.title}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-[11px] text-text-muted">
                  {dependencyDraft.length === 0 ? 'This branch can launch as soon as policy and scheduling allow.' : `${dependencyDraft.length} dependency gate${dependencyDraft.length === 1 ? '' : 's'} selected.`}
                </div>
                <button
                  type="button"
                  disabled={dependencySaving}
                  onClick={async () => {
                    if (!selectedTask) return;
                    if (dependencyDraft.some((dependencyId) => wouldCreateDependencyCycle(graphTaskSet, dependencyId, selectedTask.id))) {
                      setDependencyMessage('One of the selected dependencies would create a cycle. Remove it and try again.');
                      return;
                    }
                    setDependencySaving(true);
                    setDependencyMessage('');
                    try {
                      await onUpdateBranchDependencies(selectedTask.id, dependencyDraft);
                      setDependencyMessage('Branch dependencies updated.');
                    } catch (error) {
                      setDependencyMessage(error.message || 'Could not update branch dependencies.');
                    } finally {
                      setDependencySaving(false);
                    }
                  }}
                  className="rounded-xl border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[11px] font-semibold text-aurora-blue transition-colors hover:bg-aurora-blue/14 disabled:opacity-50"
                >
                  {dependencySaving ? 'Saving...' : 'Save dependencies'}
                </button>
              </div>
              {dependencyMessage && (
                <div className="mt-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-text-body">
                  {dependencyMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {spawnedSpecialists.length > 0 && (
        <div className="mt-4 rounded-[20px] border border-aurora-violet/15 bg-[linear-gradient(180deg,rgba(167,139,250,0.08),rgba(255,255,255,0.02))] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-violet">Spawned Specialists</div>
              <p className="mt-1 text-[12px] leading-relaxed text-text-muted">
                These temporary branch agents were materialized from routing doctrine to cover missing live lanes.
              </p>
            </div>
            <div className="rounded-full border border-aurora-violet/20 bg-aurora-violet/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-violet">
              {spawnedSpecialists.length} active
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {spawnedSpecialists.map((agent) => (
              <div key={agent.id} className="rounded-[18px] border border-white/8 bg-black/20 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-text-primary truncate">{agent.name}</div>
                    <div className="mt-1 text-[10px] font-mono uppercase text-aurora-violet">{agent.role || 'specialist'}</div>
                  </div>
                  <span className="rounded-full border border-aurora-violet/20 bg-aurora-violet/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-aurora-violet">
                    Ephemeral
                  </span>
                </div>
                <div className="mt-2 text-[10px] font-mono text-text-disabled">{agent.model || 'Adaptive lane'}</div>
                {agent.roleDescription && <div className="mt-2 text-[11px] leading-relaxed text-text-muted">{agent.roleDescription}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {retirementEvents.length > 0 && (
        <div className="mt-4 rounded-[20px] border border-white/8 bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Specialist Retirement Audit</div>
          <div className="mt-3 space-y-2">
            {retirementEvents.map((event) => (
              <div key={event.id} className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3 text-[11px] leading-relaxed text-text-body">
                {String(event.message || '').replace('[specialist-retired] ', '')}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Specialist Fleet</div>
              <div className="mt-1 text-[12px] text-text-body">Persistent lanes, spawned lanes, and retirement posture for this mission graph.</div>
            </div>
            <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
              {persistentSpecialists.length + spawnedSpecialists.length} lanes
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Persistent', value: persistentSpecialists.length, tone: 'text-aurora-blue' },
              { label: 'Spawned', value: spawnedSpecialists.length, tone: 'text-aurora-violet' },
              { label: 'Retired', value: retirementEvents.length, tone: 'text-aurora-teal' },
            ].map((metric) => (
              <div key={metric.label} className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{metric.label}</div>
                <div className={cn('mt-2 text-lg font-semibold', metric.tone)}>{metric.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {persistentSpecialists.slice(0, 4).map((agent) => (
              <div key={agent.id} className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-semibold text-text-primary">{agent.name}</div>
                    <div className="mt-1 text-[10px] font-mono uppercase text-aurora-blue">{agent.role}</div>
                  </div>
                  <div className="text-[10px] font-mono text-text-disabled">{agent.model || 'Adaptive lane'}</div>
                </div>
              </div>
            ))}
            {persistentSpecialists.length === 0 && (
              <div className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3 text-[11px] text-text-muted">
                No persistent specialist lanes are live beyond Commander yet.
              </div>
            )}
          </div>
        </div>
          <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Branch History</div>
            <div className="mt-1 text-[12px] text-text-body">Routing overrides, dependency edits, and specialist lifecycle events for this mission root.</div>
          <div className="mt-3 space-y-2">
            {branchHistory.length === 0 && (
              <div className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3 text-[11px] text-text-muted">
                No branch override history yet for this mission root.
              </div>
            )}
            {branchHistory.map((entry) => (
              <div key={entry.id} className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-mono uppercase text-text-muted">{entry.type}</div>
                  <div className="text-[10px] font-mono text-text-disabled">{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : 'Live'}</div>
                </div>
                <div className="mt-2 text-[11px] leading-relaxed text-text-body">
                  {String(entry.message || '')
                    .replace('[branch-routing] ', '')
                    .replace('[branch-dependency] ', '')
                    .replace('[specialist-spawned] ', '')
                    .replace('[specialist-retired] ', '')
                    .replace('[specialist-persistent] ', '')
                    .replace('[outcome-score] ', '')
                    .replace('[doctrine-feedback] ', '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Outcome Timeline</div>
          <div className="mt-1 text-[12px] text-text-body">Persisted mission outcome scores for this root, so quality and trust survive beyond the current run.</div>
          <div className="mt-3 space-y-2">
            {outcomeHistory.length === 0 && <div className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3 text-[11px] text-text-muted">No persisted outcome scores yet for this mission root.</div>}
            {outcomeHistory.map((entry) => (
              <div key={entry.id} className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-mono uppercase text-aurora-teal">{entry.trust} trust</div>
                  <div className="text-[10px] font-mono text-text-disabled">{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : 'Live'}</div>
                </div>
                <div className="mt-2 text-[12px] font-semibold text-text-primary">Score {entry.score ?? '—'}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-text-body">{entry.cleanMessage}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Doctrine Feedback</div>
          <div className="mt-1 text-[12px] text-text-body">Persisted route guidance created from mission outcomes, overrides, and failures.</div>
          <div className="mt-3 space-y-2">
            {doctrineFeedback.length === 0 && <div className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3 text-[11px] text-text-muted">No doctrine feedback has been written yet for this mission root.</div>}
            {doctrineFeedback.map((entry) => (
              <div key={entry.id} className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-mono uppercase text-aurora-blue">Feedback</div>
                  <div className="text-[10px] font-mono text-text-disabled">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Live'}</div>
                </div>
                <div className="mt-2 text-[11px] leading-relaxed text-text-body">{entry.cleanMessage.replace(`root ${selectedRootMissionId} `, '')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {graphTaskSet.map((task) => {
          const workflow = getWorkflowMeta(task.workflowStatus);
          const taskAgent = agents.find((agent) => agent.id === task.agentId);
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelect(task.id)}
              className={cn(
                'rounded-[18px] border bg-black/20 px-3 py-3 text-left transition-colors',
                selectedId === task.id ? 'border-aurora-teal/30 shadow-glow-teal' : 'border-white/8 hover:border-white/12'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-text-primary">{task.name || task.title}</div>
                  {taskAgent?.isEphemeral && <div className="mt-1 text-[10px] font-mono uppercase text-aurora-violet">Spawned specialist lane</div>}
                </div>
                <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]', workflowTone[workflow.tone])}>
                  {workflow.label}
                </span>
              </div>
              <div className="mt-2 text-[10px] font-mono text-text-disabled truncate">{task.routingReason || 'Awaiting deeper routing readback'}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════

function Drawer({ item, agents, tasks, logs, onClose, onApprove, onReject, onRetry, onStop, onCopy, onAcknowledge, onReopen, onSnooze }) {
  const [tab, setTab] = useState('timeline');
  const [feedback, setFeedback] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);

  // Load notes when item changes or notes tab opens
  useEffect(() => {
    if (!item?.id) return;
    let x = false;
    fetchTaskNotes(item.id).then(n => { if (!x) { setNotes(n); setNotesLoaded(true); } });
    return () => { x = true; };
  }, [item?.id]);

  async function handleAddNote() {
    if (!noteText.trim() || !item?.id) return;
    setActionLoading('Note');
    try {
      await createTaskNote(item.id, noteText.trim());
      setNoteText('');
      const updated = await fetchTaskNotes(item.id);
      setNotes(updated);
    } catch (e) { setActionError(`Note failed: ${e.message}`); }
    finally { setActionLoading(null); }
  }

  if (!item) return null;
  const agent = agents.find(a => a.id === (item.agentId || item.agent_id));
  const cfg = stColor[item.status] || stColor.pending;
  const workflow = getWorkflowMeta(item.workflowStatus);
  const isEphemeralAgent = !!agent?.isEphemeral;
  const isMissionApproval = item.status === 'needs_approval';
  const isReviewApproval = item.urgency != null || (item.outputType != null && !item.mode);
  const isApproval = isMissionApproval || isReviewApproval;
  const isCompleted = ['completed', 'approved', 'done'].includes(item.status);
  const isRunning = item.status === 'running';
  const itemLogs = logs.filter(l => l.agentId === (item.agentId || item.agent_id));
  const branchDiffLogs = logs.filter((log) => {
    const message = String(log.message || '');
    return (
      message.includes(item.id)
      || message.includes(item.rootMissionId || '')
      || (item.agentId && log.agentId === item.agentId)
    ) && (
      message.includes('[branch-routing]')
      || message.includes('[branch-dependency]')
      || message.includes('[specialist-spawned]')
      || message.includes('[specialist-retired]')
    );
  });

  async function act(name, fn) {
    setActionLoading(name); setActionError(null);
    try { await fn(); } catch (e) { setActionError(`${name} failed: ${e.message}`); }
    finally { setActionLoading(null); }
  }

  return (<>
    <Motion.div key="dbg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
    <Motion.div key="dpn" initial={{ x: '100%' }} animate={{ x: '0%' }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      className="fixed top-0 right-0 bottom-0 w-[480px] bg-canvas border-l border-border z-50 flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.6)]">

      <div className="p-5 border-b border-border shrink-0">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2"><AgentAvatar agent={agent} name={item.agentName} size="lg" />{agent?.model && <ModelChip model={agent.model} />}</div>
            <h3 className="text-lg font-semibold text-text-primary truncate">{item.name || item.title}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn("text-xs font-mono font-bold", cfg.tx)}>{cfg.lb}</span>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]", workflowTone[workflow.tone])}>{workflow.label}</span>
              {isEphemeralAgent && <span className="rounded-full border border-aurora-violet/20 bg-aurora-violet/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-violet">Spawned Specialist</span>}
              {item.durationMs > 0 && <span className="text-xs text-text-disabled font-mono flex items-center gap-1"><Clock className="w-3 h-3" />{item.durationMs < 1000 ? `${item.durationMs}ms` : `${(item.durationMs/1000).toFixed(1)}s`}</span>}
              {item.mode && <span className="text-xs text-text-disabled font-mono uppercase">{item.mode}</span>}
              {item.actualCostCents != null && <span className="text-xs text-text-disabled font-mono">${(item.actualCostCents / 100).toFixed(2)}</span>}
              {item.actualCostCents == null && item.costUsd > 0 && <span className="text-xs text-text-disabled font-mono">${item.costUsd.toFixed(3)}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-white hover:bg-white/[0.05] rounded-lg"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {(item.summary || item.description) && <div className="px-5 py-3 border-b border-border bg-surface"><p className="text-[12px] text-text-body leading-relaxed">{item.summary || item.description}</p></div>}
      <div className="grid grid-cols-2 gap-2 border-b border-border bg-surface px-5 py-3">
        <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Routing</div>
          <div className="mt-1 text-[11px] font-mono text-text-primary">{item.routingReason || 'Legacy route or not yet inferred'}</div>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Graph</div>
          <div className="mt-1 text-[11px] font-mono text-text-primary">{item.rootMissionId || item.id}</div>
        </div>
      </div>

      {actionError && <div className="px-5 py-2 border-b border-aurora-rose/10 bg-aurora-rose/5 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-aurora-rose shrink-0" /><span className="text-[11px] text-aurora-rose flex-1">{actionError}</span><button onClick={() => setActionError(null)} className="text-[10px] text-aurora-rose font-bold">Dismiss</button></div>}

      <div className="flex border-b border-border px-5 shrink-0">
        {['timeline', 'diffs', 'routing', 'history', 'output', 'notes'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize", tab === t ? "border-aurora-teal text-aurora-teal" : "border-transparent text-text-muted hover:text-text-primary")}>{t}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-5">
        {tab === 'timeline' && (<div className="space-y-0">
          {itemLogs.length === 0 && <p className="text-sm text-text-disabled text-center py-8">No timeline events.</p>}
          {itemLogs.map((l, i) => {
            const dc = { OK: 'bg-aurora-teal', ERR: 'bg-aurora-rose', NET: 'bg-aurora-blue', SYS: 'bg-white/40' };
            return (<div key={l.id || i} className="flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center shrink-0"><div className={cn("w-2.5 h-2.5 rounded-full", dc[l.type] || 'bg-white/40')} />{i < itemLogs.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}</div>
              <div className="min-w-0 -mt-1">
                <div className="flex items-center gap-2 mb-0.5"><span className="text-[10px] font-mono text-text-disabled">{typeof l.timestamp === 'string' ? l.timestamp : new Date(l.timestamp).toLocaleTimeString()}</span><span className="text-[9px] font-mono font-bold uppercase text-text-disabled">{l.type}</span></div>
                <p className="text-[12px] text-text-body font-mono leading-relaxed">{l.message}</p>
                {(l.tokens > 0 || l.durationMs > 0) && <div className="flex gap-3 mt-1 text-[10px] font-mono text-text-disabled">{l.tokens > 0 && <span>{l.tokens} tok</span>}{l.durationMs > 0 && <span>{l.durationMs}ms</span>}</div>}
              </div>
            </div>);
          })}
        </div>)}
        {tab === 'diffs' && (
          <div className="space-y-3">
            {branchDiffLogs.length === 0 && <p className="text-sm text-text-disabled text-center py-8">No branch deltas yet.</p>}
            {branchDiffLogs.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-mono uppercase text-text-muted">{entry.type}</div>
                  <div className="text-[10px] font-mono text-text-disabled">{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : 'Live'}</div>
                </div>
                <div className="mt-2 text-[11px] leading-relaxed text-text-body">
                  {String(entry.message || '')
                    .replace('[branch-routing] ', '')
                    .replace('[branch-dependency] ', '')
                    .replace('[specialist-spawned] ', '')
                    .replace('[specialist-retired] ', '')}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'history' && (() => {
          const itemName = item.name || item.title || '';
          const history = tasks.filter(t => t.name === itemName && t.id !== item.id);
          return (
            <div className="space-y-2">
              {/* Current run */}
              <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-surface-raised border border-aurora-teal/20">
                <span className="text-[11px] font-mono text-text-muted">Current</span>
                <span className={cn("text-[10px] font-mono font-bold", (stColor[item.status] || stColor.pending).tx)}>{item.status}</span>
                <span className="text-[10px] font-mono text-text-disabled">{item.durationMs > 0 ? (item.durationMs < 1000 ? `${item.durationMs}ms` : `${(item.durationMs/1000).toFixed(1)}s`) : '—'}</span>
                <span className="text-[10px] font-mono text-text-disabled">${(item.costUsd || 0).toFixed(3)}</span>
              </div>
              {/* Previous runs */}
              {history.length === 0 && <p className="text-sm text-text-disabled text-center py-6">No previous runs found for this task.</p>}
              {history.map(h => {
                const hc = stColor[h.status] || stColor.completed;
                return (
                  <div key={h.id} className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-surface border border-border">
                    <span className="text-[11px] font-mono text-text-muted">{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : '—'}</span>
                    <span className={cn("text-[10px] font-mono font-bold", hc.tx)}>{h.status}</span>
                    <span className="text-[10px] font-mono text-text-disabled">{h.durationMs > 0 ? (h.durationMs < 1000 ? `${h.durationMs}ms` : `${(h.durationMs/1000).toFixed(1)}s`) : '—'}</span>
                    <span className="text-[10px] font-mono text-text-disabled">${(h.costUsd || 0).toFixed(3)}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {tab === 'routing' && (
          <div className="space-y-3">
            {[
              { label: 'Domain', value: item.domain || 'general' },
              { label: 'Intent', value: item.intentType || 'general' },
              { label: 'Agent role', value: item.agentRole || 'executor' },
              { label: 'Lane type', value: isEphemeralAgent ? 'Ephemeral specialist' : 'Persistent fleet agent' },
              { label: 'Branch label', value: item.branchLabel || 'Root Mission' },
              { label: 'Provider override', value: item.providerOverride || 'Policy default' },
              { label: 'Model override', value: item.modelOverride || 'Lane default' },
              { label: 'Budget class', value: item.budgetClass || 'balanced' },
              { label: 'Risk level', value: item.riskLevel || 'medium' },
              { label: 'Approval level', value: item.approvalLevel || 'risk_weighted' },
              { label: 'Policy', value: item.routingPolicyId || 'Default adaptive lane' },
            ].map((entry) => (
              <div key={entry.label} className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{entry.label}</div>
                <div className="mt-1 text-[12px] font-mono text-text-primary">{entry.value}</div>
              </div>
            ))}
            <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Required capabilities</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(item.requiredCapabilities || []).length === 0 && <span className="text-[12px] text-text-muted">No explicit capabilities inferred yet.</span>}
                {(item.requiredCapabilities || []).map((capability) => (
                  <span key={capability} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-primary">
                    {capability}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'output' && (item.payload || item.resultText) && <div className={cn("p-4 rounded-lg text-sm font-mono leading-relaxed whitespace-pre-wrap border", item.outputType === 'error' ? "bg-aurora-rose/5 border-aurora-rose/20 text-aurora-rose/90" : item.outputType === 'code' ? "bg-black/40 border-white/5 text-text-primary" : "bg-white/[0.02] border-white/5 text-text-body")}>{item.payload || item.resultText}</div>}
        {tab === 'output' && !item.payload && !item.resultText && <p className="text-sm text-text-disabled text-center py-8">No output payload.</p>}
        {tab === 'notes' && (
          <div className="space-y-3">
            {notes.map(n => (
              <div key={n.id} className="p-3 bg-surface rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn("text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-full",
                    n.author === 'Human' ? "bg-aurora-teal/10 text-aurora-teal" : "bg-aurora-amber/10 text-aurora-amber"
                  )}>{n.author}</span>
                  <span className="text-[10px] font-mono text-text-disabled">{new Date(n.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="text-[12px] text-text-body leading-relaxed">{n.content}</p>
              </div>
            ))}
            {notesLoaded && notes.length === 0 && <p className="text-sm text-text-disabled text-center py-4">No notes yet.</p>}
            <div className="flex gap-2 mt-2">
              <input
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
                placeholder="Add a note... (Cmd+Enter to save)"
                className="flex-1 bg-surface-input border border-border rounded-xl px-3 py-2.5 text-xs font-mono text-text-primary focus:border-aurora-teal/40 outline-none placeholder:text-text-disabled"
              />
              <button onClick={handleAddNote} disabled={!noteText.trim() || !!actionLoading}
                className="px-3 py-2.5 bg-aurora-teal text-black text-[11px] font-bold rounded-xl hover:bg-[#00ebd8] transition-colors disabled:opacity-50">
                {actionLoading === 'Note' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-4 flex gap-2">
        {isCompleted ? (
          /* Completed item actions */
          <>
            <button onClick={() => act('Acknowledge', () => { const tbl = item.outputType ? 'pending_reviews' : 'tasks'; return onAcknowledge(tbl, item.id); })} disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold text-aurora-teal bg-aurora-teal/5 border border-aurora-teal/20 rounded-xl hover:bg-aurora-teal/10">
              {actionLoading === 'Acknowledge' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}Acknowledge
            </button>
            <button onClick={() => act('Reopen', () => onReopen(item.id))} disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold text-aurora-amber bg-aurora-amber/5 border border-aurora-amber/20 rounded-xl hover:bg-aurora-amber/10">
              {actionLoading === 'Reopen' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}Reopen
            </button>
            <button onClick={() => onCopy(item)} className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-text-muted bg-surface border border-border rounded-xl hover:bg-surface-raised ml-auto"><Copy className="w-3.5 h-3.5" />Copy</button>
          </>
        ) : isApproval ? (
          /* Approval actions */
          <AnimatePresence mode="wait">
            {!showRejectForm ? (
              <Motion.div key="btns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2 w-full">
                <button onClick={() => setShowRejectForm(true)} disabled={!!actionLoading} className="flex-1 h-11 flex items-center justify-center gap-2 border border-aurora-rose/30 bg-aurora-rose/5 text-aurora-rose rounded-xl font-bold uppercase text-[11px] hover:bg-aurora-rose/10"><XCircle className="w-4 h-4" />{isMissionApproval ? 'Cancel' : 'Reject'}</button>
                {!isMissionApproval && <button onClick={() => act('Snooze', () => onSnooze(item.id))} disabled={!!actionLoading} className="h-11 px-3 flex items-center justify-center gap-1.5 border border-border bg-surface text-text-muted rounded-xl text-[11px] font-bold hover:bg-surface-raised">
                  {actionLoading === 'Snooze' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlarmClock className="w-3.5 h-3.5" />}30m
                </button>}
                <button onClick={() => act('Approve', () => onApprove(item.id))} disabled={!!actionLoading} className="flex-[2] h-11 flex items-center justify-center gap-2 bg-aurora-teal text-black rounded-xl font-bold uppercase text-[11px] shadow-[0_0_20px_rgba(0,217,200,0.2)] hover:bg-[#00ebd8]">{actionLoading === 'Approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}{isMissionApproval ? 'Approve & Continue' : 'Approve'}</button>
              </Motion.div>
            ) : (
              <Motion.div key="reject" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2 w-full">
                <input autoFocus value={feedback} onChange={e => setFeedback(e.target.value)} placeholder={isMissionApproval ? 'Optional cancellation note...' : 'Feedback...'} className="flex-1 h-11 bg-surface-input border border-aurora-rose/40 rounded-xl px-4 text-sm font-mono text-text-primary focus:outline-none placeholder:text-text-disabled" />
                <button onClick={() => { setShowRejectForm(false); setFeedback(''); }} className="h-11 px-4 border border-border rounded-xl text-text-muted text-[11px] font-semibold">Cancel</button>
                <button onClick={() => act('Reject', () => onReject(item.id, feedback.trim()))} disabled={(!feedback.trim() && !isMissionApproval) || !!actionLoading} className="h-11 px-5 bg-aurora-rose text-white rounded-xl font-bold uppercase text-[11px] flex items-center gap-1.5">{actionLoading === 'Reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}{isMissionApproval ? 'Cancel Mission' : 'Send'}</button>
              </Motion.div>
            )}
          </AnimatePresence>
        ) : (
          /* Task actions */
          <>
            {isRunning && <button onClick={() => act('Stop', () => onStop(item.id))} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-rose bg-aurora-rose/5 border border-aurora-rose/20 rounded-xl hover:bg-aurora-rose/10">{actionLoading === 'Stop' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}Stop</button>}
            <button onClick={() => act('Rerun', () => onRetry(item.id))} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-amber bg-aurora-amber/5 border border-aurora-amber/20 rounded-xl hover:bg-aurora-amber/10">{actionLoading === 'Rerun' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}Rerun</button>
            <button onClick={() => onCopy(item)} className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-text-muted bg-surface border border-border rounded-xl hover:bg-surface-raised ml-auto"><Copy className="w-3.5 h-3.5" />Copy</button>
          </>
        )}
      </div>
    </Motion.div>
  </>);
}

// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE SIDEBAR
// ═══════════════════════════════════════════════════════════════

function IntelSidebar({ tasks, approvals, completed, agents, schedules, logs, learningMemory, connectedSystems, truth, onOpenApprovals, onOpenSystems, onOpenCreator, onOpenOps }) {
  const totalCost = tasks.reduce((sum, task) => sum + Number(task.costUsd || 0), 0);
  const failedCount = tasks.filter(t => t.status === 'failed' || t.status === 'error').length;
  const runningCount = tasks.filter(t => t.status === 'running').length;
  const avgApprovalWait = approvals.length > 0 ? Math.round(approvals.reduce((s, a) => s + (a.waitingMs || 0), 0) / approvals.length / 60000) : 0;
  const timelineEntries = buildTimelineEntries({ tasks, reviews: approvals, logs, connectedSystems });

  // Derive recommendations from real data
  const recs = [];
  if (failedCount > 0) {
    const failedAgents = [...new Set(tasks.filter(t => t.status === 'failed' || t.status === 'error').map(t => t.agentName || 'Unknown'))];
    recs.push({ type: 'anomaly', text: `${failedCount} failed task${failedCount > 1 ? 's' : ''} from ${failedAgents.join(', ')}. Check agent health and retry or reassign.`, imp: 'high' });
  }
  if (avgApprovalWait > 3) {
    recs.push({ type: 'bottleneck', text: `Approval queue averaging ${avgApprovalWait}m wait. Consider auto-approve rules for low-risk items.`, imp: 'high' });
  }
  if (totalCost > 1) {
    recs.push({ type: 'cost', text: `Session cost at $${totalCost.toFixed(2)}. Review if research tasks can use cheaper models.`, imp: 'med' });
  }
  if (recs.length === 0 && agents.length > 0) {
    recs.push({ type: 'status', text: `${agents.length} agents in fleet, ${runningCount} active. All systems nominal.`, imp: 'low' });
  }

  // Mission goals derived from real data
  const goals = [
    { lb: 'Approval queue < 2m', pct: avgApprovalWait <= 2 ? 100 : Math.max(0, 100 - avgApprovalWait * 15), c: avgApprovalWait <= 2 ? '#34d399' : '#fbbf24' },
    { lb: 'Zero failures today', pct: failedCount === 0 ? 100 : Math.max(0, 100 - failedCount * 25), c: failedCount === 0 ? '#34d399' : '#fb7185' },
    { lb: `${schedules.length} automations set`, pct: Math.min(100, schedules.length * 20), c: '#60a5fa' },
  ];

  return (<div className="flex flex-col gap-4">
    <TacticalInterventionConsole
      truth={truth}
      onOpenApprovals={onOpenApprovals}
      onOpenSystems={onOpenSystems}
      onOpenCreator={onOpenCreator}
      onOpenOps={onOpenOps}
    />

    <div className="p-3.5 rounded-[24px] bg-surface border border-border">
      <div className="flex items-center gap-2 mb-3"><Target className="w-3.5 h-3.5 text-aurora-teal" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Mission Health</span></div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { label: 'Live now', value: runningCount, tone: 'text-aurora-amber' },
          { label: 'Approvals', value: approvals.length, tone: 'text-aurora-amber' },
          { label: 'Completed', value: completed.length, tone: 'text-aurora-teal' },
          { label: 'Failed', value: failedCount, tone: 'text-aurora-rose' },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{item.label}</div>
            <div className={cn("mt-2 text-xl font-mono font-bold", item.tone)}><AnimatedNumber value={item.value} /></div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {goals.map(g => (
          <div key={g.lb}>
            <div className="flex items-center justify-between mb-1"><span className="text-[11px] text-text-body">{g.lb}</span><span className="text-[11px] font-mono font-bold" style={{ color: g.c }}>{g.pct}%</span></div>
            <div className="w-full h-1.5 rounded-full bg-surface-raised overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${g.pct}%`, backgroundColor: g.c }} /></div>
          </div>
        ))}
      </div>
    </div>

    {recs.length > 0 && (
      <div className="p-3.5 rounded-[24px] bg-surface border border-border">
        <div className="flex items-center gap-2 mb-2.5"><Sparkles className="w-3.5 h-3.5 text-aurora-violet" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Commander Readback</span></div>
        <div className={cn("rounded-2xl border border-l-[3px] p-3",
          recs[0].imp === 'high' ? 'bg-aurora-rose/[0.03] border-aurora-rose/20 border-l-aurora-rose' :
          recs[0].imp === 'med' ? 'bg-aurora-amber/[0.03] border-aurora-amber/20 border-l-aurora-amber' :
          'bg-aurora-teal/[0.03] border-aurora-teal/20 border-l-aurora-teal'
        )}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-full bg-white/[0.04] text-text-muted">{recs[0].type}</span>
            <span className="text-[10px] font-mono text-text-disabled">{avgApprovalWait > 0 ? `${avgApprovalWait}m wait` : 'Live'}</span>
          </div>
          <p className="text-[12px] text-text-body leading-relaxed">{recs[0].text}</p>
        </div>
      </div>
    )}

    <div className="p-3.5 rounded-[24px] bg-surface border border-border">
      <div className="flex items-center gap-2 mb-2.5"><Brain className="w-3.5 h-3.5 text-aurora-teal" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Cross-Page Doctrine</span></div>
      <DoctrineCards items={learningMemory.missionThree} compact columns="one" />
    </div>

    <CommandTimelineRail
      entries={timelineEntries}
      title="Command Timeline"
      description="Recent launches, approvals, failures, and systems traffic flowing through Mission Control."
    />
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// PLANNER TAB (static until schedules table)
// ═══════════════════════════════════════════════════════════════

function PlannerTab({ schedules, agents, onToggle, onDispatch }) {
  const enabled = schedules.filter(s => s.enabled);
  const paused = schedules.filter(s => !s.enabled);

  return (<div className="flex-1 overflow-y-auto no-scrollbar pr-1">
    {/* Queued / upcoming */}
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3"><Calendar className="w-3.5 h-3.5 text-aurora-teal" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Upcoming Schedules ({enabled.length})</span></div>
      {enabled.length === 0 && <p className="text-center text-text-disabled py-8 text-sm">No active schedules. Create one in Supabase to get started.</p>}
      <div className="space-y-2">
        {enabled.map(s => {
          const agent = agents.find(a => a.id === s.agentId);
          const lCfg = stColor[s.lastResult] || stColor.pending;
          return (
            <div key={s.id} className="px-4 py-3.5 rounded-2xl border border-border bg-surface">
              <div className="flex items-center gap-3 mb-2">
                <AgentAvatar agent={agent} name={agent?.name || '?'} />
                <span className="text-[13px] font-semibold text-text-primary flex-1 truncate">{s.name}</span>
                {s.nextRunAt && <span className="text-[11px] font-mono text-aurora-blue">{new Date(s.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                {s.approvalRequired && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-aurora-amber/10 text-aurora-amber border border-aurora-amber/20">Approval</span>}
              </div>
              <div className="flex items-center gap-3 ml-8">
                <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Repeat className="w-3 h-3" />{s.cadence}</span>
                <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Timer className="w-3 h-3" />~{s.estMinutes}m</span>
                <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><DollarSign className="w-3 h-3" />${s.estCost.toFixed(2)}</span>
                <PriBadge v={s.priority} />
                {s.lastResult && <span className="text-[10px] font-mono text-text-disabled">Last: <span className={lCfg.tx}>{s.lastResult}</span></span>}
              </div>
              <div className="flex items-center gap-2 mt-3 ml-8">
                <button onClick={() => onDispatch(s)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-aurora-teal bg-aurora-teal/5 border border-aurora-teal/20 rounded-lg hover:bg-aurora-teal/10"><Send className="w-3 h-3" />Dispatch Now</button>
                <button onClick={() => onToggle(s.id, false)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-text-muted bg-surface border border-border rounded-lg hover:bg-surface-raised"><AlarmClock className="w-3 h-3" />Pause</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Paused */}
    {paused.length > 0 && (
      <div>
        <div className="flex items-center gap-2 mb-3"><Repeat className="w-3.5 h-3.5 text-text-disabled" /><span className="text-[11px] font-bold uppercase text-text-disabled tracking-wider">Paused ({paused.length})</span></div>
        <div className="space-y-2 opacity-60">
          {paused.map(s => {
            const agent = agents.find(a => a.id === s.agentId);
            return (
              <div key={s.id} className="px-4 py-3 rounded-2xl border border-border bg-surface">
                <div className="flex items-center gap-3">
                  <AgentAvatar agent={agent} name={agent?.name || '?'} />
                  <span className="text-[12px] font-semibold text-text-body flex-1 truncate">{s.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-text-muted">Paused</span>
                </div>
                <div className="flex items-center gap-2 mt-2 ml-8">
                  <button onClick={() => onToggle(s.id, true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-aurora-teal bg-aurora-teal/5 border border-aurora-teal/20 rounded-lg hover:bg-aurora-teal/10">Enable</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// MAIN VIEW
// ═══════════════════════════════════════════════════════════════

export function MissionControlView() {
  const { setPendingCount, setSettingsOpen } = useSystemState();
  const [agents, setAgents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [tab, setTab] = useState('ops');
  const [sel, setSel] = useState(null);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const reload = useCallback(async () => {
    const [a, t, l, p, c, s] = await Promise.all([fetchAgents(), fetchTasks(), fetchActivityLog(), fetchPendingReviews(), fetchCompletedOutputs(), fetchSchedules()]);
    setAgents(a); setTasks(t); setLogs(l); setApprovals(p); setCompleted(c); setSchedules(s);
    setPendingCount(p.length + t.filter(task => task.workflowStatus === 'waiting_on_human' || task.status === 'needs_approval').length);
  }, [setPendingCount]);

  // Initial mission data load for the screen.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { const u = subscribeToPendingReviews(() => reload()); return u; }, [reload]);
  useEffect(() => { const u = subscribeToTasks(() => reload()); return u; }, [reload]);

  const missionApprovals = useMemo(
    () => tasks.filter(task => !task.parentId && (task.workflowStatus === 'waiting_on_human' || task.status === 'needs_approval' || task.lane === 'approvals')),
    [tasks]
  );
  const approvalItems = useMemo(() => [...missionApprovals, ...approvals], [missionApprovals, approvals]);
  const completedItems = useMemo(
    () => [
      ...tasks.filter(task => task.workflowStatus === 'completed' || ['done', 'completed'].includes(task.status)),
      ...completed,
    ],
    [tasks, completed]
  );
  const operationalTasks = useMemo(
    () => tasks.filter(task => !task.parentId && task.workflowStatus !== 'completed' && task.workflowStatus !== 'waiting_on_human' && !['done', 'completed'].includes(task.status) && task.status !== 'needs_approval'),
    [tasks]
  );
  const graphTasks = useMemo(
    () => tasks.filter(task => task.nodeType === 'mission' || task.nodeType === 'subtask'),
    [tasks]
  );
  const totalMissionCost = useMemo(
    () => tasks.reduce((sum, task) => sum + Number(task.costUsd || 0), 0),
    [tasks]
  );
  const learningMemory = useLearningMemory({
    tasks,
    approvals: approvalItems,
    logs,
    costData: { total: totalMissionCost, models: [] },
  });

  const running = tasks.filter(t => ['running', 'ready'].includes(t.workflowStatus) || t.status === 'running' || t.status === 'queued').length;
  const failed = tasks.filter(t => ['failed', 'blocked', 'cancelled'].includes(t.workflowStatus) || ['failed', 'error', 'blocked', 'cancelled'].includes(t.status)).length;

  const criticalItems = useMemo(() => {
    const c = [];
    approvalItems.filter(a => a.urgency === 'critical' || a.status === 'needs_intervention' || a.priority >= 8).forEach(a => c.push(a));
    tasks.filter(t => ['failed', 'blocked'].includes(t.workflowStatus) || ['failed', 'error', 'blocked'].includes(t.status)).slice(0, 2).forEach(t => c.push(t));
    return c.slice(0, 3);
  }, [approvalItems, tasks]);

  async function handleApprove(id) {
    const missionTask = missionApprovals.find(task => task.id === id);
    if (missionTask) await approveMissionTask(id);
    else await approveReview(id);
    setSel(null);
    reload();
  }
  async function handleReject(id, fb) {
    const missionTask = missionApprovals.find(task => task.id === id);
    if (missionTask) await cancelMissionTask(id, fb);
    else await rejectReview(id, fb);
    setSel(null);
    reload();
  }
  async function handleRetry(id) { await retryTask(id); reload(); }
  async function handleStop(id) { await stopTask(id); reload(); }
  async function handleAcknowledge(table, id) { await acknowledgeItem(table, id); setSel(null); reload(); }
  async function handleReopen(id) { await reopenReview(id); setSel(null); reload(); }
  async function handleSnooze(id) { await snoozeReview(id, 30); setSel(null); reload(); }
  async function handleToggleSchedule(id, enabled) { await toggleSchedule(id, enabled); reload(); }
  async function handleDispatch(schedule) { await dispatchFromSchedule(schedule, agents); reload(); }
  async function handleLaunchMission(payload) {
    const priorityScore = payload.priority === 'critical' ? 9 : payload.priority === 'low' ? 2 : 5;
    await createMission({ ...payload, priorityScore }, agents);
    await reload();
  }
  async function handleUpdateBranchRouting(taskId, updates) {
    await updateMissionBranchRouting(taskId, updates, agents);
    await reload();
  }
  async function handleUpdateBranchDependencies(taskId, dependsOn) {
    await updateMissionBranchDependencies(taskId, dependsOn);
    await reload();
  }
  function handleCopy(item) { navigator.clipboard?.writeText(`${item.name || item.title}\nStatus: ${item.status}\nAgent: ${item.agentName || ''}\nCost: ${item.actualCostCents != null ? `$${(item.actualCostCents / 100).toFixed(2)}` : `$${item.costUsd?.toFixed(3) || '0.000'}`}`); }

  const selectedItem = sel ? [...tasks, ...approvalItems, ...completedItems].find(i => i.id === sel) : null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const primaryAgent = agents.find(agent => /tony|atlas/i.test(agent.name || '')) || agents.find(agent => agent.role === 'commander') || agents[0];
  const truth = useCommandCenterTruth();
  const { connectedSystems } = useConnectedSystems();

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-[-10%] w-[520px] h-[520px] rounded-full bg-aurora-teal/10 blur-[120px]" />
        <div className="absolute top-[22%] right-[-8%] w-[460px] h-[460px] rounded-full bg-aurora-blue/10 blur-[140px]" />
        <div className="absolute bottom-[-18%] left-[22%] w-[420px] h-[420px] rounded-full bg-aurora-violet/10 blur-[140px]" />
      </div>

      {/* Header */}
      <div className="shrink-0 mb-5 relative">
        <CommandDeckHero
          glow="teal"
          eyebrow={`Mission Control  ${dateStr}`}
          eyebrowIcon={Target}
          title={`${greeting}, Commander`}
          description="Launch work fast, watch live execution, and keep the deck readable under pressure."
          badges={[
            { label: 'primary operator', value: primaryAgent?.name || 'Unassigned', tone: 'teal' },
            { label: 'active missions', value: running, tone: 'blue' },
            { label: 'awaiting human input', value: approvalItems.length, tone: 'amber' },
          ]}
          actions={
            <button onClick={() => setCreatorOpen(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-aurora-teal px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#00ebd8] shadow-glow-teal">
              <Plus className="w-4 h-4" /> Tell Commander what you want
            </button>
          }
          sideContent={
            <div className="rounded-[24px] border border-white/10 bg-black/25 px-4 py-4 backdrop-blur-sm min-w-[260px]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Command Pulse</span>
                <span className="text-[10px] font-mono text-aurora-teal">LIVE</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-muted">Live missions</span>
                  <span className="text-text-primary font-semibold"><AnimatedNumber value={running} /></span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-muted">Awaiting approval</span>
                  <span className="text-aurora-amber font-semibold"><AnimatedNumber value={approvalItems.length} /></span>
                </div>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-text-muted">Blocked / failed</span>
                  <span className="text-aurora-rose font-semibold"><AnimatedNumber value={failed} /></span>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 mt-1">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted mb-1">Readback</div>
                  <p className="text-[12px] leading-relaxed text-text-body">
                    {approvalItems.length > 0
                      ? 'Human gates are the only real drag right now.'
                      : running > 0
                        ? 'Tony is moving cleanly with no immediate choke point.'
                        : 'The deck is calm. Good time to launch the next mission.'}
                  </p>
                </div>
              </div>
            </div>
          }
        />

        <div className="mt-4">
          <TruthAuditStrip truth={truth} />
        </div>

        <div className="mt-4">
          <ReactorCoreBoard truth={truth} summary={{ burnRate: totalMissionCost }} />
        </div>

        <div className="mt-4 flex items-center gap-1 bg-surface/90 rounded-2xl p-1.5 border border-border backdrop-blur-sm">
          {[
            { id: 'ops', lb: 'Operations', ic: Radio, ct: running },
            { id: 'plan', lb: 'Planner', ic: Calendar, ct: schedules.filter(s => s.enabled).length },
            { id: 'app', lb: 'Approvals', ic: ShieldCheck, ct: approvalItems.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all",
              tab === t.id ? "bg-surface-raised text-text-primary shadow-sm border border-white/10" : "text-text-muted hover:text-text-primary"
            )}>
              <t.ic className="w-4 h-4" />{t.lb}
              {t.ct > 0 && <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", tab === t.id ? "bg-aurora-teal/10 text-aurora-teal" : "bg-surface-raised text-text-disabled")}>{t.ct}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Pulse strip */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { lb: 'Live Missions', desc: 'Queued or executing now', v: running, c: 'text-aurora-amber' },
          { lb: 'Needs You', desc: 'Waiting on your judgment', v: approvalItems.length, c: 'text-aurora-amber' },
          { lb: 'Closed Cleanly', desc: 'Completed without drag', v: completedItems.length, c: 'text-aurora-teal' },
        ].map(s => (
          <div key={s.lb} className="rounded-[22px] bg-surface/90 border border-border px-4 py-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-[0.18em]">{s.lb}</span>
              <span className={cn("text-2xl font-mono font-bold", s.c)}><AnimatedNumber value={s.v} /></span>
            </div>
            <p className="text-[11px] text-text-disabled mt-2">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Critical lane */}
      {criticalItems.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 rounded-full bg-aurora-rose animate-pulse" /><span className="text-[11px] font-bold uppercase text-aurora-rose tracking-wider">Critical lane</span></div>
          <div className="grid grid-cols-3 gap-3">
            {criticalItems.map(item => (
              <Card key={item.id} onClick={() => setSel(item.id)} className="p-4 bg-[linear-gradient(135deg,rgba(251,113,133,0.06),rgba(255,255,255,0.02))] min-h-[92px]">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-aurora-rose rounded-l-2xl" />
                <div className="flex items-center gap-2 mb-1">
                  <AgentAvatar agent={agents.find(a => a.id === (item.agentId || item.agent_id))} name={item.agentName} />
                  <span className="text-[12px] font-semibold text-text-primary truncate flex-1">{item.name || item.title}</span>
                </div>
                <p className="ml-8 text-[11px] text-text-muted line-clamp-2">{item.summary || item.description || 'Needs a commander decision before work can continue.'}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Main: content + intel sidebar */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        <div className="flex-[3.2] min-w-0 overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] backdrop-blur-sm">
          <div className="h-full overflow-y-auto no-scrollbar space-y-2 pr-1 px-4 py-4">
            <div className="flex items-center justify-between mb-2 px-1">
              <CommandSectionHeader
                eyebrow={tab === 'ops' ? 'Live Missions' : tab === 'plan' ? 'Automation Planner' : 'Approvals Queue'}
                title={tab === 'ops' ? 'Live mission lane' : tab === 'plan' ? 'Recurring systems and dispatch timing' : 'Human gates holding execution'}
                description={
                  tab === 'ops'
                    ? 'Open this lane to see what is moving, what is stuck, and what needs your attention next.'
                    : tab === 'plan'
                      ? 'Recurring automations, scheduling posture, and dispatch timing all live in this lane.'
                      : 'These are the judgment calls that still need a commander before execution continues.'
                }
                icon={tab === 'ops' ? Radio : tab === 'plan' ? Calendar : ShieldCheck}
                tone={tab === 'ops' ? 'teal' : tab === 'plan' ? 'blue' : 'amber'}
              />
              {tab === 'ops' && (
                <button onClick={() => setCreatorOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-aurora-teal/20 bg-aurora-teal/8 text-aurora-teal text-[11px] font-semibold hover:bg-aurora-teal/12 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> New Mission
                </button>
              )}
            </div>

          {tab === 'ops' && (
            <div className="space-y-4">
              <MissionGraphPanel
                tasks={graphTasks}
                agents={agents}
                logs={logs}
                selectedId={sel}
                onSelect={setSel}
                onRetry={handleRetry}
                onStop={handleStop}
                onApprove={handleApprove}
                onCancel={(id) => handleReject(id, 'Cancelled from branch controls')}
                onUpdateBranchRouting={handleUpdateBranchRouting}
                onUpdateBranchDependencies={handleUpdateBranchDependencies}
              />
              <AnimatePresence mode="popLayout">
                {operationalTasks.map(t => (
                  <Motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -14, scale: 0.98 }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                  >
                    <ItemRow item={t} agents={agents} selected={sel === t.id} onClick={() => setSel(t.id)} />
                  </Motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          {tab === 'ops' && operationalTasks.length === 0 && (
            <div className="rounded-[24px] border border-white/[0.06] bg-black/15 px-6 py-8">
              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-base font-semibold text-text-primary">No live missions right now</p>
                  <p className="mt-2 text-sm text-text-muted">The deck is clear. Launch something new, check approvals, or let the scheduled systems take the next pass.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => setCreatorOpen(true)} className="rounded-xl border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[11px] font-semibold text-aurora-teal transition-colors hover:bg-aurora-teal/14">
                      Launch mission
                    </button>
                    <button onClick={() => setTab('app')} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/[0.06]">
                      Review approvals
                    </button>
                    <button onClick={() => setTab('plan')} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/[0.06]">
                      Open planner
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Approvals', value: approvalItems.length },
                    { label: 'Blocked', value: failed },
                    { label: 'Scheduled', value: schedules.filter(s => s.enabled).length },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-[18px] border border-white/8 bg-white/[0.02] px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{metric.label}</div>
                      <div className="mt-2 text-lg font-semibold text-text-primary">{metric.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'plan' && <PlannerTab schedules={schedules} agents={agents} onToggle={handleToggleSchedule} onDispatch={handleDispatch} />}

          {tab === 'app' && (() => {
            const visible = approvalItems.filter(a => !a.snoozedUntil);
            const snoozed = approvalItems.filter(a => a.snoozedUntil);
            return (<>
              <AnimatePresence mode="popLayout">
                {visible.map(a => (
                  <Motion.div
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -14, scale: 0.98 }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                  >
                    <ApprovalCard
                      item={a}
                      agents={agents}
                      selected={sel === a.id}
                      onClick={() => setSel(a.id)}
                      onApprove={handleApprove}
                      onReject={(id) => handleReject(id, 'Rejected from approvals card')}
                    />
                  </Motion.div>
                ))}
              </AnimatePresence>
              {visible.length === 0 && snoozed.length === 0 && <p className="text-center text-text-disabled py-12">No pending approvals. All clear.</p>}
              {snoozed.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2"><AlarmClock className="w-3 h-3 text-text-disabled" /><span className="text-[11px] font-bold uppercase text-text-disabled tracking-wider">Snoozed ({snoozed.length})</span></div>
                  <div className="space-y-1.5 opacity-60">{snoozed.map(a => <ItemRow key={a.id} item={a} agents={agents} selected={sel === a.id} onClick={() => setSel(a.id)} />)}</div>
                </div>
              )}
            </>);
          })()}

          {/* Recently completed */}
          {(tab === 'ops' || tab === 'app') && completedItems.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2"><Archive className="w-3 h-3 text-text-disabled" /><span className="text-[11px] font-bold uppercase text-text-disabled tracking-wider">Recently Completed</span></div>
              <div className="space-y-1.5 opacity-80">
                <AnimatePresence mode="popLayout">
                  {completedItems.map(c => (
                    <Motion.button
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      onClick={() => setSel(c.id)}
                      className="w-full text-left px-4 py-3 rounded-2xl border bg-surface/60 border-border/60 hover:bg-surface transition-all flex items-center gap-3"
                    >
                      <AgentAvatar agent={agents.find(a => a.id === (c.agentId || c.agent_id))} name={c.agentName} />
                      <span className="text-[12px] text-text-body flex-1 truncate">{c.name || c.title}</span>
                      <span className="text-[10px] font-mono text-text-disabled">{c.completedAt || c.lastRunAt || c.updatedAt}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-aurora-teal shrink-0" />
                    </Motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Intel sidebar */}
        <div className="w-[320px] shrink-0 overflow-y-auto no-scrollbar rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(96,165,250,0.06),rgba(255,255,255,0.015))] backdrop-blur-sm p-3">
          <IntelSidebar
            tasks={tasks}
            approvals={approvalItems}
            completed={completedItems}
            agents={agents}
            schedules={schedules}
            logs={logs}
            learningMemory={learningMemory}
            connectedSystems={connectedSystems}
            truth={truth}
            onOpenApprovals={() => setTab('app')}
            onOpenSystems={() => setSettingsOpen(true)}
            onOpenCreator={() => setCreatorOpen(true)}
            onOpenOps={() => setTab('ops')}
          />
        </div>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedItem && <Drawer item={selectedItem} agents={agents} tasks={tasks} logs={logs} onClose={() => setSel(null)} onApprove={handleApprove} onReject={handleReject} onRetry={handleRetry} onStop={handleStop} onCopy={handleCopy} onAcknowledge={handleAcknowledge} onReopen={handleReopen} onSnooze={handleSnooze} />}
      </AnimatePresence>

      <MissionCreatorPanel
        isOpen={creatorOpen}
        agents={agents}
        learningMemory={learningMemory}
        onClose={() => setCreatorOpen(false)}
        onLaunch={handleLaunchMission}
        onPreview={previewMissionPlan}
      />
    </div>
  );
}
