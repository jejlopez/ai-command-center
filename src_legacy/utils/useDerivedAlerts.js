import { useMemo } from 'react';
import { useCommanderPreferences } from './useCommanderPreferences';
import { useAgents, useConnectedSystems, usePendingReviews, useTasks } from './useSupabase';

function relativeMinutes(minutes) {
  return new Date(Date.now() - minutes * 60_000);
}

function normalizeStatus(status) {
  return String(status || '').toLowerCase();
}

export function isWithinQuietHours(enabled, start, end) {
  if (!enabled || !start || !end) return false;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const startValue = startHour * 60 + startMinute;
  const endValue = endHour * 60 + endMinute;
  if (startValue === endValue) return false;
  if (startValue < endValue) return current >= startValue && current < endValue;
  return current >= startValue || current < endValue;
}

export function buildDirective(alerts, pendingCount) {
  const topCritical = alerts.find((alert) => alert.type === 'critical' || alert.type === 'failure');
  if (topCritical) {
    return {
      eyebrow: 'Immediate action',
      title: topCritical.headline,
      detail: topCritical.detail,
      actionLabel: topCritical.actionLabel || 'Open now',
      action: topCritical.action,
      tone: 'rose',
    };
  }

  if (pendingCount > 0) {
    return {
      eyebrow: 'Human bottleneck',
      title: 'Approval friction is the main drag right now.',
      detail: 'Clearing human review first will usually do more than tuning execution speed.',
      actionLabel: 'Open approvals',
      action: { type: 'navigate', route: 'missions' },
      tone: 'amber',
    };
  }

  return {
    eyebrow: 'Command readback',
    title: 'Alert bus is stable and the deck is readable.',
    detail: 'No major anomalies are crowding attention. You can stay in flow and inspect only what matters.',
    actionLabel: 'Open Mission Control',
    action: { type: 'navigate', route: 'missions' },
    tone: 'teal',
  };
}

function buildAlerts({ agents, tasks, reviews, connectedSystems }) {
  const alerts = [];
  const processingAgents = agents.filter((agent) => normalizeStatus(agent.status) === 'processing').length;
  const brokenAgents = agents.filter((agent) => normalizeStatus(agent.status) === 'error');
  const runningTasks = tasks.filter((task) => ['queued', 'running', 'pending', 'in_progress'].includes(normalizeStatus(task.status)));
  const completedTasks = tasks.filter((task) => ['done', 'completed'].includes(normalizeStatus(task.status))).slice(0, 2);
  const reviewCount = reviews.length;
  const degradedSystems = connectedSystems.filter((system) => ['degraded', 'needs_refresh', 'error'].includes(normalizeStatus(system.status)));

  brokenAgents.forEach((agent, index) => {
    alerts.push({
      id: `agent-error-${agent.id}`,
      type: 'failure',
      headline: `${agent.name} failed inside the execution deck`,
      detail: agent.errorMessage || 'Agent entered an error state and needs inspection or reassignment.',
      createdAt: relativeMinutes(2 + index),
      actionLabel: 'Inspect agent',
      action: { type: 'agent', agentId: agent.id },
      unread: true,
    });
  });

  if (reviewCount > 0) {
    alerts.push({
      id: 'approval-queue',
      type: reviewCount > 2 ? 'critical' : 'approval',
      headline: `${reviewCount} approval gate${reviewCount > 1 ? 's are' : ' is'} holding the line`,
      detail: 'Human sign-off is still the first bottleneck. Clear the queue or lower friction on low-risk branches.',
      createdAt: relativeMinutes(4),
      actionLabel: 'Open approvals',
      action: { type: 'navigate', route: 'missions' },
      unread: true,
    });
  }

  degradedSystems.forEach((system, index) => {
    const status = normalizeStatus(system.status);
    alerts.push({
      id: `system-${system.id}`,
      type: status === 'error' ? 'critical' : 'system',
      headline: `${system.displayName} needs attention`,
      detail: status === 'needs_refresh'
        ? 'Credentials or connection freshness need a health check before this system should steer live workflows.'
        : status === 'degraded'
          ? 'The integration is online but not fully healthy. Verify sync and capability coverage.'
          : 'The integration is not healthy enough to trust in the live command loop.',
      createdAt: relativeMinutes(6 + index),
      actionLabel: 'Open systems control',
      action: { type: 'panel', panel: 'settings' },
      unread: true,
    });
  });

  alerts.push({
    id: 'system-pulse',
    type: 'system',
    headline: `${runningTasks.length} mission${runningTasks.length === 1 ? '' : 's'} are active in the live deck`,
    detail: `${processingAgents} branch${processingAgents === 1 ? '' : 'es'} are currently hot. Command pulse is healthy unless approval drag spikes.`,
    createdAt: relativeMinutes(8),
    actionLabel: 'Open Mission Control',
    action: { type: 'navigate', route: 'missions' },
    unread: brokenAgents.length > 0 || reviewCount > 0 || degradedSystems.length > 0,
  });

  completedTasks.forEach((task, index) => {
    alerts.push({
      id: `success-${task.id}`,
      type: 'success',
      headline: `${task.name || task.title} landed cleanly`,
      detail: `${task.agentName || 'Agent'} finished the run${task.costUsd ? ` at $${Number(task.costUsd).toFixed(2)}` : ''}.`,
      createdAt: relativeMinutes(14 + index * 4),
      actionLabel: 'Open mission',
      action: { type: 'navigate', route: 'missions' },
      unread: false,
    });
  });

  return alerts.sort((a, b) => b.createdAt - a.createdAt);
}

export function useDerivedAlerts() {
  const { agents } = useAgents();
  const { tasks } = useTasks();
  const { reviews } = usePendingReviews();
  const { connectedSystems } = useConnectedSystems();
  const {
    alertPosture,
    quietHoursEnabled,
    quietHoursStart,
    quietHoursEnd,
    notificationRoute,
    commanderPersona,
  } = useCommanderPreferences();

  const alerts = useMemo(
    () => buildAlerts({ agents, tasks, reviews, connectedSystems }),
    [agents, tasks, reviews, connectedSystems]
  );

  const quietActive = useMemo(
    () => isWithinQuietHours(quietHoursEnabled, quietHoursStart, quietHoursEnd),
    [quietHoursEnabled, quietHoursStart, quietHoursEnd]
  );

  const visibleAlerts = useMemo(() => {
    const quietFiltered = quietActive
      ? alerts.filter((alert) => ['critical', 'failure'].includes(alert.type))
      : alerts;

    if (alertPosture === 'critical_only') {
      return quietFiltered.filter((alert) => ['critical', 'failure', 'approval'].includes(alert.type));
    }
    if (alertPosture === 'balanced') {
      return quietFiltered.filter((alert) => alert.type !== 'success');
    }
    return quietFiltered;
  }, [alerts, alertPosture, quietActive]);

  const unreadCount = visibleAlerts.filter((alert) => alert.unread).length;
  const criticalCount = visibleAlerts.filter((alert) => ['critical', 'failure'].includes(alert.type)).length;
  const approvalCount = visibleAlerts.filter((alert) => ['approval', 'critical'].includes(alert.type)).length;
  const systemCount = visibleAlerts.filter((alert) => alert.type === 'system').length;
  const directive = useMemo(() => buildDirective(visibleAlerts, reviews.length), [visibleAlerts, reviews.length]);

  return {
    alerts,
    visibleAlerts,
    unreadCount,
    criticalCount,
    approvalCount,
    systemCount,
    quietActive,
    notificationRoute,
    commanderPersona,
    alertPosture,
    directive,
  };
}
