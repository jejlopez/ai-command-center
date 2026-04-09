import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { container, item } from '../utils/variants';
import { useActivityLog, useCostData, usePendingReviews, useSchedules } from '../utils/useSupabase';
import { CreateAgentModal } from '../components/CreateAgentModal';
import { Loader2 } from 'lucide-react';
import { OverviewBriefingHeader } from '../components/overview/OverviewBriefingHeader';
import { AttentionStrip } from '../components/overview/AttentionStrip';
import { LiveOpsTable } from '../components/overview/LiveOpsTable';
import { FleetHealthPanel } from '../components/overview/FleetHealthPanel';
import { CostControlPanel } from '../components/overview/CostControlPanel';
import { SchedulesBottlenecksPanel } from '../components/overview/SchedulesBottlenecksPanel';

function formatWaitLabel(ms) {
  if (!ms || ms <= 0) return 'None';
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

export function OverviewView({ agents, tasks, loading, addOptimistic, onOpenDetail, onNavigate }) {
  const { logs } = useActivityLog();
  const { reviews, loading: loadingReviews } = usePendingReviews();
  const { schedules, loading: loadingSchedules } = useSchedules();
  const { data: costData } = useCostData();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const activeAgents = agents.filter(a => a.status === 'processing').length;
  const idleAgents = agents.filter(a => a.status === 'idle').length;
  const errorAgents = agents.filter(a => a.status === 'error').length;
  const failedTasks = tasks.filter((task) => task.status === 'error');
  const runningTasks = tasks.filter((task) => task.status === 'running');
  const pendingTasks = tasks.filter((task) => task.status === 'pending');
  const errorLogs = logs.filter((log) => log.type === 'ERR');

  const stalledAgents = agents.filter((agent) => {
    if (!agent.lastHeartbeat) return false;
    const heartbeatAge = Date.now() - new Date(agent.lastHeartbeat).getTime();
    return heartbeatAge > 10 * 60 * 1000 && agent.status !== 'idle';
  });

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

  const questionCount = reviews.filter((review) => ['message', 'question'].includes(review.outputType)).length;
  const now = Date.now();
  const lateSchedules = schedules.filter((job) => job.status === 'active' && job.nextRunAt && new Date(job.nextRunAt).getTime() < now).length;
  const needsAttention = reviews.length + failedTasks.length + stalledAgents.length;
  const attentionItems = [
    {
      id: 'approvals',
      label: 'Pending approvals',
      value: reviews.length,
      detail: reviews.length ? 'Human sign-off needed before agents proceed.' : 'Approval queue is clear.',
      badge: reviews.some((review) => review.urgency === 'critical') ? 'Critical' : 'Queue',
      tone: reviews.length ? 'warning' : 'info',
      clickable: true,
    },
    {
      id: 'schedules',
      label: 'Late schedules',
      value: lateSchedules,
      detail: lateSchedules ? 'Scheduled work missed its expected run window.' : 'All tracked schedules are on time.',
      badge: 'Scheduler',
      tone: lateSchedules ? 'critical' : 'info',
      clickable: false,
    },
    {
      id: 'failures',
      label: 'Failed tasks',
      value: failedTasks.length,
      detail: failedTasks.length ? 'Task errors need retry, reassignment, or review.' : 'No failed tasks right now.',
      badge: 'Errors',
      tone: failedTasks.length ? 'critical' : 'info',
      clickable: false,
    },
    {
      id: 'stalled',
      label: 'Stalled agents',
      value: stalledAgents.length,
      detail: stalledAgents.length ? 'Agents are active but have stale heartbeats.' : 'No stale active agents.',
      badge: 'Heartbeat',
      tone: stalledAgents.length ? 'warning' : 'info',
      clickable: false,
    },
    {
      id: 'cost',
      label: 'Spend today',
      value: `$${costData.total.toFixed(2)}`,
      detail: costData.total > 0 ? `Burning about $${costData.burnRate.toFixed(2)}/hr.` : 'No spend recorded yet today.',
      badge: 'Budget',
      tone: costData.total > 0 ? 'info' : 'info',
      clickable: false,
    },
    {
      id: 'alerts',
      label: 'Questions waiting',
      value: questionCount,
      detail: questionCount ? 'Agent outputs that likely need a direct response.' : 'No open agent questions detected.',
      badge: 'Inbox',
      tone: questionCount ? 'warning' : 'info',
      clickable: true,
    },
  ];

  const reviewAgentIds = new Set(reviews.map((review) => review.agentId).filter(Boolean));
  const prioritizedTasks = useMemo(() => {
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
  }, [tasks, reviewAgentIds]);

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
    oldestPendingLabel,
    avgApprovalWaitLabel: formatWaitLabel(avgApprovalWaitMs),
    longestApprovalWaitLabel: formatWaitLabel(longestApprovalWaitMs),
    lateSchedules,
    scheduledJobs: schedules.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-aurora-teal animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-12 gap-5 pb-8"
    >
      <motion.div variants={item} className="col-span-12">
        <OverviewBriefingHeader
          summary={overviewSummary}
          onDeploy={() => setCreateModalOpen(true)}
          onNavigate={onNavigate}
        />
      </motion.div>

      <motion.div variants={item} className="col-span-12">
        <AttentionStrip
          items={attentionItems}
          loading={loadingReviews}
          onSelect={(itemSelected) => {
            if (itemSelected.id === 'approvals' || itemSelected.id === 'alerts') onNavigate?.('missions');
          }}
        />
      </motion.div>

      <motion.div variants={item} className="col-span-12 xl:col-span-8">
        <LiveOpsTable
          tasks={prioritizedTasks}
          loading={loading}
          onOpenDetail={onOpenDetail}
          onNavigate={onNavigate}
        />
      </motion.div>

      <motion.div variants={item} className="col-span-12 xl:col-span-4">
        <FleetHealthPanel summary={overviewSummary} onOpenDetail={onOpenDetail} />
      </motion.div>

      <motion.div variants={item} className="col-span-12 xl:col-span-6">
        <CostControlPanel
          summary={{
            ...costData,
            topModel: costData.models[0] || null,
          }}
        />
      </motion.div>

      <motion.div variants={item} className="col-span-12 xl:col-span-6">
        <SchedulesBottlenecksPanel summary={overviewSummary} schedules={schedules} loading={loadingSchedules} />
      </motion.div>

      <CreateAgentModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(optimisticAgent) => addOptimistic?.(optimisticAgent)}
      />
    </motion.div>
  );
}
