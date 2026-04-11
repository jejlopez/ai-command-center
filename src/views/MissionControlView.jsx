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
  interruptAndRedirectTask,
  subscribeToPendingReviews,
  subscribeToTasks,
  fetchTaskNotes, createTaskNote,
  acknowledgeItem, reopenReview, snoozeReview,
  fetchSchedules, toggleSchedule, dispatchFromSchedule,
  previewMissionPlan, createMission,
} from '../lib/api';
import { useSystemState } from '../context/SystemStateContext';
import { MissionCreatorPanel } from '../components/mission/MissionCreatorPanel';
import { ScratchpadStrip } from '../components/mission/ScratchpadStrip';
import { CommandDeckHero } from '../components/command/CommandDeckHero';
import { AnimatedNumber } from '../components/command/AnimatedNumber';
import { CommandSectionHeader } from '../components/command/CommandSectionHeader';
import { useLearningMemory } from '../utils/useLearningMemory';
import { DoctrineCards } from '../components/command/DoctrineCards';
import { TruthAuditStrip } from '../components/command/TruthAuditStrip';
import { useCommandCenterTruth } from '../utils/useCommandCenterTruth';
import { useApprovalAudit, useConnectedSystems, useRoutingPolicies, useTaskInterventions } from '../utils/useSupabase';
import { ReactorCoreBoard } from '../components/command/ReactorCoreBoard';
import { CommandTimelineRail } from '../components/command/CommandTimelineRail';
import { TacticalInterventionConsole } from '../components/command/TacticalInterventionConsole';
import { buildTimelineEntries } from '../utils/buildCommandTimeline';
import { buildTaskControlActionDraft, describeTaskTransition, getApprovalTransitionState, getMissionGraphSummary, getTaskControlActionMode, getTaskDecisionNarrative, getTaskExecutableControlAction, getTaskLiveControlState } from '../utils/missionLifecycle';
import { buildFailureTriageActionDraft, getAutomationCandidates, getBatchRoutingTrustSummary, getCommanderNextMove, getExecutionAuditReadback, getFailureTriageSummary, getHybridApprovalSummary, getLatestBatchCommandAudit, getMissionCreateBrief, getPolicyActionGuidance, getPolicyDeltaReadback, getRecurringAutonomyTuningSummary, getRecurringBriefFitAction, getRecurringChangePayback, getRecurringChangeReadback, getRecurringNextCorrection, getRecurringPostChangeVerdict, getTradeoffCorrectiveAction, getTradeoffOutcomeSummary } from '../utils/commanderAnalytics';
import { buildConnectorActionDraft, buildDispatchActionDraft, formatBranchConnectorBlocker, formatDispatchClassLabel, formatFallbackStrategyLabel, formatReleaseTriggerLabel, getBranchConnectorCorrectiveAction, getBranchConnectorPressureSummary, getFallbackStrategyDetail, getGroupedConnectorBlockers, getMissionDispatchPressureSummary, getMissionLaunchReadiness, getTaskBranchExecutionPosture, getTaskDispatchReadback, getTaskExecutionHoldReason, getTaskExecutionReleaseReason, getTaskGraphContractReadback, getTaskPlanningReason } from '../utils/executionReadiness';

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

function formatProgress(task, graphSummary = null) {
  if (graphSummary?.available) return `${Math.max(0, Math.min(100, graphSummary.progressPercent))}%`;
  if (task.progressPercent == null) return null;
  return `${Math.max(0, Math.min(100, task.progressPercent))}%`;
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

function ItemRow({ item, agents, tasks = [], selected, onClick }) {
  const cfg = stColor[item.status] || stColor.pending;
  const isRun = item.status === 'running';
  const agent = agents.find(a => a.id === (item.agentId || item.agent_id));
  const urgC = item.urgency ? urgColors[item.urgency] : null;
  const graphSummary = getMissionGraphSummary(tasks, item.rootMissionId || item.id);
  const transition = describeTaskTransition(item, tasks);
  const dispatchReadback = getTaskDispatchReadback(item, tasks);
  const graphContract = getTaskGraphContractReadback(item, tasks, []);
  const progress = formatProgress(item, graphSummary.available ? graphSummary : null);
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
        {item.mode && <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-surface-raised text-text-muted border border-border uppercase">{item.mode}</span>}
        {item.durationMs > 0 && <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Timer className="w-3 h-3" />{item.durationMs < 1000 ? `${item.durationMs}ms` : `${(item.durationMs/1000).toFixed(1)}s`}</span>}
        {costLabel && <span className="text-[10px] font-mono text-text-disabled">{costLabel}</span>}
        {item.waitingMs > 0 && <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round(item.waitingMs/60000)}m waiting</span>}
        {relativeTime && <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Clock className="w-3 h-3" />{relativeTime}</span>}
        {item.status === 'needs_intervention' && <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-aurora-rose"><AlertTriangle className="w-3 h-3" />Needs Me</span>}
        {item.status === 'needs_approval' && <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-aurora-amber"><Lock className="w-3 h-3" />Needs Approval</span>}
        {transition?.label && (
          <span className="rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-body">
            {transition.label}
          </span>
        )}
        {dispatchReadback?.available && (
          <span className="rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-body">
            {dispatchReadback.label}
          </span>
        )}
        {graphContract?.available && (
          <span className="rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-text-body">
            {graphContract.label}
          </span>
        )}
      </div>

      {item.summary && <p className="text-[10px] text-text-muted mt-1.5 ml-8 leading-relaxed line-clamp-1">{item.summary}</p>}
      {!item.summary && item.description && <p className="text-[10px] text-text-muted mt-1.5 ml-8 leading-relaxed line-clamp-1">{item.description}</p>}
      {graphSummary.available && (
        <p className="text-[10px] text-text-muted mt-1.5 ml-8 leading-relaxed line-clamp-1">{graphSummary.detail}</p>
      )}
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
  const approvalTransition = getApprovalTransitionState(item);

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
            {approvalTransition.available && (
              <span className="rounded-full border border-aurora-amber/20 bg-aurora-amber/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-aurora-amber">
                {approvalTransition.label}
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="text-[12px] text-text-body leading-relaxed mb-3">{item.summary || item.description || 'Mission is paused at a decision gate and needs your call.'}</p>
      {approvalTransition.available && (
        <div className="mb-3 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-text-body">
          <span className="font-semibold text-text-primary">Approval transition:</span> {approvalTransition.detail}
        </div>
      )}

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

function buildMissionControlExplanation(item, agent, tasks = []) {
  const transition = describeTaskTransition(item, tasks);
  const whyChosen = [
    item.routingReason || 'Commander did not persist a detailed routing rationale for this branch yet.',
    agent?.name
      ? `${agent.name} is holding this branch because its current lane matches the branch role better than the rest of the active fleet.`
      : 'This branch is currently unassigned, so Commander is leaving the lane open for reassignment or redirect.',
    item.providerOverride || item.modelOverride
      ? `Execution is biased toward ${item.providerOverride || 'the selected provider'} ${item.modelOverride || ''}`.trim()
      : null,
  ].filter(Boolean).slice(0, 3);

  const whyPaused = [];
  if (transition?.detail) {
    whyPaused.push(transition.detail);
  }
  if (item.status === 'needs_approval' || item.requiresApproval) {
    whyPaused.push('Commander paused this branch at a human gate because the current posture requires approval before execution continues.');
  }
  if (item.status === 'pending') {
    whyPaused.push('This branch is still in planning posture, so Commander has not released it into queued execution yet.');
  }
  if (item.status === 'blocked') {
    whyPaused.push('Commander is treating this branch as blocked because a dependency, approval, or upstream graph condition has not cleared yet.');
  }
  if (item.status === 'paused') {
    whyPaused.push('This branch is explicitly paused, so Commander is holding it out of the active lane until you resume or redirect it.');
  }
  if (item.riskLevel === 'high') {
    whyPaused.push('The branch is tagged high risk, which increases the chance Commander will stop for verification or human review.');
  }
  if (item.approvalLevel === 'human_required') {
    whyPaused.push('Approval posture is set to human required, so Commander should not let this branch self-advance.');
  }
  if (whyPaused.length === 0) {
    whyPaused.push('No strong pause pressure is recorded on this branch right now, so Commander should keep it moving unless you intervene.');
  }

  return {
    whyChosen,
    whyPaused: whyPaused.slice(0, 3),
  };
}

// ═══════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════

function Drawer({ item, agents, tasks, logs, interventions, approvalAudit, learningMemory, onNavigate, onClose, onApprove, onReject, onRetry, onStop, onCopy, onAcknowledge, onReopen, onSnooze }) {
  const [tab, setTab] = useState('timeline');
  const [feedback, setFeedback] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showRedirectForm, setShowRedirectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [redirectAgentId, setRedirectAgentId] = useState('');
  const [redirectProvider, setRedirectProvider] = useState('');
  const [redirectModel, setRedirectModel] = useState('');

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

  const agent = item ? agents.find(a => a.id === (item.agentId || item.agent_id)) : null;
  const availableAgents = agents.filter(candidate => !candidate.isSyntheticCommander);

  async function act(name, fn) {
    setActionLoading(name); setActionError(null);
    try { await fn(); } catch (e) { setActionError(`${name} failed: ${e.message}`); }
    finally { setActionLoading(null); }
  }

  useEffect(() => {
    if (!item) return;
    setRedirectAgentId(item.agentId || item.agent_id || '');
    setRedirectProvider(item.providerOverride || '');
    setRedirectModel(item.modelOverride || agent?.model || '');
    setShowRedirectForm(false);
  }, [item, item?.id, item?.agentId, item?.agent_id, item?.providerOverride, item?.modelOverride, agent?.model]);

  const selectedRedirectAgent = availableAgents.find(candidate => candidate.id === redirectAgentId) || null;

  useEffect(() => {
    if (!selectedRedirectAgent) return;
    if (!redirectProvider) setRedirectProvider(selectedRedirectAgent.provider || '');
    if (!redirectModel) setRedirectModel(selectedRedirectAgent.model || '');
  }, [selectedRedirectAgent, redirectProvider, redirectModel]);

  if (!item) return null;
  const cfg = stColor[item.status] || stColor.pending;
  const isMissionApproval = item.status === 'needs_approval';
  const isReviewApproval = item.urgency != null || (item.outputType != null && !item.mode);
  const isApproval = isMissionApproval || isReviewApproval;
  const isCompleted = ['completed', 'approved', 'done'].includes(item.status);
  const isRunning = item.status === 'running';
  const itemLogs = logs.filter(l => l.agentId === (item.agentId || item.agent_id));
  const explanation = buildMissionControlExplanation(item, agent, tasks);
  const latestBatchAudit = getLatestBatchCommandAudit(logs);
  const batchDoctrine = learningMemory?.doctrineById?.['batch-command-memory'] || null;
  const batchRoutingTrust = getBatchRoutingTrustSummary({ logs, doctrineItem: batchDoctrine });
  const decisionNarrative = getTaskDecisionNarrative(item, tasks, interventions);
  const launchBrief = getMissionCreateBrief(interventions, item);
  const launchReadiness = getMissionLaunchReadiness(interventions, item);
  const branchConnectorPosture = getTaskBranchExecutionPosture(item, interventions);
  const dispatchReadback = getTaskDispatchReadback(item, tasks);
  const planningReason = getTaskPlanningReason(item);
  const holdReason = getTaskExecutionHoldReason(item, tasks, interventions);
  const releaseReason = getTaskExecutionReleaseReason(item, tasks);
  const graphContract = getTaskGraphContractReadback(item, tasks, interventions);
  const graphSummary = getMissionGraphSummary(tasks, item.rootMissionId || item.id);
  const transition = describeTaskTransition(item, tasks);
  const approvalTransition = getApprovalTransitionState(item, interventions);
  const liveControlState = getTaskLiveControlState(item, interventions, tasks);
  const liveControlDraft = buildTaskControlActionDraft(liveControlState, item);
  const executableControlAction = getTaskExecutableControlAction({
    task: item,
    controlState: liveControlState,
    approvalTransition,
    redirectAgent: selectedRedirectAgent,
  });
  const controlActionMode = getTaskControlActionMode({
    controlState: liveControlState,
    executableAction: executableControlAction,
    controlActionDraft: liveControlDraft,
  });
  const hybridApprovalSummary = getHybridApprovalSummary({
    tasks: [item],
    reviews: isReviewApproval ? [item] : [],
    interventions,
    approvalAudit,
  });
  const failureTriage = getFailureTriageSummary({ tasks, interventions, logs, mission: item });
  const failureTriageDraft = buildFailureTriageActionDraft(failureTriage);
  const executionAudit = getExecutionAuditReadback({ tasks, interventions, approvalAudit, logs, mission: item, limit: 5 });

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
      {!isApproval && (
        <div className="px-5 py-3 border-b border-border bg-surface">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Commander route readback</div>
          <p className="mt-2 text-[12px] leading-relaxed text-text-body">
            {item.routingReason || 'Commander did not record a route rationale for this branch yet.'}
          </p>
          {(item.providerOverride || item.modelOverride) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {item.providerOverride && <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-text-body">{item.providerOverride}</span>}
              {item.modelOverride && <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-text-body">{item.modelOverride}</span>}
            </div>
          )}
        </div>
      )}

      {!isApproval && launchBrief && (
        <div className="px-5 py-3 border-b border-border bg-surface">
          <div className="rounded-2xl border border-aurora-teal/15 bg-[linear-gradient(135deg,rgba(45,212,191,0.08),rgba(255,255,255,0.02))] px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-teal font-semibold">Launch brief</div>
            <div className="mt-1 text-[12px] font-semibold text-text-primary">{launchBrief.objective}</div>
            <div className="mt-2 text-[11px] leading-relaxed text-text-body">{launchBrief.detail}</div>
            {launchBrief.successDefinition && (
              <div className="mt-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-text-body">
                Success definition: {launchBrief.successDefinition}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-text-body">
                {launchBrief.branchCount} branch{launchBrief.branchCount === 1 ? '' : 'es'}
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-text-body">
                {String(launchBrief.strategy || '').replaceAll('_', ' ')}
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-text-body">
                {String(launchBrief.verificationRequirement || '').replaceAll('_', ' ')}
              </span>
            </div>
            {launchBrief.constraints.length > 0 && (
              <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                Constraints: {launchBrief.constraints.join(' • ')}
              </div>
            )}
            {(planningReason || holdReason || releaseReason) && (
              <div className="mt-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-text-body">
                {planningReason ? `Execution order: ${planningReason}. ` : ''}{holdReason || releaseReason || 'This branch is clear to run when its lane is ready.'}
              </div>
            )}
            {graphContract?.available && (
              <div className="mt-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Graph contract</div>
                <div className="mt-1 text-[11px] font-semibold text-text-primary">{graphContract.label}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-text-body">{graphContract.detail}</div>
                {graphContract.releaseTrigger ? (
                  <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                    Release trigger: {formatReleaseTriggerLabel(graphContract.releaseTrigger)}.
                  </div>
                ) : null}
                {graphContract.nextMove ? (
                  <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                    Do next: {graphContract.nextMove}
                  </div>
                ) : null}
              </div>
            )}
            {(transition?.detail || graphSummary.available) && (
              <div className="mt-2 grid gap-2 xl:grid-cols-2">
                {transition?.detail && (
                  <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Transition</div>
                    <div className="mt-1 text-[11px] font-semibold text-text-primary">{transition.label}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-text-body">{transition.detail}</div>
                  </div>
                )}
                {graphSummary.available && (
                  <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Graph progress</div>
                    <div className="mt-1 text-[11px] font-semibold text-text-primary">{graphSummary.progressPercent}% complete</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-text-body">{graphSummary.detail}</div>
                  </div>
                )}
              </div>
            )}
            {approvalTransition.available && (
              <div className="mt-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Approval transition</div>
                <div className="mt-1 text-[11px] font-semibold text-text-primary">{approvalTransition.label}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-text-body">{approvalTransition.detail}</div>
                {approvalTransition.nextMove ? (
                  <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                    Do next: {String(approvalTransition.nextMove).replaceAll('_', ' ')}.
                  </div>
                ) : null}
              </div>
            )}
            {liveControlState?.available && liveControlState.kind !== 'flowing' && (
              <div className="mt-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Live control state</div>
                <div className="mt-1 text-[11px] font-semibold text-text-primary">{liveControlState.label}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-text-body">{liveControlState.detail}</div>
                {liveControlState.nextMove ? (
                  <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                    Do next: {String(liveControlState.nextMove).replaceAll('_', ' ')}.
                  </div>
                ) : null}
                {liveControlState.resolutionLabel ? (
                  <div className="mt-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-text-body">
                    <span className="font-semibold text-text-primary">Safest next move:</span> {liveControlState.resolutionLabel}. {liveControlState.resolutionDetail}
                    <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                      Resume posture: {liveControlState.canAutoResume
                        ? 'safe to resume automatically'
                        : liveControlState.shouldStayHeld
                          ? 'keep held until reviewed'
                          : 'active commander decision required'}.
                    </div>
                  </div>
                ) : null}
                {onNavigate && liveControlDraft ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => onNavigate('managedOps', { managedOpsRouteState: liveControlDraft })}
                      className="inline-flex items-center gap-2 rounded-xl border border-aurora-violet/20 bg-aurora-violet/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-violet"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {liveControlState.actionLabel}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {!isApproval && launchReadiness && (
        <div className="px-5 py-3 border-b border-border bg-surface">
          <div className="rounded-2xl border border-aurora-blue/15 bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.02))] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-blue font-semibold">Launch readiness</div>
                <div className="mt-1 text-[12px] font-semibold text-text-primary">{launchReadiness.title}</div>
              </div>
              <div className={cn(
                'rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
                launchReadiness.tone === 'teal'
                  ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                  : launchReadiness.tone === 'amber'
                    ? 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                    : 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
              )}>
                {launchReadiness.coveragePercent}% covered
              </div>
            </div>
            <div className="mt-2 text-[11px] leading-relaxed text-text-body">{launchReadiness.detail}</div>
            {launchReadiness.requiredSystems.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {launchReadiness.requiredSystems.map((system) => (
                  <span
                    key={system.key}
                    className={cn(
                      'rounded-full border px-2 py-1 text-[10px] font-semibold',
                      system.status === 'connected'
                        ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                        : system.status === 'degraded'
                          ? 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                          : 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
                    )}
                  >
                    {system.label}
                  </span>
                ))}
              </div>
            )}
            {launchReadiness.guardrails.length > 0 && (
              <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                Guardrails: {launchReadiness.guardrails.join(' • ')}
              </div>
            )}
          </div>
        </div>
      )}

      {!isApproval && branchConnectorPosture?.available && (
        <div className="px-5 py-3 border-b border-border bg-surface">
          <div className="rounded-2xl border border-aurora-violet/15 bg-[linear-gradient(135deg,rgba(167,139,250,0.08),rgba(255,255,255,0.02))] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-violet font-semibold">Branch connector posture</div>
                <div className="mt-1 text-[12px] font-semibold text-text-primary">{branchConnectorPosture.title}</div>
              </div>
              <div className={cn(
                'rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
                branchConnectorPosture.tone === 'teal'
                  ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                  : branchConnectorPosture.tone === 'amber'
                    ? 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                    : 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
              )}>
                {branchConnectorPosture.modes.length ? branchConnectorPosture.modes.join('/') : 'local-first'}
              </div>
            </div>
            <div className="mt-2 text-[11px] leading-relaxed text-text-body">{branchConnectorPosture.detail}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {branchConnectorPosture.fallbackStrategy && (
                <span className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-2 py-1 text-[10px] font-semibold text-aurora-blue">
                  Fallback: {formatFallbackStrategyLabel(branchConnectorPosture.fallbackStrategy)}
                </span>
              )}
              {branchConnectorPosture.preferredRole && (
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-text-body">
                  Preferred lane: {branchConnectorPosture.preferredRole}
                </span>
              )}
              {branchConnectorPosture.recommendedApprovalLevel && (
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-text-body">
                  Approval: {String(branchConnectorPosture.recommendedApprovalLevel).replaceAll('_', ' ')}
                </span>
              )}
            </div>
            {branchConnectorPosture.fallbackStrategy && (
              <div className="mt-2 text-[10px] leading-relaxed text-text-muted">
                {getFallbackStrategyDetail(branchConnectorPosture.fallbackStrategy)}
              </div>
            )}
          </div>
        </div>
      )}

      {!isApproval && dispatchReadback?.available && (
        <div className="px-5 py-3 border-b border-border bg-surface">
          <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold">Dispatch posture</div>
                <div className="mt-1 text-[12px] font-semibold text-text-primary">{dispatchReadback.title}</div>
              </div>
              <div className={cn(
                'rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
                dispatchReadback.tone === 'teal'
                  ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                  : dispatchReadback.tone === 'amber'
                    ? 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                    : dispatchReadback.tone === 'rose'
                      ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
                      : 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue'
              )}>
                {formatDispatchClassLabel(dispatchReadback.dispatchClass)}
              </div>
            </div>
            <div className="mt-2 text-[11px] leading-relaxed text-text-body">{dispatchReadback.detail}</div>
            <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
              Next move: {dispatchReadback.nextMove}
            </div>
          </div>
        </div>
      )}

      {!isApproval && (
        <div className="px-5 py-3 border-b border-border bg-surface">
          {(hybridApprovalSummary.available || failureTriage.available || executionAudit.available) && (
            <div className="mb-3 grid gap-3">
              {hybridApprovalSummary.available && (
                <div className="rounded-2xl border border-aurora-teal/15 bg-[linear-gradient(135deg,rgba(45,212,191,0.08),rgba(255,255,255,0.02))] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-teal font-semibold">Hybrid approval</div>
                      <div className="mt-1 text-[12px] font-semibold text-text-primary">{hybridApprovalSummary.title}</div>
                    </div>
                    <div className="rounded-full border border-aurora-amber/20 bg-aurora-amber/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-amber">
                      {hybridApprovalSummary.totalQueue} open
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] leading-relaxed text-text-body">{hybridApprovalSummary.detail}</div>
                  <div className="mt-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[10px] leading-relaxed text-text-muted">
                    <span className="font-semibold text-text-primary">Approval transition:</span> {hybridApprovalSummary.transitionLabel}. {hybridApprovalSummary.transitionDetail}
                    <div className="mt-1">
                      <span className="font-semibold text-text-primary">Approval posture:</span> {hybridApprovalSummary.resolutionLabel}. {hybridApprovalSummary.resolutionDetail}
                    </div>
                    <div className="mt-1">
                      Do next: {String(hybridApprovalSummary.nextMove || 'keep_flowing').replaceAll('_', ' ')}.
                    </div>
                  </div>
                  {hybridApprovalSummary.latestDecision && (
                    <div className="mt-2 text-[10px] leading-relaxed text-text-muted">
                      Latest decision: {hybridApprovalSummary.latestDecision.label}. {hybridApprovalSummary.latestDecision.detail}
                    </div>
                  )}
                </div>
              )}
              {failureTriage.available && (
                <div className="rounded-2xl border border-aurora-rose/15 bg-[linear-gradient(135deg,rgba(251,113,133,0.08),rgba(255,255,255,0.02))] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-rose font-semibold">Failure triage</div>
                      <div className="mt-1 text-[12px] font-semibold text-text-primary">{failureTriage.title}</div>
                    </div>
                    <div className="rounded-full border border-aurora-rose/20 bg-aurora-rose/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-rose">
                      {failureTriage.failedCount} active
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] leading-relaxed text-text-body">{failureTriage.detail}</div>
                  <div className="mt-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[10px] leading-relaxed text-text-muted">
                    <span className="font-semibold text-text-primary">Recovery mode:</span> {String(failureTriage.recoveryMode || 'generic_recovery').replaceAll('_', ' ')}.
                    <div className="mt-1">
                      <span className="font-semibold text-text-primary">Safest next move:</span> {failureTriage.resolutionLabel}. {failureTriage.resolutionDetail}
                    </div>
                    <div className="mt-1">
                      Verdict {failureTriage.verdict} • Do next {failureTriage.nextMove}
                    </div>
                    {failureTriage.graphContract?.label ? (
                      <div className="mt-1">
                        Graph contract: {failureTriage.graphContract.label}.
                      </div>
                    ) : null}
                  </div>
              {onNavigate && failureTriageDraft ? (
                <div className="mt-3">
                  <button
                        type="button"
                        onClick={() => onNavigate('managedOps', { managedOpsRouteState: failureTriageDraft })}
                        className="rounded-2xl border border-aurora-rose/20 bg-aurora-rose/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-rose transition-colors hover:bg-aurora-rose/15"
                      >
                        {failureTriage.actionLabel || 'Stage recovery move'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              {executionAudit.available && (
                <div className="rounded-2xl border border-aurora-blue/15 bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.02))] px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-blue font-semibold">Execution control audit</div>
                  <div className="mt-2 space-y-2">
                    {executionAudit.entries.slice(0, 3).map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-semibold text-text-primary">{entry.label}</div>
                          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{entry.category}</div>
                        </div>
                        <div className="mt-1 text-[11px] leading-relaxed text-text-body">{entry.detail}</div>
                        {(entry.verdict || entry.nextMove) && (
                          <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                            {[entry.verdict ? `Verdict ${entry.verdict}` : null, entry.nextMove ? `Next ${entry.nextMove}` : null].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-2xl border border-aurora-violet/15 bg-[linear-gradient(135deg,rgba(167,139,250,0.08),rgba(96,165,250,0.04))] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-violet font-semibold">Why Commander Chose This</div>
              <div className="mt-2 space-y-2">
                {explanation.whyChosen.map((reason) => (
                  <div key={reason} className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-text-body">
                    {reason}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-aurora-amber/15 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(244,114,182,0.03))] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-amber font-semibold">Why Commander Paused This</div>
              <div className="mt-2 space-y-2">
                {explanation.whyPaused.map((reason) => (
                  <div key={reason} className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-text-body">
                    {reason}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {decisionNarrative.available && (
            <div className="mt-3 rounded-2xl border border-aurora-blue/15 bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.02))] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-blue font-semibold">Decision narrative</div>
              <div className="mt-2 text-[12px] font-semibold text-text-primary">{decisionNarrative.title}</div>
              <div className="mt-2 text-[11px] leading-relaxed text-text-body">{decisionNarrative.detail}</div>
              {decisionNarrative.nextMove ? (
                <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                  Do next: {String(decisionNarrative.nextMove).replaceAll('_', ' ')}
                </div>
              ) : null}
              {controlActionMode.available && controlActionMode.helperText ? (
                <div className="mt-3 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[10px] leading-relaxed text-text-muted">
                  {controlActionMode.helperText}
                </div>
              ) : null}
            </div>
          )}
          {(batchDoctrine || latestBatchAudit) && (
            <div className="mt-3 rounded-2xl border border-aurora-blue/15 bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.02))] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-blue font-semibold">Grouped command doctrine</div>
              <div className="mt-2 text-[11px] leading-relaxed text-text-body">
                {batchRoutingTrust.detail}
              </div>
              {latestBatchAudit && (
                <div className="mt-2 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-text-body">
                  Latest grouped action: {latestBatchAudit.message}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {actionError && <div className="px-5 py-2 border-b border-aurora-rose/10 bg-aurora-rose/5 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-aurora-rose shrink-0" /><span className="text-[11px] text-aurora-rose flex-1">{actionError}</span><button onClick={() => setActionError(null)} className="text-[10px] text-aurora-rose font-bold">Dismiss</button></div>}

      <div className="flex border-b border-border px-5 shrink-0">
        {['timeline', 'history', 'output', 'notes'].map(t => (
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

      {!isCompleted && !isApproval && showRedirectForm && (
        <div className="shrink-0 border-t border-border px-5 py-4 bg-surface">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-blue font-semibold">Interrupt + Redirect</div>
              <div className="mt-1 text-[12px] text-text-body">Pause this branch’s current lane, redirect it, and send it back to queued execution.</div>
            </div>
            <button onClick={() => setShowRedirectForm(false)} className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Close</button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <label className="block">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted mb-2">Redirect to agent</div>
              <select
                value={redirectAgentId}
                onChange={(e) => {
                  const nextAgent = availableAgents.find(candidate => candidate.id === e.target.value) || null;
                  setRedirectAgentId(e.target.value);
                  setRedirectProvider(nextAgent?.provider || '');
                  setRedirectModel(nextAgent?.model || '');
                }}
                className="w-full rounded-xl border border-border bg-surface-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-aurora-teal/40"
              >
                <option value="">Unassigned</option>
                {availableAgents.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.name} {candidate.role ? `(${candidate.role})` : ''}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted mb-2">Provider override</div>
                <input
                  value={redirectProvider}
                  onChange={(e) => setRedirectProvider(e.target.value)}
                  placeholder="Adaptive"
                  className="w-full rounded-xl border border-border bg-surface-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-aurora-teal/40"
                />
              </label>
              <label className="block">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted mb-2">Model override</div>
                <input
                  value={redirectModel}
                  onChange={(e) => setRedirectModel(e.target.value)}
                  placeholder="Use agent default"
                  className="w-full rounded-xl border border-border bg-surface-input px-3 py-2.5 text-sm text-text-primary outline-none focus:border-aurora-teal/40"
                />
              </label>
            </div>
          </div>
        </div>
      )}

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
            <button
              onClick={() => setShowRedirectForm((prev) => !prev)}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-blue bg-aurora-blue/5 border border-aurora-blue/20 rounded-xl hover:bg-aurora-blue/10"
            >
              <GitBranch className="w-3.5 h-3.5" />Redirect
            </button>
            {showRedirectForm && (
              <button
                onClick={() => act('Redirect', () => interruptAndRedirectTask(item.id, {
                  agentId: redirectAgentId || null,
                  providerOverride: redirectProvider.trim() || null,
                  modelOverride: redirectModel.trim() || null,
                }, agents))}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-teal bg-aurora-teal/5 border border-aurora-teal/20 rounded-xl hover:bg-aurora-teal/10"
              >
                {actionLoading === 'Redirect' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}Interrupt + Redirect
              </button>
            )}
            <button
              onClick={() => {
                if (onNavigate && failureTriageDraft && failureTriage.topFailure?.id === item.id) {
                  onNavigate('managedOps', { managedOpsRouteState: failureTriageDraft });
                  return;
                }
                act('Rerun', () => onRetry(item.id));
              }}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-amber bg-aurora-amber/5 border border-aurora-amber/20 rounded-xl hover:bg-aurora-amber/10"
            >
              {actionLoading === 'Rerun' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              {failureTriageDraft && failureTriage.topFailure?.id === item.id
                ? (failureTriage.actionLabel || 'Run recovery move')
                : 'Rerun'}
            </button>
            {executableControlAction.available && executableControlAction.kind === 'release' && (
              <button
                onClick={() => act('Release', () => onApprove(item.id))}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-black bg-aurora-teal border border-aurora-teal/20 rounded-xl hover:bg-[#00ebd8]"
              >
                {actionLoading === 'Release' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {executableControlAction.label}
              </button>
            )}
            {executableControlAction.available && executableControlAction.kind === 'hold' && (
              <button
                onClick={() => act('Hold', () => onStop(item.id))}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-rose bg-aurora-rose/5 border border-aurora-rose/20 rounded-xl hover:bg-aurora-rose/10"
              >
                {actionLoading === 'Hold' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}
                {executableControlAction.label}
              </button>
            )}
            {executableControlAction.available && executableControlAction.kind === 'reroute' && selectedRedirectAgent && (
              <button
                onClick={() => act('GraphReroute', () => interruptAndRedirectTask(item.id, {
                  agentId: selectedRedirectAgent.id,
                  providerOverride: redirectProvider.trim() || null,
                  modelOverride: redirectModel.trim() || null,
                }, agents))}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-blue bg-aurora-blue/5 border border-aurora-blue/20 rounded-xl hover:bg-aurora-blue/10"
              >
                {actionLoading === 'GraphReroute' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
                {executableControlAction.label}
              </button>
            )}
            {onNavigate && liveControlDraft ? (
              <button
                onClick={() => onNavigate('managedOps', { managedOpsRouteState: liveControlDraft })}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-violet bg-aurora-violet/5 border border-aurora-violet/20 rounded-xl hover:bg-aurora-violet/10"
              >
                <Sparkles className="w-3.5 h-3.5" />{controlActionMode.stageLabel || liveControlState.actionLabel}
              </button>
            ) : null}
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

function IntelSidebar({ tasks, approvals, completed, agents, schedules, logs, interventions, learningMemory, connectedSystems, truth, branchConnectorPressure, groupedConnectorBlockers, missionDispatchPressure, approvalAudit = [], onOpenApprovals, onOpenSystems, onOpenCreator, onOpenOps, onNavigate }) {
  const totalCost = tasks.reduce((sum, task) => sum + Number(task.costUsd || 0), 0);
  const failedCount = tasks.filter(t => t.status === 'failed' || t.status === 'error').length;
  const runningCount = tasks.filter(t => t.status === 'running').length;
  const avgApprovalWait = approvals.length > 0 ? Math.round(approvals.reduce((s, a) => s + (a.waitingMs || 0), 0) / approvals.length / 60000) : 0;
  const timelineEntries = buildTimelineEntries({ tasks, reviews: approvals, logs, connectedSystems });
  const approvalDoctrine = learningMemory?.doctrineById?.['hybrid-approval-memory'] || null;
  const failureDoctrine = learningMemory?.doctrineById?.['failure-triage-memory'] || null;
  const auditDoctrine = learningMemory?.doctrineById?.['execution-audit-memory'] || null;
  const commanderNextMove = getCommanderNextMove({
    tasks,
    reviews: approvals,
    schedules,
    agents,
    interventions,
    logs,
    approvalAudit,
    learningMemory,
  });

  // Derive recommendations from real data
  const recs = [];
  if (auditDoctrine) {
    recs.push({
      type: 'audit',
      text: `${auditDoctrine.title}. ${auditDoctrine.detail}`,
      imp: failureDoctrine?.tone === 'rose' || approvalDoctrine?.tone === 'amber' ? 'high' : 'med',
    });
  }
  if (failedCount > 0) {
    const failedAgents = [...new Set(tasks.filter(t => t.status === 'failed' || t.status === 'error').map(t => t.agentName || 'Unknown'))];
    recs.push({ type: 'anomaly', text: `${failedCount} failed task${failedCount > 1 ? 's' : ''} from ${failedAgents.join(', ')}. Check agent health and retry or reassign.`, imp: 'high' });
  }
  if (avgApprovalWait > 3) {
    recs.push({ type: 'bottleneck', text: `Approval queue averaging ${avgApprovalWait}m wait. Consider auto-approve rules for low-risk items.`, imp: 'high' });
  }
  if (branchConnectorPressure.available && branchConnectorPressure.score > 0) {
    const groupedFix = groupedConnectorBlockers?.topGroup;
    const topBranchName = groupedFix?.affectedCount > 1
      ? `${groupedFix.affectedCount} guarded branches`
      : branchConnectorPressure.topBranches[0]?.title || 'the top guarded branch';
    recs.push({
      type: 'connector',
      text: groupedFix?.affectedCount > 1
        ? `${groupedFix.title}. ${groupedFix.detail} Do next: ${groupedFix.order} Fastest safe move: ${groupedFix.correctiveAction?.label ? `${groupedFix.correctiveAction.label.toLowerCase()} across ${topBranchName}` : `clear the blocked connector lane across ${topBranchName}`} before scaling anything behind it.`
        : `${branchConnectorPressure.title}. ${branchConnectorPressure.detail} Fastest safe move: ${branchConnectorPressure.topCorrectiveAction?.label ? `${branchConnectorPressure.topCorrectiveAction.label.toLowerCase()} on ${topBranchName}` : `focus on ${topBranchName} and clear the blocked connector lane`} before scaling anything behind it.`,
      imp: branchConnectorPressure.tone === 'rose' ? 'high' : 'med',
    });
  }
  if (missionDispatchPressure?.available) {
    recs.push({
      type: 'dispatch',
      text: `${missionDispatchPressure.title}. ${missionDispatchPressure.detail} Do next: ${missionDispatchPressure.nextMove}`,
      imp: missionDispatchPressure.tone === 'rose' ? 'high' : missionDispatchPressure.tone === 'amber' ? 'med' : 'low',
    });
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
        {(approvalDoctrine || failureDoctrine || commanderNextMove?.available) && (
          <div className="mb-3 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Control order</div>
            <div className="mt-2 text-[12px] font-semibold text-text-primary">{commanderNextMove?.title || failureDoctrine?.title || approvalDoctrine?.title}</div>
            <div className="mt-1 text-[11px] leading-relaxed text-text-body">{commanderNextMove?.detail || failureDoctrine?.detail || approvalDoctrine?.detail}</div>
            {commanderNextMove?.available && onNavigate ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onNavigate('managedOps', {
                    managedOpsRouteState: commanderNextMove.dispatchActionBrief
                      ? { tab: 'create', quickstartPrompt: commanderNextMove.opsPrompt, notice: `Commander staged the next control move from Mission Control: ${commanderNextMove.actionLabel}.`, dispatchActionBrief: commanderNextMove.dispatchActionBrief }
                      : commanderNextMove.connectorActionBrief
                        ? { tab: 'create', quickstartPrompt: commanderNextMove.opsPrompt, notice: `Commander staged the next control move from Mission Control: ${commanderNextMove.actionLabel}.`, connectorActionBrief: commanderNextMove.connectorActionBrief }
                        : {
                            tab: 'create',
                            quickstartPrompt: commanderNextMove.opsPrompt,
                            notice: `Commander staged the next control move from Mission Control: ${commanderNextMove.actionLabel}.`,
                          },
                  })}
                  className="inline-flex items-center gap-2 rounded-xl border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-blue"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Stage next move
                </button>
              </div>
            ) : null}
          </div>
        )}
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

function PlannerTab({ schedules, agents, recurringCandidates = [], onToggle, onDispatch, onStageRecurringAction }) {
  const enabled = schedules.filter(s => s.enabled);
  const paused = schedules.filter(s => !s.enabled);
  const findRecurringCandidate = (schedule) => recurringCandidates.find((candidate) => {
    const scheduleName = String(schedule.name || '').trim().toLowerCase();
    const candidateName = String(candidate.title || '').trim().toLowerCase();
    return scheduleName && candidateName && (scheduleName === candidateName || scheduleName.includes(candidateName) || candidateName.includes(scheduleName));
  }) || null;

  return (<div className="flex-1 overflow-y-auto no-scrollbar pr-1">
    {/* Queued / upcoming */}
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3"><Calendar className="w-3.5 h-3.5 text-aurora-teal" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Upcoming Schedules ({enabled.length})</span></div>
      {enabled.length === 0 && <p className="text-center text-text-disabled py-8 text-sm">No active schedules. Create one in Supabase to get started.</p>}
      <div className="space-y-2">
        {enabled.map(s => {
          const agent = agents.find(a => a.id === s.agentId);
          const lCfg = stColor[s.lastResult] || stColor.pending;
          const recurringCandidate = findRecurringCandidate(s);
          const recurringTrust = getRecurringAutonomyTuningSummary(recurringCandidate);
          const recurringAction = recurringCandidate ? getRecurringBriefFitAction([recurringCandidate], [], []) : null;
          const recurringChange = recurringCandidate ? getRecurringChangeReadback(recurringCandidate) : null;
          const recurringPayback = recurringCandidate ? getRecurringChangePayback(recurringCandidate) : null;
          const recurringVerdict = recurringCandidate ? getRecurringPostChangeVerdict(recurringCandidate) : null;
          const recurringNextCorrection = recurringCandidate ? getRecurringNextCorrection(recurringCandidate) : null;
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
                {recurringAction?.available && (
                  <button onClick={() => onStageRecurringAction?.(s, recurringCandidate, recurringAction)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-aurora-blue bg-aurora-blue/5 border border-aurora-blue/20 rounded-lg hover:bg-aurora-blue/10">
                    <Sparkles className="w-3 h-3" />Stage {recurringAction.actionLabel}
                  </button>
                )}
              </div>
              {recurringCandidate?.launchBrief && (
                <div className="mt-3 ml-8 rounded-2xl border border-aurora-blue/15 bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.02))] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-blue">Recurring brief fit</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-text-body">{recurringTrust.detail}</div>
                  <div className="mt-2 text-[10px] leading-relaxed text-text-muted">
                    Saved brief: {recurringCandidate.launchBrief.objective}
                  </div>
                  {recurringChange?.available && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Latest saved change</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-body">{recurringChange.detail}</div>
                    </div>
                  )}
                  {recurringPayback?.available && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Change payback</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-body">{recurringPayback.detail}</div>
                    </div>
                  )}
                  {recurringVerdict?.available && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Post-change verdict</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-body">{recurringVerdict.detail}</div>
                      {(recurringVerdict.previousPosture || recurringVerdict.currentPosture) && (
                        <div className="mt-2 grid gap-2 md:grid-cols-2 text-[10px] leading-5 text-text-muted">
                          {recurringVerdict.previousPosture && (
                            <div>
                              Previous: {String(recurringVerdict.previousPosture.cadence || 'not_set').replaceAll('_', ' ')} / {String(recurringVerdict.previousPosture.approvalPosture || 'not_set').replaceAll('_', ' ')}
                            </div>
                          )}
                          {recurringVerdict.currentPosture && (
                            <div>
                              Current: {String(recurringVerdict.currentPosture.cadence || 'not_set').replaceAll('_', ' ')} / {String(recurringVerdict.currentPosture.approvalPosture || 'not_set').replaceAll('_', ' ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {recurringNextCorrection?.available && (
                    <div className="mt-2 rounded-xl border border-aurora-blue/15 bg-aurora-blue/[0.05] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-blue">Next move</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-body">{recurringNextCorrection.detail}</div>
                    </div>
                  )}
                </div>
              )}
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
            const recurringCandidate = findRecurringCandidate(s);
            const recurringTrust = getRecurringAutonomyTuningSummary(recurringCandidate);
            const recurringAction = recurringCandidate ? getRecurringBriefFitAction([recurringCandidate], [], []) : null;
            const recurringChange = recurringCandidate ? getRecurringChangeReadback(recurringCandidate) : null;
            const recurringPayback = recurringCandidate ? getRecurringChangePayback(recurringCandidate) : null;
            const recurringVerdict = recurringCandidate ? getRecurringPostChangeVerdict(recurringCandidate) : null;
            const recurringNextCorrection = recurringCandidate ? getRecurringNextCorrection(recurringCandidate) : null;
            return (
              <div key={s.id} className="px-4 py-3 rounded-2xl border border-border bg-surface">
                <div className="flex items-center gap-3">
                  <AgentAvatar agent={agent} name={agent?.name || '?'} />
                  <span className="text-[12px] font-semibold text-text-body flex-1 truncate">{s.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-text-muted">Paused</span>
                </div>
                <div className="flex items-center gap-2 mt-2 ml-8">
                  <button onClick={() => onToggle(s.id, true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-aurora-teal bg-aurora-teal/5 border border-aurora-teal/20 rounded-lg hover:bg-aurora-teal/10">Enable</button>
                  {recurringAction?.available && (
                    <button onClick={() => onStageRecurringAction?.(s, recurringCandidate, recurringAction)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-aurora-blue bg-aurora-blue/5 border border-aurora-blue/20 rounded-lg hover:bg-aurora-blue/10">
                      <Sparkles className="w-3 h-3" />Stage {recurringAction.actionLabel}
                    </button>
                  )}
                </div>
                {recurringCandidate?.launchBrief && (
                  <div className="mt-3 ml-8 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Paused because</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-text-body">{recurringTrust.recoveryLabel}</div>
                    {recurringChange?.available && (
                      <div className="mt-2 text-[10px] leading-relaxed text-text-muted">{recurringChange.detail}</div>
                    )}
                    {recurringPayback?.available && (
                      <div className="mt-2 text-[10px] leading-relaxed text-text-muted">{recurringPayback.detail}</div>
                    )}
                    {recurringVerdict?.available && (
                      <div className="mt-2 text-[10px] leading-relaxed text-text-muted">
                        {recurringVerdict.detail}
                        {recurringVerdict.previousPosture || recurringVerdict.currentPosture
                          ? ` Previous: ${String(recurringVerdict.previousPosture?.cadence || 'not_set').replaceAll('_', ' ')} / ${String(recurringVerdict.previousPosture?.approvalPosture || 'not_set').replaceAll('_', ' ')}. Current: ${String(recurringVerdict.currentPosture?.cadence || 'not_set').replaceAll('_', ' ')} / ${String(recurringVerdict.currentPosture?.approvalPosture || 'not_set').replaceAll('_', ' ')}.`
                          : ''}
                      </div>
                    )}
                    {recurringNextCorrection?.available && (
                      <div className="mt-2 text-[10px] leading-relaxed text-aurora-blue">{recurringNextCorrection.detail}</div>
                    )}
                  </div>
                )}
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

export function MissionControlView({ launchDraft = null, onConsumeLaunchDraft, onNavigate }) {
  const { setPendingCount, setSettingsOpen } = useSystemState();
  const { interventions } = useTaskInterventions();
  const { auditTrail } = useApprovalAudit();
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
    setPendingCount(p.length + t.filter(task => task.status === 'needs_approval' || task.requiresApproval || task.lane === 'approvals').length);
  }, [setPendingCount]);

  // Initial mission data load for the screen.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { const u = subscribeToPendingReviews(() => reload()); return u; }, [reload]);
  useEffect(() => { const u = subscribeToTasks(() => reload()); return u; }, [reload]);

  const missionApprovals = useMemo(
    () => tasks.filter(task => task.status === 'needs_approval' || task.requiresApproval || task.lane === 'approvals'),
    [tasks]
  );
  const approvalItems = useMemo(() => [...missionApprovals, ...approvals], [missionApprovals, approvals]);
  const completedItems = useMemo(
    () => [
      ...tasks.filter(task => ['done', 'completed'].includes(task.status)),
      ...completed,
    ],
    [tasks, completed]
  );
  const operationalTasks = useMemo(
    () => tasks.filter(task => !['done', 'completed'].includes(task.status) && !(task.status === 'needs_approval' || task.requiresApproval || task.lane === 'approvals')),
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
  const recurringCandidates = useMemo(
    () => getAutomationCandidates(tasks, 150, interventions, []),
    [tasks, interventions]
  );
  const branchConnectorPressure = useMemo(
    () => getBranchConnectorPressureSummary(tasks, interventions),
    [tasks, interventions]
  );
  const missionDispatchPressure = useMemo(
    () => getMissionDispatchPressureSummary(tasks),
    [tasks]
  );
  const commanderNextMove = useMemo(
    () => getCommanderNextMove({ tasks, reviews: approvalItems, schedules, agents, interventions, logs, approvalAudit: auditTrail, costData: null, learningMemory }),
    [tasks, approvalItems, schedules, agents, interventions, logs, auditTrail, learningMemory]
  );
  const groupedConnectorBlockers = useMemo(
    () => getGroupedConnectorBlockers(tasks, interventions),
    [tasks, interventions]
  );

  const running = tasks.filter(t => t.status === 'running' || t.status === 'queued').length;
  const failed = tasks.filter(t => ['failed', 'error', 'blocked', 'cancelled'].includes(t.status)).length;

  const criticalItems = useMemo(() => {
    const c = [];
    approvalItems.filter(a => a.urgency === 'critical' || a.status === 'needs_intervention' || a.priority >= 8).forEach(a => c.push(a));
    const guardedTasks = tasks
      .filter(t => !['completed', 'done', 'cancelled'].includes(t.status))
      .map((task) => ({ task, connectorPosture: getTaskBranchExecutionPosture(task, interventions) }))
      .filter((entry) => entry.connectorPosture.requiresHumanGate || entry.connectorPosture.fallbackStrategy === 'guarded_external')
      .sort((a, b) => Number(b.task.priority || 0) - Number(a.task.priority || 0))
      .slice(0, 2)
      .map((entry) => ({
        ...entry.task,
        summary: `${formatBranchConnectorBlocker(entry.connectorPosture) || entry.task.summary}${getBranchConnectorCorrectiveAction(entry.connectorPosture)?.detail ? ` ${getBranchConnectorCorrectiveAction(entry.connectorPosture).detail}` : ''}`,
      }));
    tasks.filter(t => ['failed', 'error', 'blocked'].includes(t.status)).slice(0, 2).forEach(t => c.push(t));
    guardedTasks.forEach((task) => {
      if (!c.find((entry) => entry.id === task.id)) c.push(task);
    });
    const scoreForNextMove = (entry) => {
      if (!commanderNextMove?.available) return 0;
      const source = commanderNextMove.source;
      if (source === 'failure_triage') return ['failed', 'error', 'blocked'].includes(entry.status) ? 100 : 0;
      if (source === 'hybrid_approval') return entry.status === 'needs_approval' || entry.requiresApproval || entry.urgency != null ? 100 : 0;
      if (source === 'grouped_connector_blocker' || source === 'connector_branch_pressure') {
        const posture = getTaskBranchExecutionPosture(entry, interventions);
        return posture.requiresHumanGate || posture.fallbackStrategy === 'guarded_external' ? 100 : 0;
      }
      if (source === 'dispatch_pressure' || source === 'graph_contract') {
        const dispatchReadback = getTaskDispatchReadback(entry, tasks);
        return dispatchReadback?.label === 'Held upstream' || String(dispatchReadback?.label || '').toLowerCase().includes('serialized') ? 100 : 0;
      }
      return 0;
    };
    return c
      .map((entry) => {
        const liveControlState = getTaskLiveControlState(entry, interventions, tasks);
        const nextSummary = entry.summary
          || (liveControlState?.available && liveControlState.kind !== 'flowing'
            ? `${liveControlState.label}. ${liveControlState.detail}`
            : entry.description);
        return {
          ...entry,
          liveControlState,
          summary: nextSummary,
        };
      })
      .sort((a, b) => {
        const nextMoveDelta = scoreForNextMove(b) - scoreForNextMove(a);
        if (nextMoveDelta !== 0) return nextMoveDelta;
        return Number(b.priority || 0) - Number(a.priority || 0);
      })
      .slice(0, 3);
  }, [approvalItems, tasks, interventions, commanderNextMove]);

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
  function handleStageRecurringAction(schedule, recurringCandidate, recurringAction) {
    if (!recurringAction?.available || !recurringAction.opsPrompt) return;
    onNavigate?.('managedOps', {
      managedOpsRouteState: {
        tab: 'create',
        quickstartPrompt: recurringAction.opsPrompt,
        notice: `Staged recurring ops draft from ${schedule?.name || recurringCandidate?.title || 'the selected recurring flow'}: ${recurringAction.actionLabel}.`,
        recurringActionBrief: {
          taskId: recurringAction.taskId,
          title: recurringAction.title,
          actionLabel: recurringAction.actionLabel,
          currentPosture: recurringAction.currentPosture || {
            cadence: schedule?.cadence || 'weekly',
            approvalPosture: schedule?.approvalRequired ? 'human_required' : 'auto_low_risk',
            missionMode: schedule?.approvalRequired ? 'watch_and_approve' : 'do_now',
            paused: !schedule?.enabled,
          },
          proposedPosture: recurringAction.proposedPosture,
          expectedImprovement: recurringAction.expectedImprovement,
          verificationTarget: recurringAction.verificationTarget,
          successCriteria: recurringAction.successCriteria,
          rollbackCriteria: recurringAction.rollbackCriteria,
        },
      },
    });
  }
  async function handleLaunchMission(payload) {
    const priorityScore = payload.priority === 'critical' ? 9 : payload.priority === 'low' ? 2 : 5;
    await createMission({ ...payload, priorityScore }, agents);
    await reload();
  }
  function handleCopy(item) { navigator.clipboard?.writeText(`${item.name || item.title}\nStatus: ${item.status}\nAgent: ${item.agentName || ''}\nCost: ${item.actualCostCents != null ? `$${(item.actualCostCents / 100).toFixed(2)}` : `$${item.costUsd?.toFixed(3) || '0.000'}`}`); }

  const selectedItem = sel ? [...tasks, ...approvalItems, ...completedItems].find(i => i.id === sel) : null;
  const creatorIsOpen = creatorOpen || !!launchDraft;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const primaryAgent = agents.find(agent => /tony|atlas/i.test(agent.name || '')) || agents.find(agent => agent.role === 'commander') || agents[0];
  const truth = useCommandCenterTruth();
  const { connectedSystems } = useConnectedSystems();
  const { policies: routingPolicies } = useRoutingPolicies();
  const topPolicy = routingPolicies.find((policy) => policy.isDefault) || routingPolicies[0] || null;
  const topPolicyDelta = getPolicyDeltaReadback(routingPolicies.find((policy) => policy.isDefault) || routingPolicies[0] || null, tasks, [], logs);
  const topPolicyActionGuidance = getPolicyActionGuidance(topPolicy, tasks, [], logs, agents);
  const topTradeoffOutcome = getTradeoffOutcomeSummary(topPolicyActionGuidance.swap);
  const topTradeoffCorrectiveAction = getTradeoffCorrectiveAction(topTradeoffOutcome, topPolicyActionGuidance.swap);

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
            <button onClick={() => setCreatorOpen(true)} className="ui-button-primary flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-black shadow-glow-teal">
              <Plus className="w-4 h-4" /> Spin up a Mission
            </button>
          }
          sideContent={
            <div className="ui-panel min-w-[260px] px-4 py-4 backdrop-blur-sm">
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
                <div className="ui-panel-soft mt-1 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted mb-1">Readback</div>
                  <p className="text-[12px] leading-relaxed text-text-body">
                    {approvalItems.length > 0
                      ? 'Human gates are the only real drag right now.'
                      : running > 0
                        ? 'Execution is moving cleanly with no immediate choke point.'
                        : 'The deck is calm. Good time to launch the next mission.'}
                  </p>
                </div>
                {topPolicyDelta?.title && (
                  <div className="ui-panel-soft mt-2 px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted mb-1">Policy delta</div>
                    <div className="text-[12px] font-semibold text-text-primary">{topPolicyDelta.title}</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-text-body">
                      {topPolicyDelta.providerDelta}. {topPolicyDelta.modelDelta}. {topPolicyDelta.approvalDelta}.
                    </p>
                    {topPolicyActionGuidance.evidence.length ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                        Evidence: {topPolicyActionGuidance.evidence.slice(0, 2).join(' • ')}
                      </p>
                    ) : null}
                    {topPolicyActionGuidance.swap.enabled ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-aurora-blue">
                        {topPolicyActionGuidance.swap.signal}
                      </p>
                    ) : null}
                    {topTradeoffOutcome.available ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                        Tradeoff payback: <span className="font-semibold text-text-primary">{topTradeoffOutcome.outcomeLabel}</span>. {topTradeoffOutcome.detail}
                      </p>
                    ) : null}
                    {topTradeoffOutcome.available && topTradeoffCorrectiveAction.label ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-text-body">
                        <span className="font-semibold text-text-primary">Corrective action:</span> {topTradeoffCorrectiveAction.label}. {topTradeoffCorrectiveAction.detail}
                      </p>
                    ) : null}
                    {topTradeoffOutcome.available && topTradeoffCorrectiveAction.expectedImpact ? (
                      <div className="mt-2 rounded-2xl border border-white/[0.06] bg-black/10 px-3 py-2.5">
                        {topTradeoffCorrectiveAction.postureComparison ? (
                          <>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Posture shift</div>
                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                              <div className="ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Current</div>
                                <div className="mt-1">{topTradeoffCorrectiveAction.postureComparison.current}</div>
                              </div>
                              <div className="ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
                                <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-blue">Proposed</div>
                                <div className="mt-1">{topTradeoffCorrectiveAction.postureComparison.proposed}</div>
                              </div>
                            </div>
                          </>
                        ) : null}
                        <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-teal">Expected improvement</div>
                        <div className="mt-1 text-[11px] leading-relaxed text-text-body">
                          {topTradeoffCorrectiveAction.expectedImpact.primary}
                        </div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-aurora-amber">Expected tradeoff</div>
                        <div className="mt-1 text-[11px] leading-relaxed text-text-muted">
                          {topTradeoffCorrectiveAction.expectedImpact.tradeoff}
                        </div>
                        {topTradeoffCorrectiveAction.doctrineImpact ? (
                          <>
                            <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-aurora-violet">Doctrine confidence impact</div>
                            <div className="mt-1 text-[11px] leading-relaxed text-text-body">
                              {topTradeoffCorrectiveAction.doctrineImpact.confidence}
                            </div>
                            <div className="mt-1 text-[11px] leading-relaxed text-text-muted">
                              {topTradeoffCorrectiveAction.doctrineImpact.trust}
                            </div>
                          </>
                        ) : null}
                        {topTradeoffCorrectiveAction.verificationImpact ? (
                          <>
                            <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-aurora-blue">Recommended verification</div>
                            <div className="mt-1 text-[11px] font-semibold leading-relaxed text-text-primary">
                              {topTradeoffCorrectiveAction.verificationImpact.threshold}
                            </div>
                            <div className="mt-1 text-[11px] leading-relaxed text-text-muted">
                              {topTradeoffCorrectiveAction.verificationImpact.detail}
                            </div>
                          </>
                        ) : null}
                        {topTradeoffCorrectiveAction.successCriteria?.length ? (
                          <>
                            <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-aurora-green">Success criteria</div>
                            <div className="mt-1 text-[11px] leading-relaxed text-text-muted">
                              {topTradeoffCorrectiveAction.successCriteria.slice(0, 2).join(' • ')}
                            </div>
                          </>
                        ) : null}
                        {topTradeoffCorrectiveAction.rollbackCriteria?.length ? (
                          <>
                            <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-aurora-rose">Rollback criteria</div>
                            <div className="mt-1 text-[11px] leading-relaxed text-text-muted">
                              {topTradeoffCorrectiveAction.rollbackCriteria.slice(0, 2).join(' • ')}
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => topPolicy && onNavigate?.('intelligence', { intelligenceRouteState: { tab: 'routing', selectedPolicyId: topPolicy.id, actionContext: topPolicyActionGuidance.open } })}
                        className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-primary"
                        title={topPolicyActionGuidance.open.detail}
                      >
                        Open policy
                      </button>
                      <button
                        type="button"
                        onClick={() => topPolicy && topPolicyActionGuidance.harden.enabled && onNavigate?.('intelligence', { intelligenceRouteState: { tab: 'routing', selectedPolicyId: topPolicy.id, adjustment: 'harden', actionContext: topPolicyActionGuidance.harden } })}
                        className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-amber disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!topPolicyActionGuidance.harden.enabled}
                        title={topPolicyActionGuidance.harden.detail}
                      >
                        Harden approval
                      </button>
                      <button
                        type="button"
                        onClick={() => topPolicy && topPolicyActionGuidance.loosen.enabled && onNavigate?.('intelligence', { intelligenceRouteState: { tab: 'routing', selectedPolicyId: topPolicy.id, adjustment: 'loosen', actionContext: topPolicyActionGuidance.loosen } })}
                        className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-teal disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!topPolicyActionGuidance.loosen.enabled}
                        title={topPolicyActionGuidance.loosen.detail}
                      >
                        Loosen approval
                      </button>
                      <button
                        type="button"
                        onClick={() => topPolicy && topPolicyActionGuidance.swap.enabled && onNavigate?.('intelligence', { intelligenceRouteState: { tab: 'routing', selectedPolicyId: topPolicy.id, actionContext: topPolicyActionGuidance.swap, providerSwap: topPolicyActionGuidance.swap.provider, modelSwap: topPolicyActionGuidance.swap.model, fallbackSwap: topPolicyActionGuidance.swap.currentLane, stageFallback: topPolicyActionGuidance.swap.stageFallback } })}
                        className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-blue disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!topPolicyActionGuidance.swap.enabled}
                        title={topPolicyActionGuidance.swap.detail}
                      >
                        {topPolicyActionGuidance.swap.label}
                      </button>
                      {topTradeoffOutcome.available && topPolicy && topTradeoffCorrectiveAction.routeState ? (
                        <button
                          type="button"
                          onClick={() => onNavigate?.('intelligence', { intelligenceRouteState: { tab: 'routing', selectedPolicyId: topPolicy.id, actionContext: topTradeoffCorrectiveAction, ...topTradeoffCorrectiveAction.routeState } })}
                          className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-violet"
                          title={topTradeoffCorrectiveAction.detail}
                        >
                          Stage correction
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
                {branchConnectorPressure.available && branchConnectorPressure.score > 0 ? (
                  <div className="ui-panel-soft mt-2 px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted mb-1">Branch signal</div>
                    <div className="text-[12px] font-semibold text-text-primary">
                      {groupedConnectorBlockers.topGroup?.affectedCount > 1 ? groupedConnectorBlockers.topGroup.title : branchConnectorPressure.title}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-text-body">
                      {groupedConnectorBlockers.topGroup?.affectedCount > 1 ? groupedConnectorBlockers.topGroup.detail : branchConnectorPressure.detail}
                    </p>
                    {groupedConnectorBlockers.topGroup?.affectedCount > 1 ? (
                      <div className="mt-2 text-[10px] leading-relaxed text-aurora-blue">
                        Do next: {groupedConnectorBlockers.topGroup.order}
                      </div>
                    ) : null}
                    {!groupedConnectorBlockers.topGroup?.affectedCount && branchConnectorPressure.topBranches[0]?.fallbackStrategy ? (
                      <div className="mt-2 text-[10px] leading-relaxed text-text-muted">
                        Fallback: {formatFallbackStrategyLabel(branchConnectorPressure.topBranches[0].fallbackStrategy)}. {getFallbackStrategyDetail(branchConnectorPressure.topBranches[0].fallbackStrategy)}
                      </div>
                    ) : null}
                    {groupedConnectorBlockers.topGroup?.affectedCount > 1 ? (
                      <div className="mt-2 text-[10px] leading-relaxed text-text-muted">
                        Affected branches: {groupedConnectorBlockers.topGroup.affectedBranches.map((branch) => branch.title).join(', ')}.
                      </div>
                    ) : null}
                    {groupedConnectorBlockers.topGroup?.affectedCount > 1 && groupedConnectorBlockers.topGroup.correctiveAction?.opsPrompt ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            const connectorDraft = buildConnectorActionDraft(groupedConnectorBlockers.topGroup.correctiveAction, {
                              title: groupedConnectorBlockers.topGroup.title,
                              connectorLabel: groupedConnectorBlockers.topGroup.connectorLabel,
                              affectedBranches: groupedConnectorBlockers.topGroup.affectedBranches.map((branch) => branch.title),
                            });
                            if (!connectorDraft) return;
                            onNavigate?.('managedOps', {
                              managedOpsRouteState: {
                                tab: 'create',
                                ...connectorDraft,
                              },
                            });
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-blue"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Stage grouped fix
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {missionDispatchPressure?.available ? (
                  <div className="ui-panel-soft mt-2 px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted mb-1">Dispatch signal</div>
                    <div className="text-[12px] font-semibold text-text-primary">{missionDispatchPressure.title}</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-text-body">{missionDispatchPressure.detail}</p>
                    <div className="mt-2 text-[10px] leading-relaxed text-aurora-blue">
                      Do next: {missionDispatchPressure.nextMove}
                    </div>
                    <div className="mt-2 text-[10px] leading-relaxed text-text-muted">
                      Safe parallel: {missionDispatchPressure.safeParallelCount}. Serialized: {missionDispatchPressure.serializedCount}. Held upstream: {missionDispatchPressure.heldUpstreamCount}.
                    </div>
                    {onNavigate ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            const dispatchDraft = buildDispatchActionDraft(missionDispatchPressure);
                            if (!dispatchDraft) return;
                            onNavigate('managedOps', {
                              managedOpsRouteState: dispatchDraft,
                            });
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-blue"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Stage dispatch order
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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

        <div className="mt-4 ui-segmented flex items-center gap-1 rounded-2xl p-1.5 backdrop-blur-sm">
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

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { lb: 'Live Missions', desc: 'Queued or executing now', v: running, c: 'text-aurora-amber' },
          { lb: 'Needs Decision', desc: 'Waiting on your judgment', v: approvalItems.length, c: 'text-aurora-amber' },
          { lb: 'Completed', desc: 'Closed without drag', v: completedItems.length, c: 'text-aurora-teal' },
        ].map(s => (
          <div key={s.lb} className="ui-stat px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-text-muted uppercase tracking-[0.18em]">{s.lb}</span>
              <span className={cn("text-2xl font-mono font-bold", s.c)}><AnimatedNumber value={s.v} /></span>
            </div>
            <p className="text-[11px] text-text-disabled mt-2">{s.desc}</p>
          </div>
        ))}
      </div>

      {criticalItems.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 rounded-full bg-aurora-rose animate-pulse" /><span className="text-[11px] font-bold uppercase text-aurora-rose tracking-wider">Resolve First</span></div>
          <div className="grid grid-cols-3 gap-3">
            {criticalItems.map(item => (
              <Card key={item.id} onClick={() => setSel(item.id)} className="p-4 bg-[linear-gradient(135deg,rgba(251,113,133,0.06),rgba(255,255,255,0.02))] border-aurora-rose/16 min-h-[92px]">
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
        <div className="ui-shell flex-[3.2] min-w-0 overflow-hidden backdrop-blur-sm">
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
                  <button onClick={() => setCreatorOpen(true)} className="ui-button-secondary flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold text-aurora-teal hover:bg-aurora-teal/12">
                    <Plus className="w-3.5 h-3.5" /> New Mission
                  </button>
              )}
            </div>

          {tab === 'ops' && (
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
                  <ItemRow item={t} agents={agents} tasks={tasks} selected={sel === t.id} onClick={() => setSel(t.id)} />
                </Motion.div>
              ))}
            </AnimatePresence>
          )}
          {tab === 'ops' && operationalTasks.length === 0 && (
            <div className="ui-panel-soft px-6 py-8">
              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-base font-semibold text-text-primary">No live missions right now</p>
                  <p className="mt-2 text-sm text-text-muted">The deck is clear. Launch something new, check approvals, or let the scheduled systems take the next pass.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => setCreatorOpen(true)} className="ui-button-secondary rounded-xl border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[11px] font-semibold text-aurora-teal transition-colors hover:bg-aurora-teal/14">
                      Launch mission
                    </button>
                    <button onClick={() => setTab('app')} className="ui-button-secondary rounded-xl px-3 py-2 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/[0.06]">
                      Review approvals
                    </button>
                    <button onClick={() => setTab('plan')} className="ui-button-secondary rounded-xl px-3 py-2 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/[0.06]">
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
                    <div key={metric.label} className="ui-stat px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{metric.label}</div>
                      <div className="mt-2 text-lg font-semibold text-text-primary">{metric.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'plan' && <PlannerTab schedules={schedules} agents={agents} recurringCandidates={recurringCandidates} onToggle={handleToggleSchedule} onDispatch={handleDispatch} onStageRecurringAction={handleStageRecurringAction} />}

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
                  <div className="space-y-1.5 opacity-60">{snoozed.map(a => <ItemRow key={a.id} item={a} agents={agents} tasks={tasks} selected={sel === a.id} onClick={() => setSel(a.id)} />)}</div>
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

        <div className="ui-shell w-[320px] shrink-0 overflow-y-auto no-scrollbar p-3 backdrop-blur-sm">
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
            interventions={interventions}
            branchConnectorPressure={branchConnectorPressure}
            groupedConnectorBlockers={groupedConnectorBlockers}
            missionDispatchPressure={missionDispatchPressure}
            approvalAudit={auditTrail}
            onOpenApprovals={() => setTab('app')}
            onOpenSystems={() => setSettingsOpen(true)}
            onOpenCreator={() => setCreatorOpen(true)}
            onOpenOps={() => setTab('ops')}
            onNavigate={onNavigate}
          />
          <ScratchpadStrip />
        </div>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedItem && <Drawer item={selectedItem} agents={agents} tasks={tasks} logs={logs} interventions={interventions} approvalAudit={auditTrail} learningMemory={learningMemory} onNavigate={onNavigate} onClose={() => setSel(null)} onApprove={handleApprove} onReject={handleReject} onRetry={handleRetry} onStop={handleStop} onCopy={handleCopy} onAcknowledge={handleAcknowledge} onReopen={handleReopen} onSnooze={handleSnooze} />}
      </AnimatePresence>

      <MissionCreatorPanel
        isOpen={creatorIsOpen}
        agents={agents}
        learningMemory={learningMemory}
        initialDraft={launchDraft}
        onClose={() => {
          setCreatorOpen(false);
          onConsumeLaunchDraft?.();
        }}
        onLaunch={handleLaunchMission}
        onPreview={previewMissionPlan}
      />
    </div>
  );
}
