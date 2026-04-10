import { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { BrainCircuit, Loader2, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { container, item } from '../utils/variants';
import { cn } from '../utils/cn';
import { useActivityLog, useCostData, useModelBank, usePendingReviews, useSchedules, useTaskInterventions } from '../utils/useSupabase';
import { CreateAgentModal } from '../components/CreateAgentModal';
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
import { getAutonomyMetrics, getDoctrineDeltaSummary, getPrimaryBottleneck } from '../utils/commanderAnalytics';

function formatWaitLabel(ms) {
  if (!ms || ms <= 0) return 'None';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function ExecutiveBriefingPanel({ briefing, deltaItems = [], onNavigate, onOpenDetail, onAddOperator }) {
  const handlePrimary = () => {
    if (briefing.primary.type === 'detail' && briefing.primary.target) {
      onOpenDetail?.(briefing.primary.target);
      return;
    }
    if (briefing.primary.type === 'operator') {
      onAddOperator?.();
      return;
    }
    onNavigate?.('missions');
  };

  return (
    <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(135deg,rgba(0,217,200,0.08),rgba(96,165,250,0.04),rgba(255,255,255,0.02))] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-teal">Executive Briefing</div>
          <div className="mt-2 text-xl font-semibold text-text-primary">{briefing.primary.title}</div>
          <p className="mt-2 text-[13px] leading-6 text-text-body">{briefing.primary.detail}</p>
        </div>
        <button
          type="button"
          onClick={handlePrimary}
          className="rounded-2xl border border-aurora-teal/20 bg-aurora-teal/10 px-4 py-3 text-[12px] font-semibold text-aurora-teal transition-colors hover:bg-aurora-teal/15"
        >
          {briefing.primary.cta}
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {briefing.secondary.map((item) => (
          <div key={item.title} className="rounded-[20px] border border-white/8 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{item.eyebrow}</div>
            <div className="mt-2 text-[14px] font-semibold text-text-primary">{item.title}</div>
            <p className="mt-2 text-[12px] leading-5 text-text-muted">{item.detail}</p>
          </div>
        ))}
      </div>
      {deltaItems.length > 0 && (
        <div className="mt-4 rounded-[22px] border border-white/8 bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Doctrine Trust Movement</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {deltaItems.map((entry) => (
              <div key={entry.id} className="rounded-[18px] border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[12px] font-semibold text-text-primary">{entry.owner}</div>
                  <span className={cn(
                    'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                    entry.trend === 'up'
                      ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                      : entry.trend === 'down'
                        ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
                        : 'border-white/10 bg-white/[0.03] text-text-muted'
                  )}>
                    {entry.delta > 0 ? '+' : ''}{entry.delta} pts
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-text-muted">{entry.changeSummary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BottleneckRail({ bottleneck, autonomyMetrics }) {
  if (!bottleneck) return null;

  return (
    <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(135deg,rgba(167,139,250,0.08),rgba(255,255,255,0.02))] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-violet">Single Bottleneck</div>
          <div className="mt-2 text-xl font-semibold text-text-primary">{bottleneck.title}</div>
          <p className="mt-2 text-[13px] leading-6 text-text-body">{bottleneck.detail}</p>
          <p className="mt-3 text-[12px] font-semibold text-aurora-violet">{bottleneck.action}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Autonomy ratio</div>
            <div className="mt-2 text-[20px] font-semibold text-text-primary">{autonomyMetrics.autonomyRatio}%</div>
            <div className="mt-1 text-[11px] text-text-muted">{autonomyMetrics.label}</div>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Rescue rate</div>
            <div className="mt-2 text-[20px] font-semibold text-text-primary">{autonomyMetrics.rescueRate}%</div>
            <div className="mt-1 text-[11px] text-text-muted">{autonomyMetrics.rescueTouchedMissions} mission{autonomyMetrics.rescueTouchedMissions === 1 ? '' : 's'} needed rescue</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OverviewView({ agents, tasks, loading, addOptimistic, onOpenDetail, onNavigate }) {
  const { logs } = useActivityLog();
  const { reviews } = usePendingReviews();
  const { schedules, loading: loadingSchedules } = useSchedules();
  const { models } = useModelBank();
  const { data: costData } = useCostData();
  const { interventions } = useTaskInterventions();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [referenceNow] = useState(() => new Date().getTime());

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
  const avgApprovalWaitMs = approvalWaitTimes.length
    ? Math.round(approvalWaitTimes.reduce((sum, value) => sum + value, 0) / approvalWaitTimes.length)
    : 0;
  const longestApprovalWaitMs = approvalWaitTimes.length ? Math.max(...approvalWaitTimes) : 0;

  const lateSchedules = useMemo(
    () => schedules.filter((job) => job.status === 'active' && job.nextRunAt && new Date(job.nextRunAt).getTime() < referenceNow).length,
    [referenceNow, schedules]
  );
  const needsAttention = reviews.length + failedTasks.length + stalledAgents.length + lateSchedules;

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
      .map((task) => ({
        ...task,
        needsReview: reviewAgentIds.has(task.agentId),
        blocker:
          task.status === 'error'
            ? 'Task failed and likely needs retry or review.'
            : reviewAgentIds.has(task.agentId)
              ? 'Waiting on human approval.'
              : task.status === 'pending'
                ? 'Queued behind current work.'
                : 'Running normally.',
      }));
  }, [reviews, tasks]);

  const overviewSummary = {
    primaryMessage:
      needsAttention > 0
        ? `${needsAttention} items need attention before the system is fully clear.`
        : 'Fleet is clear and work is moving normally.',
    needsAttention,
    activeAgents,
    burnRate: costData.burnRate,
    pendingApprovals: reviews.length,
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
  };
  const learningMemory = useLearningMemory({ agents, tasks, approvals: reviews, logs, costData });
  const doctrineDeltas = useMemo(() => getDoctrineDeltaSummary(learningMemory.doctrine).slice(0, 2), [learningMemory.doctrine]);
  const truth = useCommandCenterTruth();
  const timelineEntries = useMemo(() => buildTimelineEntries({ tasks, reviews, logs }), [logs, reviews, tasks]);
  const autonomyMetrics = useMemo(
    () => getAutonomyMetrics(tasks, interventions, logs),
    [tasks, interventions, logs]
  );
  const primaryBottleneck = useMemo(
    () => getPrimaryBottleneck({ tasks, reviews, schedules, agents, interventions, logs, costData }),
    [tasks, reviews, schedules, agents, interventions, logs, costData]
  );

  const readiness = useMemo(() => {
    const score = Math.max(0, Math.min(100, 100 - (reviews.length * 8) - (failedTasks.length * 12) - (stalledAgents.length * 10) - (lateSchedules * 7)));
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
  }, [reviews.length, failedTasks.length, stalledAgents.length, lateSchedules]);

  const readFirstItems = useMemo(() => {
    const primaryDrag = reviews.length > 0
      ? `${reviews.length} approval${reviews.length === 1 ? '' : 's'} are slowing the machine first`
      : lateSchedules > 0
        ? `${lateSchedules} automation${lateSchedules === 1 ? ' is' : 's are'} behind schedule`
        : 'The machine is clear enough to push throughput';
    const spendLeader = costData.models?.[0];
    const topOperator = flaggedAgents[0]?.name || operatorAgents[0]?.name || 'Commander';
    return [
      {
        eyebrow: 'Read First',
        title: primaryDrag,
        detail: reviews.length > 0
          ? 'The fastest executive win is clearing approvals or bundling decisions so missions stop stacking behind humans.'
          : lateSchedules > 0
            ? 'Recurring systems have drifted behind their next run window, so automation credibility is the first thing to restore.'
            : 'No dominant choke point is visible. This is the right moment to launch, delegate, or scale the cleanest lane.',
        tone: 'text-aurora-amber',
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
        eyebrow: 'Operator Signal',
        title: `${topOperator} is the operator to watch`,
        detail: flaggedAgents.length > 0
          ? 'This operator is creating the clearest signal on the bridge right now and should be checked before pushing more volume.'
          : spendLeader
            ? `${spendLeader.name} is currently consuming the most budget, so it is the first place to tighten routing discipline.`
            : 'No single operator or model is dominating the board yet, which means you still have room to shape clean habits.',
        tone: 'text-aurora-blue',
      },
    ];
  }, [reviews.length, lateSchedules, costData.models, flaggedAgents, operatorAgents, readiness.score]);

  const autonomyPosture = useMemo(() => {
    const humanGates = reviews.length + lateSchedules;
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
    const primaryDrag = reviews.length > 0
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
  }, [reviews.length, lateSchedules, failedTasks.length, stalledAgents.length, runningTasks.length, pendingTasks.length, readiness]);

  const launchProtocolActions = useMemo(() => {
    const actions = [];
    if (reviews.length > 0) {
      actions.push({
        label: 'Clear approval drag',
        detail: `${reviews.length} item${reviews.length === 1 ? '' : 's'} are waiting on human judgment before execution can continue.`,
        badge: `${reviews.length} gates`,
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
  }, [reviews.length, flaggedAgents, lateSchedules, operatorAgents.length]);

  const executiveBriefing = useMemo(() => {
    if (reviews.length > 0) {
      return {
        primary: {
          title: `Clear ${reviews.length} approval gate${reviews.length === 1 ? '' : 's'} first`,
          detail: 'Human decisions are the fastest lever on the board right now. Clear the gates and Commander can resume the stalled branches immediately.',
          cta: 'Open approvals',
          type: 'navigate',
          target: 'missions',
        },
        secondary: [
          {
            eyebrow: 'Next',
            title: `${runningTasks.length} branch${runningTasks.length === 1 ? '' : 'es'} already moving`,
            detail: 'Keep throughput up while you clear the human choke point.',
          },
          {
            eyebrow: 'Watch',
            title: avgApprovalWaitMs > 0 ? `${formatWaitLabel(avgApprovalWaitMs)} average approval lag` : 'Fresh approval queue',
            detail: 'If this number climbs, Commander needs fewer human stops and better mission posture defaults.',
          },
          {
            eyebrow: 'After that',
            title: 'Launch the next mission wave',
            detail: 'Once the queue is clear, the bridge is ready for another delegated run.',
          },
        ],
      };
    }

    if (flaggedAgents[0]) {
      return {
        primary: {
          title: `Inspect ${flaggedAgents[0].name} before scaling`,
          detail: flaggedAgents[0].reason,
          cta: 'Open operator',
          type: 'detail',
          target: flaggedAgents[0].id,
        },
        secondary: [
          {
            eyebrow: 'Risk',
            title: `${failedTasks.length + stalledAgents.length} unstable branch${failedTasks.length + stalledAgents.length === 1 ? '' : 'es'}`,
            detail: 'Stability is the current limiter, not demand.',
          },
          {
            eyebrow: 'Command',
            title: 'Reroute before adding volume',
            detail: 'Use Mission Control to redirect weak branches to stronger lanes or specialists.',
          },
          {
            eyebrow: 'After that',
            title: 'Restore launch posture',
            detail: 'Once the weak lane is stabilized, the bridge can resume normal throughput.',
          },
        ],
      };
    }

    if (operatorAgents.length < 3) {
      return {
        primary: {
          title: 'Add a persistent specialist lane',
          detail: 'Commander is functional, but the machine will feel much more like Jarvis once planner, researcher, builder, and verifier coverage are more permanent.',
          cta: 'Add operator',
          type: 'operator',
          target: null,
        },
        secondary: [
          {
            eyebrow: 'Opportunity',
            title: 'Persistent lanes reduce spawn churn',
            detail: 'Reusable specialists improve routing quality and keep more context alive between missions.',
          },
          {
            eyebrow: 'Current state',
            title: `${operatorAgents.length} specialist lane${operatorAgents.length === 1 ? '' : 's'} live`,
            detail: 'The bridge still has room to become a true multi-lane operating system.',
          },
          {
            eyebrow: 'After that',
            title: 'Push more delegated work',
            detail: 'Once the persistent fleet is deeper, Commander can scale more safely.',
          },
        ],
      };
    }

    return {
      primary: {
        title: 'Tell Commander what you want next',
        detail: 'The bridge is stable enough to hand Commander a new objective. This is the right moment to launch, plan, or stage the next mission with minimal friction.',
        cta: 'Open Mission Control',
        type: 'navigate',
        target: 'missions',
      },
      secondary: [
        {
          eyebrow: 'Readiness',
          title: readiness.label,
          detail: readiness.readback,
        },
        {
          eyebrow: 'Autonomy',
          title: `${autonomyPosture.autonomousPercent}% self-driving`,
          detail: autonomyPosture.primaryDrag,
        },
        {
          eyebrow: 'Now',
          title: 'Best next leverage is fresh work',
          detail: 'No dominant choke point is visible, which means Commander is ready for the next sentence.',
        },
      ],
    };
  }, [reviews.length, flaggedAgents, failedTasks.length, stalledAgents.length, operatorAgents.length, runningTasks.length, avgApprovalWaitMs, readiness, autonomyPosture]);

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
        <div className="absolute -top-16 left-[-8%] h-[360px] w-[360px] rounded-full bg-aurora-teal/10 blur-[120px]" />
        <div className="absolute top-[10%] right-[-12%] h-[420px] w-[420px] rounded-full bg-aurora-blue/10 blur-[140px]" />
        <div className="absolute bottom-[-22%] left-[18%] h-[420px] w-[420px] rounded-full bg-aurora-violet/10 blur-[160px]" />
      </div>

      <Motion.div variants={container} initial="hidden" animate="show" className="relative space-y-5">
        <Motion.div variants={item}>
          <CommanderHero
            commander={commanderAgent}
            provider={commanderAgent ? providerByModel.get(commanderAgent.model) : null}
            operatorCount={operatorAgents.length}
            summary={overviewSummary}
            readiness={readiness}
            onNavigate={onNavigate}
            onOpenDetail={onOpenDetail}
          />
        </Motion.div>

        <Motion.div variants={item}>
          <CommandReadFirst items={readFirstItems} />
        </Motion.div>

        <Motion.div variants={item}>
          <ExecutiveBriefingPanel
            briefing={executiveBriefing}
            deltaItems={doctrineDeltas}
            onNavigate={onNavigate}
            onOpenDetail={onOpenDetail}
            onAddOperator={() => setCreateModalOpen(true)}
          />
        </Motion.div>

        <Motion.div variants={item}>
          <BottleneckRail bottleneck={primaryBottleneck} autonomyMetrics={autonomyMetrics} />
        </Motion.div>

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
              onAddOperator={() => setCreateModalOpen(true)}
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
            <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5">
              <CommandSectionHeader
                eyebrow="Strategic Control Zone"
                title="Doctrine and learned command patterns"
                description="The same memory engine powering Mission Control, Reports, and Intelligence surfaces now drives the flagship bridge."
                icon={BrainCircuit}
                tone="teal"
                action={<span className="rounded-full border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-teal">Live doctrine</span>}
              />
              <DoctrineCards items={learningMemory.topThree} compact />
            </div>
            <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(96,165,250,0.06),rgba(255,255,255,0.02))] p-5">
              <CommandSectionHeader
                eyebrow="Doctrine Delta"
                title="What Commander is trusting more or less"
                description="A compact trust-movement rail so the flagship bridge shows belief changes, not just current state."
                icon={Sparkles}
                tone="blue"
              />
              <div className="mt-4 grid gap-3">
                {doctrineDeltas.map((entry) => (
                  <div key={entry.id} className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] font-semibold text-text-primary">{entry.title}</div>
                      <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                        {entry.trend === 'up' ? `+${entry.delta}` : entry.delta}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-text-body">{entry.changeSummary}</div>
                  </div>
                ))}
              </div>
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
          <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5">
            <CommandSectionHeader
              eyebrow="Research Direction"
              title="What this bridge is borrowing from elite command surfaces"
              description="A focused design-research readout translated into implementation rules for this page."
              icon={Rocket}
              tone="blue"
            />
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                  <Sparkles className="h-3.5 w-3.5 text-aurora-teal" />
                  Borrow
                </div>
                <p className="mt-3 text-[13px] leading-6 text-text-body">
                  Cinematic hero framing, dense operational sidecars, launch-readiness language, and control-room information hierarchy.
                </p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                  <ShieldCheck className="h-3.5 w-3.5 text-aurora-blue" />
                  Keep grounded
                </div>
                <p className="mt-3 text-[13px] leading-6 text-text-body">
                  Every dramatic cue maps back to real app data, current actions, or trusted state. No fake sci-fi clutter.
                </p>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
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
            onAddOperator={() => setCreateModalOpen(true)}
          />
        </Motion.section>

        <CreateAgentModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={(optimisticAgent) => addOptimistic?.(optimisticAgent)}
        />
      </Motion.div>
    </div>
  );
}
