import { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { BrainCircuit, Loader2, Rocket, ShieldCheck, Sparkles, Target, Workflow } from 'lucide-react';
import { container, item } from '../utils/variants';
import { cn } from '../utils/cn';
import { useActivityLog, useApprovalAudit, useCostData, useModelBank, usePendingReviews, useRoutingPolicies, useSchedules, useTaskInterventions, useTaskOutcomes } from '../utils/useSupabase';
import { approveMissionTask, interruptAndRedirectTask, recordBatchCommandEvent, retryTask, stopTask } from '../lib/api';
import { CommanderHero } from '../components/overview/CommanderHero';
import { CommandReadFirst } from '../components/overview/CommandReadFirst';
import { CommandSquadPanel } from '../components/overview/CommandSquadPanel';
import { LiveOpsTable } from '../components/overview/LiveOpsTable';
import { FleetHealthPanel } from '../components/overview/FleetHealthPanel';
import { CostControlPanel } from '../components/overview/CostControlPanel';
import { SchedulesBottlenecksPanel } from '../components/overview/SchedulesBottlenecksPanel';
import { AutonomyPosturePanel } from '../components/overview/AutonomyPosturePanel';
import { LaunchProtocolPanel } from '../components/overview/LaunchProtocolPanel';
import { useLearningMemory } from '../utils/useLearningMemory';
import { DoctrineCards } from '../components/command/DoctrineCards';
import { CommandSectionHeader } from '../components/command/CommandSectionHeader';
import { TruthAuditStrip } from '../components/command/TruthAuditStrip';
import { useCommandCenterTruth } from '../utils/useCommandCenterTruth';
import { ReactorCoreBoard } from '../components/command/ReactorCoreBoard';
import { CommandTimelineRail } from '../components/command/CommandTimelineRail';
import { buildTimelineEntries } from '../utils/buildCommandTimeline';
import { buildFailureTriageActionDraft, getCommanderNextMove, getExecutionAuditReadback, getFailureTriageSummary, getHybridApprovalSummary, getPolicyActionGuidance, getPolicyDeltaReadback, getPrimaryBottleneck, getRecurringBriefFitAction, getRecurringBriefFitReadback, getTradeoffCorrectiveAction, getTradeoffOutcomeSummary } from '../utils/commanderAnalytics';
import { buildConnectorActionDraft, formatBranchConnectorBlocker, formatFallbackStrategyLabel, getBranchConnectorCorrectiveAction, getBranchConnectorPressureSummary, getGraphContractPressureSummary, getGraphReasoningSummary, getGroupedConnectorBlockers, getLaunchReadinessPressure, getMissionDispatchPressureSummary, getTaskBranchExecutionPosture, getTaskDispatchReadback } from '../utils/executionReadiness';
import { buildTaskControlActionDraft, describeTaskTransition, getApprovalTransitionState, getDecisionNarrativeSummary, getMissionGraphSummary, getTaskControlActionMode, getTaskExecutableControlAction, getTaskLiveControlState } from '../utils/missionLifecycle';

function formatWaitLabel(ms) {
  if (!ms || ms <= 0) return 'None';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function BridgeModeCard({ eyebrow, title, description, stats = [], actionLabel, onAction, tone = 'teal', icon: Icon }) {
  const toneStyles = {
    teal: {
      chip: 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal',
      panel: 'border-aurora-teal/15 bg-[linear-gradient(135deg,rgba(45,212,191,0.08),rgba(255,255,255,0.02))]',
      icon: 'text-aurora-teal',
    },
    blue: {
      chip: 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue',
      panel: 'border-aurora-blue/15 bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.02))]',
      icon: 'text-aurora-blue',
    },
    violet: {
      chip: 'border-aurora-violet/20 bg-aurora-violet/10 text-aurora-violet',
      panel: 'border-aurora-violet/15 bg-[linear-gradient(135deg,rgba(167,139,250,0.08),rgba(255,255,255,0.02))]',
      icon: 'text-aurora-violet',
    },
  };
  const style = toneStyles[tone] || toneStyles.teal;

  return (
    <div className={cn('rounded-[24px] border p-4', style.panel)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
            {Icon ? <Icon className={cn('h-3.5 w-3.5', style.icon)} /> : null}
            {eyebrow}
          </div>
          <div className="mt-2 text-[15px] font-semibold text-text-primary">{title}</div>
          <div className="mt-2 text-[12px] leading-relaxed text-text-body">{description}</div>
        </div>
        <div className={cn('rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', style.chip)}>
          bridge
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
            <div className="text-[9px] uppercase tracking-[0.16em] text-text-muted">{stat.label}</div>
            <div className="mt-1 text-[13px] font-semibold text-text-primary">{stat.value}</div>
          </div>
        ))}
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/[0.07]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function OverviewView({ agents, tasks, loading, onOpenDetail, onNavigate }) {
  const { logs } = useActivityLog();
  const { auditTrail } = useApprovalAudit();
  const { reviews } = usePendingReviews();
  const { interventions } = useTaskInterventions();
  const { outcomes } = useTaskOutcomes();
  const { schedules, loading: loadingSchedules } = useSchedules();
  const { models } = useModelBank();
  const { policies: routingPolicies } = useRoutingPolicies();
  const { data: costData } = useCostData();
  const [referenceNow] = useState(() => new Date().getTime());
  const [bridgeMode, setBridgeMode] = useState(false);
  const [bridgeIntent, setBridgeIntent] = useState('');
  const [bridgeActionLoading, setBridgeActionLoading] = useState('');
  const [bridgeActionError, setBridgeActionError] = useState('');

  const activeAgents = agents.filter(a => a.status === 'processing').length;
  const idleAgents = agents.filter(a => a.status === 'idle').length;
  const errorAgents = agents.filter(a => a.status === 'error').length;
  const failedTasks = tasks.filter((task) => task.status === 'error');
  const runningTasks = tasks.filter((task) => task.status === 'running');
  const pendingTasks = tasks.filter((task) => task.status === 'pending');
  const errorLogs = logs.filter((log) => log.type === 'ERR');

  const stalledAgents = useMemo(() => agents.filter((agent) => {
    if (!agent.lastHeartbeat) return false;
    const heartbeatAge = referenceNow - new Date(agent.lastHeartbeat).getTime();
    return heartbeatAge > 10 * 60 * 1000 && agent.status !== 'idle';
  }), [agents, referenceNow]);

  const flaggedAgents = useMemo(() => {
    return agents
      .map((agent) => {
        if (agent.status === 'error') {
          return { id: agent.id, name: agent.name, reason: agent.errorMessage || 'Agent entered an error state.' };
        }
        if (stalledAgents.some((stalled) => stalled.id === agent.id)) {
          return { id: agent.id, name: agent.name, reason: 'Agent heartbeat looks stale while still active.' };
        }
        const recentErrors = errorLogs.filter((log) => log.agentId === agent.id).length;
        if (recentErrors > 0) {
          return { id: agent.id, name: agent.name, reason: `${recentErrors} recent error log${recentErrors > 1 ? 's' : ''}.` };
        }
        return null;
      })
      .filter(Boolean)
      .slice(0, 3);
  }, [agents, stalledAgents, errorLogs]);

  const providerByModel = useMemo(
    () => new Map(models.map((model) => [model.modelKey, model.provider || 'Custom'])),
    [models]
  );
  const commanderAgent = useMemo(
    () => agents.find((agent) => agent.role === 'commander') || null,
    [agents]
  );
  const operatorAgents = useMemo(
    () => agents.filter((agent) => agent.role !== 'commander'),
    [agents]
  );
  const flaggedAgentIds = useMemo(
    () => new Set(flaggedAgents.map((agent) => agent.id)),
    [flaggedAgents]
  );

  const medianLatency = useMemo(() => {
    const values = agents.map((agent) => Number(agent.latencyMs || 0)).filter((value) => value > 0).sort((a, b) => a - b);
    if (values.length === 0) return 0;
    const middle = Math.floor(values.length / 2);
    return values.length % 2 === 0
      ? Math.round((values[middle - 1] + values[middle]) / 2)
      : values[middle];
  }, [agents]);

  const successRate = useMemo(() => {
    if (agents.length === 0) return 100;
    return Math.round(agents.reduce((sum, agent) => sum + Number(agent.successRate || 0), 0) / agents.length);
  }, [agents]);

  const oldestPendingLabel = useMemo(() => {
    if (pendingTasks.length === 0) return 'No queue';
    const maxDuration = Math.max(...pendingTasks.map((task) => Number(task.durationMs || 0)));
    if (!maxDuration) return `${pendingTasks.length} queued`;
    const seconds = Math.round(maxDuration / 1000);
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }, [pendingTasks]);

  const approvalWaitTimes = useMemo(
    () => reviews.map((review) => Number(review.waitingMs || 0)).filter((value) => value > 0),
    [reviews]
  );
  const missionApprovalPressure = useMemo(
    () => tasks.filter((task) => task.status === 'needs_approval' || task.requiresApproval).length,
    [tasks]
  );
  const totalApprovalPressure = missionApprovalPressure + reviews.length;
  const avgApprovalWaitMs = approvalWaitTimes.length
    ? Math.round(approvalWaitTimes.reduce((sum, value) => sum + value, 0) / approvalWaitTimes.length)
    : 0;
  const longestApprovalWaitMs = approvalWaitTimes.length ? Math.max(...approvalWaitTimes) : 0;

  const lateSchedules = useMemo(
    () => schedules.filter((job) => job.status === 'active' && job.nextRunAt && new Date(job.nextRunAt).getTime() < referenceNow).length,
    [referenceNow, schedules]
  );
  const needsAttention = totalApprovalPressure + failedTasks.length + stalledAgents.length + lateSchedules;

  const prioritizedTasks = useMemo(() => {
    const reviewAgentIds = new Set(reviews.map((review) => review.agentId).filter(Boolean));
    const priorityMap = { error: 0, pending: 1, running: 2, completed: 3 };
    return tasks
      .filter((task) => task.status !== 'completed')
      .slice()
      .sort((a, b) => {
        const scoreA = priorityMap[a.status] ?? 9;
        const scoreB = priorityMap[b.status] ?? 9;
        if (scoreA !== scoreB) return scoreA - scoreB;
        return Number(b.durationMs || 0) - Number(a.durationMs || 0);
      })
      .slice(0, 8)
      .map((task) => {
        const connectorPosture = getTaskBranchExecutionPosture(task, interventions);
        const connectorBlocker = formatBranchConnectorBlocker(connectorPosture);
        const transition = describeTaskTransition(task, tasks);
        const graphSummary = getMissionGraphSummary(tasks, task.rootMissionId || task.root_mission_id || task.id);
        const dispatchReadback = getTaskDispatchReadback(task, tasks);
        const isDependencyHeld = transition.label === 'Held on upstream';
        const isReleased = transition.label === 'Released';
        return {
          ...task,
          connectorPosture,
          transition,
          graphSummary,
          dispatchReadback,
          fallbackLabel: formatFallbackStrategyLabel(connectorPosture.fallbackStrategy),
          connectorCorrectiveAction: getBranchConnectorCorrectiveAction(connectorPosture),
          needsReview: reviewAgentIds.has(task.agentId) || connectorPosture.requiresHumanGate || transition.label === 'Held for approval',
          blocker:
            task.status === 'error'
              ? transition.detail
              : connectorPosture.requiresHumanGate
                ? connectorBlocker
                : isDependencyHeld || isReleased || transition.label === 'Blocked' || transition.label === 'Held for approval'
                  ? transition.detail
                : reviewAgentIds.has(task.agentId)
                  ? 'Waiting on human approval.'
                  : task.status === 'pending'
                    ? connectorBlocker || 'Queued behind current work.'
                    : connectorBlocker || 'Running normally.',
          postureLabel: isDependencyHeld
            ? 'Held on upstream'
            : isReleased
              ? 'Released to run'
              : dispatchReadback.label || transition.label,
        };
      })
      .sort((a, b) => {
        const scoreForNextMove = (entry) => {
          if (!commanderNextMove?.available) return 0;
          const source = commanderNextMove.source;
          if (source === 'failure_triage') return ['failed', 'error', 'blocked'].includes(entry.status) ? 100 : 0;
          if (source === 'hybrid_approval') return entry.needsReview ? 100 : 0;
          if (source === 'grouped_connector_blocker' || source === 'connector_branch_pressure') return entry.connectorPosture?.requiresHumanGate ? 100 : 0;
          if (source === 'dispatch_pressure' || source === 'graph_contract') return entry.dispatchReadback?.label === 'Held upstream' || String(entry.dispatchReadback?.label || '').toLowerCase().includes('serialized') ? 100 : 0;
          return 0;
        };
        const nextMoveDelta = scoreForNextMove(b) - scoreForNextMove(a);
        if (nextMoveDelta !== 0) return nextMoveDelta;
        const guardDelta = Number(Boolean(b.connectorPosture?.requiresHumanGate)) - Number(Boolean(a.connectorPosture?.requiresHumanGate));
        if (guardDelta !== 0) return guardDelta;
        return 0;
      });
  }, [reviews, tasks, interventions, commanderNextMove]);
  const missionGraph = useMemo(() => getMissionGraphSummary(tasks), [tasks]);
  const missionDispatchPressure = useMemo(() => getMissionDispatchPressureSummary(tasks), [tasks]);
  const graphContractPressure = useMemo(() => getGraphContractPressureSummary(tasks, interventions), [tasks, interventions]);
  const graphReasoning = useMemo(() => getGraphReasoningSummary(tasks, interventions), [tasks, interventions]);
  const primaryBottleneck = useMemo(
    () => getPrimaryBottleneck({ tasks, reviews, schedules, agents, interventions, logs, costData }),
    [tasks, reviews, schedules, agents, interventions, logs, costData]
  );
  const commanderNextMove = useMemo(
    () => getCommanderNextMove({ tasks, reviews, schedules, agents, interventions, logs, approvalAudit: auditTrail, costData, learningMemory }),
    [tasks, reviews, schedules, agents, interventions, logs, auditTrail, costData, learningMemory]
  );

  const overviewSummary = {
    primaryMessage:
      needsAttention > 0
        ? `${needsAttention} items need attention before the system is fully clear.`
        : 'Fleet is clear and work is moving normally.',
    needsAttention,
    activeAgents,
    burnRate: costData.burnRate,
    pendingApprovals: totalApprovalPressure,
    runningTasks: runningTasks.length,
    failedTasks: failedTasks.length,
    idleAgents,
    errorAgents,
    medianLatency,
    successRate,
    stalledAgents: stalledAgents.length,
    flaggedAgents,
    flaggedAgentCount: flaggedAgents.length,
    oldestPendingLabel,
    avgApprovalWaitLabel: formatWaitLabel(avgApprovalWaitMs),
    longestApprovalWaitLabel: formatWaitLabel(longestApprovalWaitMs),
    lateSchedules,
    scheduledJobs: schedules.length,
    graphHeldBranches: missionGraph.heldCount,
    graphBlockedBranches: missionGraph.blockedCount,
    graphReleasedBranches: missionGraph.releasedCount,
    graphProgressLabel: `${missionGraph.progressPercent}%`,
  };
  const learningMemory = useLearningMemory({ agents, tasks, approvals: reviews, logs, costData });
  const truth = useCommandCenterTruth();
  const timelineEntries = useMemo(() => buildTimelineEntries({ tasks, reviews, logs }), [logs, reviews, tasks]);
  const latestBatchAudit = useMemo(
    () => logs.find((log) => String(log.message || '').includes('[batch-intervention-]')) || null,
    [logs]
  );

  const readiness = useMemo(() => {
    const score = Math.max(0, Math.min(100, 100 - (totalApprovalPressure * 8) - (failedTasks.length * 12) - (stalledAgents.length * 10) - (lateSchedules * 7)));
    const state = score >= 82 ? 'ready' : score >= 58 ? 'caution' : 'blocked';
    const label = state === 'ready' ? 'Launch ready' : state === 'caution' ? 'Proceed with caution' : 'Hold and stabilize';
    const headline = state === 'ready'
      ? 'Bridge is clear to launch the next wave'
      : state === 'caution'
        ? 'Bridge is live, but a few pressure points need command attention'
        : 'Bridge posture is unstable and should be tightened before scaling';
    const readback = state === 'ready'
      ? 'Automation is carrying the load cleanly, and no major human choke point is dominating the system.'
      : state === 'caution'
        ? 'The machine is moving, but human gates or unstable lanes are still visible from the bridge.'
        : 'Recovery work is outweighing acceleration. Clear the blockers before adding more throughput.';
    return { score, state, label, headline, readback };
  }, [totalApprovalPressure, failedTasks.length, stalledAgents.length, lateSchedules]);
  const topPolicyDelta = useMemo(
    () => getPolicyDeltaReadback(routingPolicies.find((policy) => policy.isDefault) || routingPolicies[0] || null, tasks, [], logs),
    [routingPolicies, tasks, logs]
  );
  const topPolicy = useMemo(
    () => routingPolicies.find((policy) => policy.isDefault) || routingPolicies[0] || null,
    [routingPolicies]
  );
  const topPolicyActionGuidance = useMemo(
    () => getPolicyActionGuidance(topPolicy, tasks, [], logs, agents),
    [topPolicy, tasks, logs, agents]
  );
  const topTradeoffOutcome = useMemo(
    () => getTradeoffOutcomeSummary(topPolicyActionGuidance.swap),
    [topPolicyActionGuidance]
  );
  const topTradeoffCorrectiveAction = useMemo(
    () => getTradeoffCorrectiveAction(topTradeoffOutcome, topPolicyActionGuidance.swap),
    [topTradeoffOutcome, topPolicyActionGuidance]
  );
  const recurringBriefReadback = useMemo(
    () => getRecurringBriefFitReadback(tasks, interventions, outcomes),
    [tasks, interventions, outcomes]
  );
  const recurringBriefAction = useMemo(
    () => getRecurringBriefFitAction(tasks, interventions, outcomes),
    [tasks, interventions, outcomes]
  );
  const recurringPaybackDoctrine = learningMemory?.doctrineById?.['recurring-payback-memory'] || null;
  const recurringAdaptiveDoctrine = learningMemory?.doctrineById?.['recurring-adaptive-control'] || null;
  const launchReadinessPressure = useMemo(
    () => getLaunchReadinessPressure(interventions),
    [interventions]
  );
  const branchConnectorPressure = useMemo(
    () => getBranchConnectorPressureSummary(tasks, interventions),
    [tasks, interventions]
  );
  const groupedConnectorBlockers = useMemo(
    () => getGroupedConnectorBlockers(tasks, interventions),
    [tasks, interventions]
  );
  const hybridApprovalSummary = useMemo(
    () => getHybridApprovalSummary({ tasks, reviews, interventions, approvalAudit: auditTrail }),
    [tasks, reviews, interventions, auditTrail]
  );
  const failureTriage = useMemo(
    () => getFailureTriageSummary({ tasks, interventions, logs }),
    [tasks, interventions, logs]
  );
  const failureTriageDraft = useMemo(
    () => buildFailureTriageActionDraft(failureTriage),
    [failureTriage]
  );
  const executionAudit = useMemo(
    () => getExecutionAuditReadback({ tasks, interventions, approvalAudit: auditTrail, logs, limit: 3 }),
    [tasks, interventions, auditTrail, logs]
  );
  const decisionNarrative = useMemo(
    () => getDecisionNarrativeSummary(tasks, interventions),
    [tasks, interventions]
  );

  const readFirstItems = useMemo(() => {
    const spendLeader = costData.models?.[0];
    return [
      {
        eyebrow: 'Read First',
        title: commanderNextMove?.available
          ? commanderNextMove.title
          : primaryBottleneck?.title || 'The machine is clear enough to push throughput',
        detail: commanderNextMove?.available
          ? `${commanderNextMove.detail} Do next: ${commanderNextMove.nextMove}.`
          : primaryBottleneck
            ? `${primaryBottleneck.detail} Do next: ${primaryBottleneck.action}`
            : 'No dominant choke point is visible. This is the right moment to launch, delegate, or scale the cleanest lane.',
        tone: commanderNextMove?.tone === 'rose'
          ? 'text-aurora-rose'
          : commanderNextMove?.tone === 'amber'
            ? 'text-aurora-amber'
            : 'text-aurora-teal',
      },
      {
        eyebrow: 'Scale Signal',
        title: readiness.score >= 82 ? 'Autonomy posture is strong enough to scale' : 'Autonomy posture still needs tightening',
        detail: readiness.score >= 82
          ? 'The system is moving with relatively low drag, which means you can add workload without immediately creating command debt.'
          : 'Human gates, failures, or stale operators are still visible enough that scaling now would compound friction.',
        tone: 'text-aurora-teal',
      },
      {
        eyebrow: 'Policy Signal',
        title: topPolicyDelta.title,
        detail: routingPolicies.length > 0
          ? topPolicyActionGuidance.swap.enabled
            ? `${topPolicyDelta.providerDelta}. ${topPolicyDelta.modelDelta}. ${topPolicyDelta.approvalDelta}. ${topPolicyActionGuidance.swap.signal} ${topTradeoffOutcome.available ? topTradeoffOutcome.detail : ''}`.trim()
            : `${topPolicyDelta.providerDelta}. ${topPolicyDelta.modelDelta}. ${topPolicyDelta.approvalDelta}.`
          : flaggedAgents.length > 0
            ? 'This operator is creating the clearest signal on the bridge right now and should be checked before pushing more volume.'
            : spendLeader
              ? `${spendLeader.name} is currently consuming the most budget, so it is the first place to tighten routing discipline.`
              : 'No single operator or model is dominating the board yet, which means you still have room to shape clean habits.',
        tone: topPolicyDelta.tone === 'teal' ? 'text-aurora-teal' : topPolicyDelta.tone === 'amber' ? 'text-aurora-amber' : 'text-aurora-blue',
      },
      ...(hybridApprovalSummary.available ? [{
        eyebrow: 'Approval Signal',
        title: hybridApprovalSummary.title,
        detail: `${hybridApprovalSummary.detail} ${hybridApprovalSummary.transitionLabel}. ${hybridApprovalSummary.resolutionLabel}. Do next: ${String(hybridApprovalSummary.nextMove || 'keep_flowing').replaceAll('_', ' ')}.${hybridApprovalSummary.latestDecision ? ` Latest decision: ${hybridApprovalSummary.latestDecision.label}.` : ''}`,
        tone: hybridApprovalSummary.tone === 'amber' ? 'text-aurora-amber' : 'text-aurora-teal',
      }] : []),
      ...(failureTriage.available ? [{
        eyebrow: 'Recovery Signal',
        title: failureTriage.title,
        detail: `${failureTriage.detail} Verdict: ${failureTriage.verdict}. ${failureTriage.resolutionLabel}. Do next: ${failureTriage.nextMove}.${failureTriage.graphContract?.label ? ` Graph contract: ${failureTriage.graphContract.label}.` : ''}`,
        tone: failureTriage.tone === 'amber' ? 'text-aurora-amber' : 'text-aurora-rose',
      }] : []),
      ...(executionAudit.available ? [{
        eyebrow: 'Audit Signal',
        title: executionAudit.title,
        detail: executionAudit.entries[0]
          ? `${executionAudit.entries[0].label}. ${executionAudit.entries[0].detail}`
          : executionAudit.detail,
        tone: 'text-aurora-blue',
      }] : []),
      ...(decisionNarrative.available ? [{
        eyebrow: 'Decision Signal',
        title: decisionNarrative.title,
        detail: `${decisionNarrative.detail} Do next: ${String(decisionNarrative.nextMove || 'keep_flowing').replaceAll('_', ' ')}.`,
        tone: decisionNarrative.tone === 'rose'
          ? 'text-aurora-rose'
          : decisionNarrative.tone === 'amber'
            ? 'text-aurora-amber'
            : decisionNarrative.tone === 'blue'
              ? 'text-aurora-blue'
              : 'text-aurora-teal',
      }] : []),
      ...(launchReadinessPressure.available && launchReadinessPressure.score > 0 ? [{
        eyebrow: 'System Signal',
        title: launchReadinessPressure.title,
        detail: `${launchReadinessPressure.detail} Top systems: ${launchReadinessPressure.topSystems.map((system) => system.label).join(', ')}.`,
        tone: launchReadinessPressure.tone === 'rose' ? 'text-aurora-rose' : 'text-aurora-amber',
      }] : []),
      ...(branchConnectorPressure.available && branchConnectorPressure.score > 0 ? [{
        eyebrow: 'Branch Signal',
        title: groupedConnectorBlockers.topGroup?.affectedCount > 1 ? groupedConnectorBlockers.title : branchConnectorPressure.title,
        detail: groupedConnectorBlockers.topGroup?.affectedCount > 1
          ? `${groupedConnectorBlockers.detail} Top branches: ${groupedConnectorBlockers.topGroup.affectedBranches.map((branch) => branch.title).join(', ')}.${groupedConnectorBlockers.topGroup.correctiveAction?.label ? ` Next move: ${groupedConnectorBlockers.topGroup.correctiveAction.label.toLowerCase()}.` : ''}`
          : `${branchConnectorPressure.detail} Top branches: ${branchConnectorPressure.topBranches.map((branch) => branch.title).join(', ')}.${branchConnectorPressure.topBranches[0]?.fallbackStrategy ? ` Fallback: ${formatFallbackStrategyLabel(branchConnectorPressure.topBranches[0].fallbackStrategy).toLowerCase()}.` : ''}${branchConnectorPressure.topCorrectiveAction?.label ? ` Next move: ${branchConnectorPressure.topCorrectiveAction.label.toLowerCase()}.` : ''}`,
        tone: branchConnectorPressure.tone === 'rose' ? 'text-aurora-rose' : 'text-aurora-amber',
      }] : []),
      ...(missionDispatchPressure.available ? [{
        eyebrow: 'Dispatch Signal',
        title: missionDispatchPressure.title,
        detail: `${missionDispatchPressure.detail} Do next: ${missionDispatchPressure.nextMove}`,
        tone: missionDispatchPressure.tone === 'rose' ? 'text-aurora-rose' : missionDispatchPressure.tone === 'amber' ? 'text-aurora-amber' : 'text-aurora-teal',
      }] : []),
      ...(graphContractPressure.available ? [{
        eyebrow: 'Graph Contract',
        title: graphContractPressure.title,
        detail: `${graphContractPressure.detail} Do next: ${graphContractPressure.nextMove}`,
        tone: graphContractPressure.tone === 'rose' ? 'text-aurora-rose' : graphContractPressure.tone === 'amber' ? 'text-aurora-amber' : graphContractPressure.tone === 'blue' ? 'text-aurora-blue' : 'text-aurora-teal',
      }] : []),
      ...(graphReasoning.available ? [{
        eyebrow: 'Graph Signal',
        title: graphReasoning.title,
        detail: `${graphReasoning.detail} Do next: ${graphReasoning.nextMove}`,
        tone: graphReasoning.tone === 'rose' ? 'text-aurora-rose' : graphReasoning.tone === 'amber' ? 'text-aurora-amber' : graphReasoning.tone === 'blue' ? 'text-aurora-blue' : 'text-aurora-teal',
      }] : []),
      ...(recurringBriefReadback.available ? [{
        eyebrow: 'Recurring Signal',
        title: recurringBriefReadback.title,
        detail: recurringBriefAction.available
          ? `${recurringBriefReadback.detail} Next move: ${recurringBriefAction.actionLabel.toLowerCase()}.`
          : recurringBriefReadback.detail,
        tone: recurringBriefReadback.tone === 'teal' ? 'text-aurora-teal' : recurringBriefReadback.tone === 'amber' ? 'text-aurora-amber' : 'text-aurora-blue',
      }] : []),
      ...(recurringPaybackDoctrine ? [{
        eyebrow: 'Recurring Payback',
        title: recurringPaybackDoctrine.title,
        detail: recurringPaybackDoctrine.detail,
        tone: recurringPaybackDoctrine.tone === 'teal' ? 'text-aurora-teal' : recurringPaybackDoctrine.tone === 'amber' ? 'text-aurora-amber' : 'text-aurora-blue',
      }] : []),
      ...(recurringAdaptiveDoctrine ? [{
        eyebrow: 'Recurring Defaults',
        title: recurringAdaptiveDoctrine.title,
        detail: recurringAdaptiveDoctrine.detail,
        tone: recurringAdaptiveDoctrine.tone === 'teal' ? 'text-aurora-teal' : recurringAdaptiveDoctrine.tone === 'amber' ? 'text-aurora-amber' : 'text-aurora-blue',
      }] : []),
    ];
  }, [commanderNextMove, costData.models, decisionNarrative, flaggedAgents, graphContractPressure, graphReasoning, readiness.score, topPolicyDelta, routingPolicies.length, topPolicyActionGuidance.swap.enabled, topPolicyActionGuidance.swap.signal, topTradeoffOutcome.available, topTradeoffOutcome.detail, hybridApprovalSummary, failureTriage, executionAudit, launchReadinessPressure, branchConnectorPressure, groupedConnectorBlockers, missionDispatchPressure, recurringBriefReadback, recurringBriefAction, recurringPaybackDoctrine, recurringAdaptiveDoctrine, primaryBottleneck]);

  const autonomyPosture = useMemo(() => {
    const humanGates = totalApprovalPressure + lateSchedules;
    const recoveryDrag = failedTasks.length + stalledAgents.length;
    const totalPressure = runningTasks.length + pendingTasks.length + humanGates + recoveryDrag;
    const autonomousPercent = totalPressure === 0 ? 100 : Math.max(0, Math.round(((runningTasks.length + pendingTasks.length) / totalPressure) * 100));
    const state = autonomousPercent >= 75 && recoveryDrag === 0 ? 'self-driving' : autonomousPercent >= 50 ? 'assisted' : 'gated';
    const title = state === 'self-driving' ? 'The machine is largely self-driving' : state === 'assisted' ? 'The machine is moving with visible human assist' : 'The machine is still gate-heavy';
    const description = state === 'self-driving'
      ? 'Autonomy is carrying most of the current load, with limited friction from humans or unstable branches.'
      : state === 'assisted'
        ? 'Core flow is working, but enough manual intervention remains that command still matters in the loop.'
        : 'Human decisions and recovery work are dominating too much of the bridge right now.';
    const primaryDrag = totalApprovalPressure > 0
      ? 'Approval gates are still the main drag'
      : failedTasks.length > 0
        ? 'Recovery work is still visible'
        : lateSchedules > 0
          ? 'Automation timing needs cleanup'
          : 'No dominant drag detected';
    const strongestLane = runningTasks.length > 0
      ? 'Live mission execution'
      : pendingTasks.length > 0
        ? 'Queued mission throughput'
        : 'Scheduled system posture';
    return {
      title,
      description,
      state,
      score: readiness.score,
      autonomousPercent,
      humanGates,
      recoveryDrag,
      strongestLane,
      primaryDrag,
      readback: readiness.readback,
    };
  }, [totalApprovalPressure, lateSchedules, failedTasks.length, stalledAgents.length, runningTasks.length, pendingTasks.length, readiness]);

  const launchProtocolActions = useMemo(() => {
    const actions = [];
    if (totalApprovalPressure > 0) {
      actions.push({
        label: 'Clear approval drag',
        detail: `${totalApprovalPressure} approval gate${totalApprovalPressure === 1 ? '' : 's'} are waiting on human judgment before execution can continue.`,
        badge: `${totalApprovalPressure} gates`,
        type: 'navigate',
        target: 'missions',
        icon: 'approvals',
        tone: 'text-aurora-amber',
      });
    }
    if (flaggedAgents[0]) {
      actions.push({
        label: `Inspect ${flaggedAgents[0].name}`,
        detail: flaggedAgents[0].reason,
        badge: 'operator',
        type: 'detail',
        target: flaggedAgents[0].id,
        icon: 'system',
        tone: 'text-aurora-blue',
      });
    }
    if (lateSchedules > 0) {
      actions.push({
        label: 'Reset automation drift',
        detail: `${lateSchedules} schedule${lateSchedules === 1 ? ' is' : 's are'} behind and should be checked before the next launch cycle.`,
        badge: 'automation',
        type: 'navigate',
        target: 'missions',
        icon: 'schedules',
        tone: 'text-aurora-rose',
      });
    }
    if (operatorAgents.length < 3) {
      actions.push({
        label: 'Add another specialist operator',
        detail: 'The bridge still has room for more specialist coverage before it becomes a true multi-lane command deck.',
        badge: 'scale',
        type: 'operator',
        target: null,
        icon: 'operators',
        tone: 'text-aurora-teal',
      });
    }
    if (actions.length === 0) {
      actions.push({
        label: 'Launch the next mission',
        detail: 'The board is stable enough to open Mission Control and push the next wave of work.',
        badge: 'ready',
        type: 'navigate',
        target: 'missions',
        icon: 'missions',
        tone: 'text-aurora-teal',
      });
    }
    return actions.slice(0, 4);
  }, [totalApprovalPressure, flaggedAgents, lateSchedules, operatorAgents.length]);

  const bridgeModeCards = useMemo(() => {
    const topDoctrine = learningMemory?.topThree?.[0];
    const truthItems = truth?.items || [];
    const driftCount = truthItems.filter((entry) => entry.status === 'warn' || entry.status === 'error').length;

    return [
      {
        key: 'executive',
        eyebrow: 'Executive Bridge',
        title: readiness.headline,
        description: readiness.readback,
        tone: 'teal',
        icon: Sparkles,
        stats: [
          { label: 'readiness', value: `${readiness.score}%` },
          { label: 'autonomy', value: `${autonomyPosture.autonomousPercent}%` },
          { label: 'attention', value: overviewSummary.needsAttention },
          { label: 'truth drift', value: driftCount },
        ],
        actionLabel: 'Open Mission Control',
        onAction: () => onNavigate?.('missions'),
      },
      {
        key: 'missions',
        eyebrow: 'Mission Deck',
        title: `${runningTasks.length} live mission${runningTasks.length === 1 ? '' : 's'} with ${totalApprovalPressure} human gate${totalApprovalPressure === 1 ? '' : 's'}`,
        description: totalApprovalPressure > 0
          ? `${formatWaitLabel(avgApprovalWaitMs)} average approval drag is still the biggest mission-speed constraint on the deck, with mission and review gates both counted.`
          : lateSchedules > 0
            ? `${lateSchedules} recurring flow${lateSchedules === 1 ? ' is' : 's are'} behind schedule and should be stabilized before the next wave.`
            : 'Mission throughput is clean enough that Commander can push the next wave without immediate gate pressure.',
        tone: 'blue',
        icon: Target,
        stats: [
          { label: 'live', value: runningTasks.length },
          { label: 'queued', value: pendingTasks.length },
          { label: 'approvals', value: totalApprovalPressure },
          { label: 'late schedules', value: lateSchedules },
        ],
        actionLabel: 'Open Live Deck',
        onAction: () => onNavigate?.('missions'),
      },
      {
        key: 'intelligence',
        eyebrow: 'Intelligence Rail',
        title: topDoctrine?.title || 'Doctrine is still forming the next advantage',
        description: topDoctrine?.detail || 'Routing, fleet posture, and model choice are learning from runtime memory and intervention pressure.',
        tone: 'violet',
        icon: BrainCircuit,
        stats: [
          { label: 'models online', value: models.length },
          { label: 'operators', value: operatorAgents.length },
          { label: 'flagged lanes', value: flaggedAgents.length },
          { label: 'active doctrine', value: learningMemory?.topThree?.length || 0 },
        ],
        actionLabel: 'Open Intelligence',
        onAction: () => onNavigate?.('intelligence'),
      },
    ];
  }, [
    learningMemory,
    truth,
    readiness,
    autonomyPosture,
    overviewSummary.needsAttention,
    onNavigate,
    runningTasks.length,
    totalApprovalPressure,
    avgApprovalWaitMs,
    lateSchedules,
    pendingTasks.length,
    models.length,
    operatorAgents.length,
    flaggedAgents.length,
  ]);

  const bridgeControlQueue = useMemo(() => {
    const currentTradeoffLane = topPolicyActionGuidance.swap.currentLane;
    const suggestedTradeoffLane = topPolicyActionGuidance.swap.suggestedLane;
    const scored = tasks
      .filter((task) => !['completed', 'done', 'cancelled'].includes(task.status))
      .map((task) => {
        let priorityScore = 0;
        let posture = 'queued';
        const connectorPosture = getTaskBranchExecutionPosture(task, interventions);
        const controlState = getTaskLiveControlState(task, interventions, tasks);
        const hasDependents = Array.isArray(task.dependsOn)
          ? task.dependsOn.length > 0
          : Array.isArray(task.depends_on)
            ? task.depends_on.length > 0
            : false;

        if (task.status === 'needs_approval' || task.requiresApproval) {
          priorityScore = 100;
          posture = 'approval';
        } else if (['failed', 'error', 'blocked'].includes(task.status)) {
          priorityScore = 90;
          posture = 'recovery';
        } else if (task.status === 'running') {
          priorityScore = 75;
          posture = 'live';
        } else if (['queued', 'pending'].includes(task.status)) {
          priorityScore = 55;
          posture = 'queued';
        }

        priorityScore += Number(task.priority || 0);
        if (task.requiresApproval) priorityScore += 8;
        if (connectorPosture.fallbackStrategy === 'guarded_external') {
          priorityScore += hasDependents ? 18 : 14;
          posture = posture === 'live' ? 'guarded-external' : posture;
        } else if (connectorPosture.fallbackStrategy === 'local_first') {
          priorityScore -= 8;
          posture = posture === 'queued' ? 'local-first' : posture;
        } else if (connectorPosture.fallbackStrategy === 'read_only_reroute') {
          priorityScore -= 2;
          posture = posture === 'queued' ? 'reroute-safe' : posture;
        }
        if (connectorPosture.requiresHumanGate) {
          priorityScore += 14;
          posture = posture === 'live' ? 'connector-guard' : posture;
        } else if (connectorPosture.available && connectorPosture.modes.includes('draft')) {
          priorityScore += 6;
        }

        const taskProvider = String(task.providerOverride || '').trim() || (task.routingReason?.match(/Provider[:=]\s*([A-Za-z0-9_-]+)/i)?.[1] || '');
        const taskModel = String(task.modelOverride || '').trim();
        const matchesCurrentTradeoffLane = currentTradeoffLane && (
          (!currentTradeoffLane.provider || currentTradeoffLane.provider === taskProvider || String(task.routingReason || '').includes(currentTradeoffLane.provider))
          && (!currentTradeoffLane.model || currentTradeoffLane.model === taskModel || String(task.routingReason || '').includes(currentTradeoffLane.model))
        );
        const matchesSuggestedTradeoffLane = suggestedTradeoffLane && (
          (!suggestedTradeoffLane.provider || suggestedTradeoffLane.provider === taskProvider || String(task.routingReason || '').includes(suggestedTradeoffLane.provider))
          && (!suggestedTradeoffLane.model || suggestedTradeoffLane.model === taskModel || String(task.routingReason || '').includes(suggestedTradeoffLane.model))
        );

        if (topTradeoffOutcome.available && !topTradeoffOutcome.payingOff && matchesCurrentTradeoffLane) {
          priorityScore += 12;
          posture = posture === 'live' ? 'route-drift' : posture;
        }
        if (topTradeoffOutcome.available && topTradeoffOutcome.payingOff && matchesSuggestedTradeoffLane) {
          priorityScore -= 6;
        }

        return {
          task,
          posture,
          priorityScore,
          correctiveAction: matchesCurrentTradeoffLane && topTradeoffOutcome.available ? topTradeoffCorrectiveAction : null,
          connectorPosture,
          connectorBlocker: formatBranchConnectorBlocker(connectorPosture),
          connectorCorrectiveAction: getBranchConnectorCorrectiveAction(connectorPosture),
          controlState,
          controlActionDraft: buildTaskControlActionDraft(controlState, task),
        };
      })
      .filter((entry) => entry.priorityScore > 0)
      .sort((a, b) => b.priorityScore - a.priorityScore);

    return scored.slice(0, 3);
  }, [tasks, interventions, topPolicyActionGuidance, topTradeoffOutcome, topTradeoffCorrectiveAction]);

  const safestRedirectAgent = useMemo(() => {
    const operators = agents.filter((agent) => !agent.isSyntheticCommander);
    return operators.find((agent) => !agent.isEphemeral && agent.status !== 'error')
      || operators.find((agent) => agent.status !== 'error')
      || null;
  }, [agents]);
  const approvalQueue = useMemo(
    () => bridgeControlQueue.filter(({ task }) => task.status === 'needs_approval' || task.requiresApproval),
    [bridgeControlQueue]
  );
  const recoveryQueue = useMemo(
    () => bridgeControlQueue.filter(({ task }) => ['failed', 'error', 'blocked'].includes(task.status)),
    [bridgeControlQueue]
  );
  const liveQueue = useMemo(
    () => bridgeControlQueue.filter(({ task }) => task.status === 'running'),
    [bridgeControlQueue]
  );

  function openConversationalCommander(missionMode) {
    if (!bridgeIntent.trim()) return;
    onNavigate?.('missions', {
      missionComposerDraft: {
        intent: bridgeIntent.trim(),
        missionMode,
      },
    });
  }

  async function runBridgeAction(label, fn) {
    setBridgeActionLoading(label);
    setBridgeActionError('');
    try {
      await fn();
    } catch (error) {
      setBridgeActionError(error?.message || `${label} failed.`);
    } finally {
      setBridgeActionLoading('');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-aurora-teal animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-y-auto pb-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 left-[-8%] h-[360px] w-[360px] rounded-full bg-aurora-teal/7 blur-[120px]" />
        <div className="absolute top-[10%] right-[-12%] h-[420px] w-[420px] rounded-full bg-aurora-blue/7 blur-[140px]" />
      </div>

      <Motion.div variants={container} initial="hidden" animate="show" className="relative space-y-5">
        <Motion.div variants={item}>
          <CommanderHero
            commander={commanderAgent}
            provider={commanderAgent ? providerByModel.get(commanderAgent.model) : null}
            operatorCount={operatorAgents.length}
            summary={overviewSummary}
            readiness={readiness}
            policyDelta={topPolicyDelta}
            policyActionGuidance={topPolicyActionGuidance}
            tradeoffOutcome={topTradeoffOutcome}
            tradeoffCorrectiveAction={topTradeoffCorrectiveAction}
            onOpenRoutingPolicy={() => topPolicy && onNavigate?.('intelligence', { intelligenceRouteState: { tab: 'routing', selectedPolicyId: topPolicy.id, actionContext: topPolicyActionGuidance.open } })}
            onHardenPolicy={() => topPolicy && topPolicyActionGuidance.harden.enabled && onNavigate?.('intelligence', { intelligenceRouteState: { tab: 'routing', selectedPolicyId: topPolicy.id, adjustment: 'harden', actionContext: topPolicyActionGuidance.harden } })}
            onLoosenPolicy={() => topPolicy && topPolicyActionGuidance.loosen.enabled && onNavigate?.('intelligence', { intelligenceRouteState: { tab: 'routing', selectedPolicyId: topPolicy.id, adjustment: 'loosen', actionContext: topPolicyActionGuidance.loosen } })}
            onSwapPolicyLane={() => topPolicy && topPolicyActionGuidance.swap.enabled && onNavigate?.('intelligence', { intelligenceRouteState: { tab: 'routing', selectedPolicyId: topPolicy.id, actionContext: topPolicyActionGuidance.swap, providerSwap: topPolicyActionGuidance.swap.provider, modelSwap: topPolicyActionGuidance.swap.model, fallbackSwap: topPolicyActionGuidance.swap.currentLane, stageFallback: topPolicyActionGuidance.swap.stageFallback } })}
            onStageTradeoffCorrection={() => topPolicy && topTradeoffCorrectiveAction.routeState && onNavigate?.('intelligence', { intelligenceRouteState: { tab: 'routing', selectedPolicyId: topPolicy.id, actionContext: topTradeoffCorrectiveAction, ...topTradeoffCorrectiveAction.routeState } })}
            onNavigate={onNavigate}
            onOpenDetail={onOpenDetail}
          />
        </Motion.div>

        <Motion.div variants={item}>
          <CommandReadFirst items={readFirstItems} />
        </Motion.div>

        <Motion.section variants={item} className="ui-panel p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
                <Workflow className="h-3.5 w-3.5 text-aurora-violet" />
                One-Screen Bridge Mode
              </div>
              <div className="mt-2 text-lg font-semibold text-text-primary">Compress executive, mission, and intelligence signals into one cockpit.</div>
              <div className="mt-1 text-[12px] leading-relaxed text-text-body">
                This bridge mode keeps the command pulse, live deck, and doctrine rail readable in one place so you can move without page-hopping.
              </div>
            </div>
            <button
              onClick={() => setBridgeMode((prev) => !prev)}
              className={cn(
                'inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
                bridgeMode
                  ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                  : 'border-border bg-surface text-text-muted hover:bg-surface-raised hover:text-text-primary'
              )}
            >
              <Sparkles className="h-4 w-4" />
              {bridgeMode ? 'Bridge mode live' : 'Open bridge mode'}
            </button>
          </div>

          {bridgeMode && (
            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] border border-aurora-teal/15 bg-[linear-gradient(135deg,rgba(45,212,191,0.08),rgba(96,165,250,0.04))] p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-aurora-teal font-semibold">
                      <Sparkles className="h-3.5 w-3.5" />
                      Interruptible Conversational Commander
                    </div>
                    <div className="mt-2 text-[15px] font-semibold text-text-primary">Tell Commander the mission from the bridge.</div>
                    <div className="mt-2 text-[12px] leading-relaxed text-text-body">
                      Type the mission naturally, choose the posture, and Commander will hand you straight into Mission Control with the briefing already staged.
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate?.('missions')}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/[0.07]"
                  >
                    Open live deck
                  </button>
                </div>

                <textarea
                  value={bridgeIntent}
                  onChange={(event) => setBridgeIntent(event.target.value)}
                  rows={4}
                  placeholder="Tell Commander what you want next. Example: Review stalled quotes, identify the best follow-up angle, and draft outreach for the top opportunities."
                  className="mt-4 w-full rounded-[20px] border border-white/[0.08] bg-black/20 px-4 py-4 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-aurora-teal/40 resize-none leading-relaxed"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => openConversationalCommander('do_now')}
                    disabled={!bridgeIntent.trim()}
                    className="rounded-2xl bg-aurora-teal px-4 py-2 text-[11px] font-semibold text-black transition-colors hover:bg-[#00ebd8] disabled:opacity-50"
                  >
                    Do now
                  </button>
                  <button
                    onClick={() => openConversationalCommander('plan_first')}
                    disabled={!bridgeIntent.trim()}
                    className="rounded-2xl border border-aurora-blue/20 bg-aurora-blue/10 px-4 py-2 text-[11px] font-semibold text-aurora-blue transition-colors hover:bg-aurora-blue/15 disabled:opacity-50"
                  >
                    Plan first
                  </button>
                  <button
                    onClick={() => openConversationalCommander('watch_and_approve')}
                    disabled={!bridgeIntent.trim()}
                    className="rounded-2xl border border-aurora-amber/20 bg-aurora-amber/10 px-4 py-2 text-[11px] font-semibold text-aurora-amber transition-colors hover:bg-aurora-amber/15 disabled:opacity-50"
                  >
                    Watch and approve
                  </button>
                  <button
                    onClick={() => onNavigate?.('missions')}
                    className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/[0.07]"
                  >
                    Redirect live work
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {bridgeModeCards.map((card) => (
                  <BridgeModeCard key={card.key} {...card} />
                ))}
              </div>

              <div className="rounded-[24px] border border-aurora-blue/15 bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.02))] p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-aurora-blue font-semibold">
                      <Target className="h-3.5 w-3.5" />
                      Bridge Intervention
                    </div>
                    <div className="mt-2 text-[15px] font-semibold text-text-primary">Act on the highest-pressure branch without leaving the cockpit.</div>
                    <div className="mt-2 text-[12px] leading-relaxed text-text-body">
                      Commander surfaces the branch with the strongest approval, recovery, or live-execution pressure first so you can intervene from the flagship bridge.
                    </div>
                  </div>
                  {bridgeControlQueue.length > 0 && (
                    <div className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-blue">
                      {bridgeControlQueue.length} live interventions
                    </div>
                  )}
                </div>

                {bridgeControlQueue.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {groupedConnectorBlockers.topGroup?.affectedCount > 1 ? (
                      <div className="rounded-[20px] border border-aurora-blue/15 bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.02))] p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-aurora-blue font-semibold">
                          <Target className="h-3.5 w-3.5" />
                          Shared connector fix
                        </div>
                        <div className="mt-2 text-[14px] font-semibold text-text-primary">{groupedConnectorBlockers.topGroup.title}</div>
                        <div className="mt-2 text-[12px] leading-relaxed text-text-body">{groupedConnectorBlockers.topGroup.detail}</div>
                        <div className="mt-2 text-[11px] leading-relaxed text-aurora-blue">{groupedConnectorBlockers.topGroup.order}</div>
                        <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                          Affected branches: {groupedConnectorBlockers.topGroup.affectedBranches.map((branch) => branch.title).join(', ')}.
                        </div>
                        {groupedConnectorBlockers.topGroup.correctiveAction?.label ? (
                          <div className="mt-3 ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
                            <span className="font-semibold text-text-primary">Fastest safe move:</span> {groupedConnectorBlockers.topGroup.correctiveAction.label}. {groupedConnectorBlockers.topGroup.correctiveAction.detail}
                            <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                              Target lane: {groupedConnectorBlockers.topGroup.correctiveAction.targetRole || 'ops'}. Approval: {String(groupedConnectorBlockers.topGroup.correctiveAction.targetApprovalPosture || 'risk_weighted').replaceAll('_', ' ')}.
                            </div>
                            {groupedConnectorBlockers.topGroup.correctiveAction.opsPrompt ? (
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
                                  className="rounded-2xl border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-blue transition-colors hover:bg-aurora-blue/15"
                                >
                                  Stage grouped connector fix
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {approvalQueue.length > 1 && (
                        <button
                          onClick={() => runBridgeAction('BatchApprove', async () => {
                            await Promise.all(approvalQueue.map(({ task }) => approveMissionTask(task.id)));
                            await recordBatchCommandEvent({ actionType: 'approve', tasks: approvalQueue.map(({ task }) => task) });
                          })}
                          disabled={!!bridgeActionLoading}
                          className="rounded-2xl bg-aurora-teal px-4 py-2 text-[11px] font-semibold text-black transition-colors hover:bg-[#00ebd8] disabled:opacity-50"
                        >
                          {bridgeActionLoading === 'BatchApprove' ? 'Approving queue...' : `Approve ${approvalQueue.length} branches`}
                        </button>
                      )}
                      {recoveryQueue.length > 1 && (
                        <button
                          onClick={() => {
                            if (failureTriageDraft && onNavigate) {
                              onNavigate('managedOps', { managedOpsRouteState: failureTriageDraft });
                              return;
                            }
                            runBridgeAction('BatchRetry', async () => {
                              await Promise.all(recoveryQueue.map(({ task }) => retryTask(task.id)));
                              await recordBatchCommandEvent({ actionType: 'retry', tasks: recoveryQueue.map(({ task }) => task) });
                            });
                          }}
                          disabled={!!bridgeActionLoading}
                          className="rounded-2xl border border-aurora-amber/20 bg-aurora-amber/10 px-4 py-2 text-[11px] font-semibold text-aurora-amber transition-colors hover:bg-aurora-amber/15 disabled:opacity-50"
                        >
                          {failureTriageDraft
                            ? (failureTriage.actionLabel || 'Stage recovery move')
                            : bridgeActionLoading === 'BatchRetry'
                              ? 'Retrying queue...'
                              : `Retry ${recoveryQueue.length} branches`}
                        </button>
                      )}
                      {liveQueue.length > 1 && (
                        <button
                          onClick={() => runBridgeAction('BatchStop', async () => {
                            await Promise.all(liveQueue.map(({ task }) => stopTask(task.id)));
                            await recordBatchCommandEvent({ actionType: 'stop', tasks: liveQueue.map(({ task }) => task) });
                          })}
                          disabled={!!bridgeActionLoading}
                          className="rounded-2xl border border-aurora-rose/20 bg-aurora-rose/10 px-4 py-2 text-[11px] font-semibold text-aurora-rose transition-colors hover:bg-aurora-rose/15 disabled:opacity-50"
                        >
                          {bridgeActionLoading === 'BatchStop' ? 'Stabilizing queue...' : `Stabilize ${liveQueue.length} branches`}
                        </button>
                      )}
                      {safestRedirectAgent && bridgeControlQueue.length > 1 && (
                        <button
                          onClick={() => runBridgeAction('BatchRedirect', async () => {
                            await Promise.all(bridgeControlQueue.map(({ task }) => interruptAndRedirectTask(task.id, {
                              agentId: safestRedirectAgent.id,
                              providerOverride: safestRedirectAgent.provider || null,
                              modelOverride: safestRedirectAgent.model || null,
                            }, agents)));
                            await recordBatchCommandEvent({
                              actionType: 'redirect',
                              tasks: bridgeControlQueue.map(({ task }) => task),
                              targetAgent: safestRedirectAgent,
                            });
                          })}
                          disabled={!!bridgeActionLoading}
                          className="rounded-2xl border border-aurora-blue/20 bg-aurora-blue/10 px-4 py-2 text-[11px] font-semibold text-aurora-blue transition-colors hover:bg-aurora-blue/15 disabled:opacity-50"
                        >
                          {bridgeActionLoading === 'BatchRedirect' ? 'Redirecting queue...' : `Redirect top ${bridgeControlQueue.length} to ${safestRedirectAgent.name}`}
                        </button>
                      )}
                    </div>

                    {bridgeControlQueue.map(({ task, posture, correctiveAction, connectorCorrectiveAction, connectorBlocker, controlState, controlActionDraft }, index) => {
                      const approvalTransition = getApprovalTransitionState(task, interventions);
                      const executableControlAction = getTaskExecutableControlAction({
                        task,
                        controlState,
                        approvalTransition,
                        redirectAgent: safestRedirectAgent,
                      });
                      const controlActionMode = getTaskControlActionMode({
                        controlState,
                        executableAction: executableControlAction,
                        controlActionDraft,
                      });
                      return (
                      <div key={task.id} className="rounded-[20px] border border-white/[0.08] bg-black/20 p-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-aurora-blue/10 text-[10px] font-bold text-aurora-blue">{index + 1}</span>
                              <div className="text-[9px] uppercase tracking-[0.16em] text-text-muted">Target branch</div>
                            </div>
                            <div className="mt-2 text-[14px] font-semibold text-text-primary">{task.name || task.title}</div>
                            <div className="mt-1 text-[11px] leading-relaxed text-text-body">
                              {task.routingReason || 'Commander has not persisted a route rationale for this branch yet.'}
                            </div>
                            {connectorBlocker ? (
                              <div className="mt-2 ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
                                <span className="font-semibold text-text-primary">Connector blocker:</span> {connectorBlocker}
                              </div>
                            ) : null}
                            {controlState?.available && controlState.kind !== 'flowing' ? (
                              <div className="mt-2 ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
                                <span className="font-semibold text-text-primary">Live control state:</span> {controlState.label}. {controlState.detail}
                                {controlState.resolutionLabel ? (
                                  <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                                    <span className="font-semibold text-text-primary">Safest next move:</span> {controlState.resolutionLabel}. {controlState.resolutionDetail}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {approvalTransition.available ? (
                              <div className="mt-2 ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
                                <span className="font-semibold text-text-primary">Approval transition:</span> {approvalTransition.label}. {approvalTransition.detail}
                                {approvalTransition.nextMove ? (
                                  <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                                    Do next: {String(approvalTransition.nextMove).replaceAll('_', ' ')}.
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {correctiveAction?.label ? (
                              <div className="mt-2 ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
                                <span className="font-semibold text-text-primary">Corrective action:</span> {correctiveAction.label}. {correctiveAction.detail}
                                {topPolicy?.id && correctiveAction.routeState ? (
                                  <div className="mt-3">
                                    <button
                                      type="button"
                                      onClick={() => onNavigate?.('intelligence', { intelligenceRouteState: { tab: 'routing', selectedPolicyId: topPolicy.id, actionContext: correctiveAction, ...correctiveAction.routeState } })}
                                      className="rounded-2xl border border-aurora-violet/20 bg-aurora-violet/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-violet transition-colors hover:bg-aurora-violet/15"
                                    >
                                      Stage corrective action
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {!correctiveAction?.label && connectorCorrectiveAction?.label ? (
                              <div className="mt-2 ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
                                <span className="font-semibold text-text-primary">Connector action:</span> {connectorCorrectiveAction.label}. {connectorCorrectiveAction.detail}
                                {(connectorCorrectiveAction.targetRole || connectorCorrectiveAction.targetApprovalPosture) ? (
                                  <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                                    Target lane: {connectorCorrectiveAction.targetRole || 'ops'}. Approval: {String(connectorCorrectiveAction.targetApprovalPosture || 'risk_weighted').replaceAll('_', ' ')}.
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {onNavigate && controlActionDraft ? (
                              <div className="mt-3">
                                {controlActionMode.helperText ? (
                                  <div className="mb-2 text-[10px] leading-relaxed text-text-muted">
                                    {controlActionMode.helperText}
                                  </div>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => onNavigate('managedOps', {
                                    managedOpsRouteState: controlActionDraft,
                                  })}
                                  className="rounded-2xl border border-aurora-violet/20 bg-aurora-violet/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-violet transition-colors hover:bg-aurora-violet/15"
                                >
                                  {controlActionMode.stageLabel || controlState.actionLabel}
                                </button>
                              </div>
                            ) : null}
                            {!controlActionDraft && failureTriage.topFailure?.id === task.id && failureTriageDraft ? (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => onNavigate?.('managedOps', { managedOpsRouteState: failureTriageDraft })}
                                  className="rounded-2xl border border-aurora-rose/20 bg-aurora-rose/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-rose transition-colors hover:bg-aurora-rose/15"
                                >
                                  {failureTriage.actionLabel || 'Stage recovery move'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-3 gap-2 xl:min-w-[320px]">
                            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                              <div className="text-[9px] uppercase tracking-[0.16em] text-text-muted">Posture</div>
                              <div className="mt-1 text-[12px] font-semibold text-text-primary">{posture}</div>
                            </div>
                            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                              <div className="text-[9px] uppercase tracking-[0.16em] text-text-muted">Status</div>
                              <div className="mt-1 text-[12px] font-semibold text-text-primary">{task.status}</div>
                            </div>
                            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                              <div className="text-[9px] uppercase tracking-[0.16em] text-text-muted">Agent</div>
                              <div className="mt-1 text-[12px] font-semibold text-text-primary">{task.agentName || 'Unassigned'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 col-span-3 xl:col-span-3">
                              <div className="text-[9px] uppercase tracking-[0.16em] text-text-muted">Resume posture</div>
                              <div className="mt-1 text-[12px] font-semibold text-text-primary">
                                {controlState?.canAutoResume
                                  ? 'Safe to resume when lane clears'
                                  : controlState?.shouldStayHeld
                                    ? 'Should stay held until reviewed'
                                    : 'Needs active commander decision'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {executableControlAction.available && executableControlAction.kind === 'release' && (
                            <button
                              onClick={() => runBridgeAction(`Release-${task.id}`, () => approveMissionTask(task.id))}
                              disabled={!!bridgeActionLoading}
                              className="rounded-2xl bg-aurora-teal px-4 py-2 text-[11px] font-semibold text-black transition-colors hover:bg-[#00ebd8] disabled:opacity-50"
                            >
                              {bridgeActionLoading === `Release-${task.id}` ? 'Releasing...' : executableControlAction.label}
                            </button>
                          )}
                          {task.status === 'needs_approval' && (
                            <button
                              onClick={() => runBridgeAction(`Approve-${task.id}`, () => approveMissionTask(task.id))}
                              disabled={!!bridgeActionLoading}
                              className="rounded-2xl bg-aurora-teal px-4 py-2 text-[11px] font-semibold text-black transition-colors hover:bg-[#00ebd8] disabled:opacity-50"
                            >
                              {bridgeActionLoading === `Approve-${task.id}` ? 'Approving...' : 'Approve branch'}
                            </button>
                          )}
                          {['failed', 'error', 'blocked'].includes(task.status) && (
                            <button
                              onClick={() => {
                                if (failureTriage.topFailure?.id === task.id && failureTriageDraft && onNavigate) {
                                  onNavigate('managedOps', { managedOpsRouteState: failureTriageDraft });
                                  return;
                                }
                                runBridgeAction(`Retry-${task.id}`, () => retryTask(task.id));
                              }}
                              disabled={!!bridgeActionLoading}
                              className="rounded-2xl border border-aurora-amber/20 bg-aurora-amber/10 px-4 py-2 text-[11px] font-semibold text-aurora-amber transition-colors hover:bg-aurora-amber/15 disabled:opacity-50"
                            >
                              {failureTriage.topFailure?.id === task.id && failureTriageDraft
                                ? (failureTriage.actionLabel || 'Run recovery move')
                                : bridgeActionLoading === `Retry-${task.id}`
                                  ? 'Retrying...'
                                  : 'Retry branch'}
                            </button>
                          )}
                          {executableControlAction.available && executableControlAction.kind === 'hold' && (
                            <button
                              onClick={() => runBridgeAction(`Hold-${task.id}`, () => stopTask(task.id))}
                              disabled={!!bridgeActionLoading}
                              className="rounded-2xl border border-aurora-rose/20 bg-aurora-rose/10 px-4 py-2 text-[11px] font-semibold text-aurora-rose transition-colors hover:bg-aurora-rose/15 disabled:opacity-50"
                            >
                              {bridgeActionLoading === `Hold-${task.id}` ? 'Holding...' : executableControlAction.label}
                            </button>
                          )}
                          {task.status === 'running' && (
                            <button
                              onClick={() => runBridgeAction(`Stop-${task.id}`, () => stopTask(task.id))}
                              disabled={!!bridgeActionLoading}
                              className="rounded-2xl border border-aurora-rose/20 bg-aurora-rose/10 px-4 py-2 text-[11px] font-semibold text-aurora-rose transition-colors hover:bg-aurora-rose/15 disabled:opacity-50"
                            >
                              {bridgeActionLoading === `Stop-${task.id}` ? 'Stopping...' : 'Stabilize branch'}
                            </button>
                          )}
                          {executableControlAction.available && executableControlAction.kind === 'reroute' && safestRedirectAgent && (
                            <button
                              onClick={() => runBridgeAction(`GraphRedirect-${task.id}`, () => interruptAndRedirectTask(task.id, {
                                agentId: safestRedirectAgent.id,
                                providerOverride: safestRedirectAgent.provider || null,
                                modelOverride: safestRedirectAgent.model || null,
                              }, agents))}
                              disabled={!!bridgeActionLoading}
                              className="rounded-2xl border border-aurora-blue/20 bg-aurora-blue/10 px-4 py-2 text-[11px] font-semibold text-aurora-blue transition-colors hover:bg-aurora-blue/15 disabled:opacity-50"
                            >
                              {bridgeActionLoading === `GraphRedirect-${task.id}` ? 'Rerouting...' : executableControlAction.label}
                            </button>
                          )}
                          {safestRedirectAgent && (
                            <button
                              onClick={() => runBridgeAction(`Redirect-${task.id}`, () => interruptAndRedirectTask(task.id, {
                                agentId: safestRedirectAgent.id,
                                providerOverride: safestRedirectAgent.provider || null,
                                modelOverride: safestRedirectAgent.model || null,
                              }, agents))}
                              disabled={!!bridgeActionLoading}
                              className="rounded-2xl border border-aurora-blue/20 bg-aurora-blue/10 px-4 py-2 text-[11px] font-semibold text-aurora-blue transition-colors hover:bg-aurora-blue/15 disabled:opacity-50"
                            >
                              {bridgeActionLoading === `Redirect-${task.id}` ? 'Redirecting...' : `Redirect to ${safestRedirectAgent.name}`}
                            </button>
                          )}
                          <button
                            onClick={() => onNavigate?.('missions')}
                            className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/[0.07]"
                          >
                            Open full intervention console
                          </button>
                        </div>
                      </div>
                      );
                    })}

                    {bridgeActionError && (
                      <div className="rounded-2xl border border-aurora-rose/20 bg-aurora-rose/10 px-3 py-2 text-[11px] text-aurora-rose">
                        {bridgeActionError}
                      </div>
                    )}

                    {latestBatchAudit && (
                      <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                        <div className="text-[9px] uppercase tracking-[0.16em] text-text-muted">Batch command audit</div>
                        <div className="mt-2 text-[11px] leading-relaxed text-text-body">{latestBatchAudit.message}</div>
                        <div className="mt-2 text-[10px] font-mono text-text-disabled">
                          {typeof latestBatchAudit.timestamp === 'string'
                            ? new Date(latestBatchAudit.timestamp).toLocaleString()
                            : new Date(latestBatchAudit.timestamp).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[20px] border border-aurora-teal/20 bg-aurora-teal/10 px-4 py-3 text-[12px] text-text-body">
                    No branch currently needs inline bridge intervention. The cockpit is clear enough to launch the next wave.
                  </div>
                )}
              </div>
            </div>
          )}
        </Motion.section>

        <Motion.div variants={item}>
          <TruthAuditStrip truth={truth} />
        </Motion.div>

        <Motion.div variants={item}>
          <ReactorCoreBoard truth={truth} summary={overviewSummary} />
        </Motion.div>

        <Motion.section variants={item} className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <LiveOpsTable
            tasks={prioritizedTasks}
            loading={loading}
            onOpenDetail={onOpenDetail}
            onNavigate={onNavigate}
          />
          <div className="space-y-5">
            <LaunchProtocolPanel
              actions={launchProtocolActions}
              onNavigate={onNavigate}
              onOpenDetail={onOpenDetail}
              onAddOperator={() => onNavigate?.('managedOps', { tab: 'quickstart' })}
            />
            <CommandTimelineRail
              entries={timelineEntries}
              title="Command Timeline"
              description="The latest launches, approvals, failures, and command events flowing through the flagship bridge."
            />
            <SchedulesBottlenecksPanel summary={overviewSummary} schedules={schedules} loading={loadingSchedules} referenceNow={referenceNow} />
          </div>
        </Motion.section>

        <Motion.section variants={item} className="grid grid-cols-1 gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-5">
            <AutonomyPosturePanel posture={autonomyPosture} />
            <FleetHealthPanel summary={overviewSummary} onOpenDetail={onOpenDetail} />
          </div>
          <div className="space-y-5">
            <div className="ui-panel p-5">
              <CommandSectionHeader
                eyebrow="Strategic Control Zone"
                title="Doctrine and learned command patterns"
                description="The same memory engine powering Mission Control, Reports, and Intelligence surfaces now drives the flagship bridge."
                icon={BrainCircuit}
                tone="teal"
                action={<span className="ui-chip border-aurora-teal/20 bg-aurora-teal/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-teal">Live doctrine</span>}
              />
              <DoctrineCards items={learningMemory.topThree} compact />
            </div>
            <CostControlPanel
              summary={{
                ...costData,
                topModel: costData.models?.[0] || null,
              }}
            />
          </div>
        </Motion.section>

        <Motion.section variants={item} className="space-y-5">
          <div className="ui-panel p-5">
            <CommandSectionHeader
              eyebrow="Research Direction"
              title="What this bridge is borrowing from elite command surfaces"
              description="A focused design-research readout translated into implementation rules for this page."
              icon={Rocket}
              tone="blue"
            />
            <div className="grid gap-3 md:grid-cols-3">
              <div className="ui-panel-soft p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                  <Sparkles className="h-3.5 w-3.5 text-aurora-teal" />
                  Borrow
                </div>
                <p className="mt-3 text-[13px] leading-6 text-text-body">
                  Cinematic hero framing, dense operational sidecars, launch-readiness language, and control-room information hierarchy.
                </p>
              </div>
              <div className="ui-panel-soft p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                  <ShieldCheck className="h-3.5 w-3.5 text-aurora-blue" />
                  Keep grounded
                </div>
                <p className="mt-3 text-[13px] leading-6 text-text-body">
                  Every dramatic cue maps back to real app data, current actions, or trusted state. No fake sci-fi clutter.
                </p>
              </div>
              <div className="ui-panel-soft p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                  <BrainCircuit className="h-3.5 w-3.5 text-aurora-violet" />
                  Avoid
                </div>
                <p className="mt-3 text-[13px] leading-6 text-text-body">
                  Avoid decorative chrome that obscures priority, duplicate panels, or any visual idea that splits the page away from the existing command family.
                </p>
              </div>
            </div>
          </div>

          <CommandSquadPanel
            operators={operatorAgents}
            providerByModel={providerByModel}
            flaggedIds={flaggedAgentIds}
            onOpenDetail={onOpenDetail}
            onAddOperator={() => onNavigate?.('managedOps', { tab: 'quickstart' })}
          />
        </Motion.section>
      </Motion.div>
    </div>
  );
}
