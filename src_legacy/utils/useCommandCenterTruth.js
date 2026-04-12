import { useMemo } from 'react';
import { useDerivedAlerts } from './useDerivedAlerts';
import { useCommanderPreferences } from './useCommanderPreferences';
import {
  useAgents,
  useConnectedSystems,
  useKnowledgeNamespaces,
  usePendingReviews,
  useSharedDirectives,
  useSystemRecommendations,
  useTasks,
} from './useSupabase';

export function useCommandCenterTruth() {
  const { agents } = useAgents();
  const { tasks } = useTasks();
  const { reviews } = usePendingReviews();
  const { connectedSystems } = useConnectedSystems();
  const { namespaces } = useKnowledgeNamespaces();
  const { directives } = useSharedDirectives();
  const { recommendations } = useSystemRecommendations();
  const { unreadCount, criticalCount } = useDerivedAlerts();
  const {
    commandStyle,
    commanderPersona,
    notificationRoute,
    alertPosture,
    trustedWriteMode,
    approvalDoctrine,
  } = useCommanderPreferences();

  return useMemo(() => {
    const commander = agents.find((agent) => agent.role === 'commander') || null;
    const activeMissions = tasks.filter((task) => ['queued', 'running', 'pending', 'in_progress'].includes(String(task.status || '').toLowerCase())).length;
    const blockedMissions = tasks.filter((task) => ['failed', 'error', 'blocked', 'cancelled'].includes(String(task.status || '').toLowerCase())).length;
    const approvalMissions = tasks.filter((task) => String(task.status || '').toLowerCase() === 'needs_approval').length;
    const connectedSystemsCount = connectedSystems.length;
    const doctrineHighlights = directives.length + recommendations.length;
    const profileState = `${commanderPersona} · ${commandStyle}`;
    const readinessChecks = [
      {
        id: 'commander-online',
        label: 'Commander online',
        passed: Boolean(commander?.name || 'Jarvis Commander'),
        detail: commander?.name ? `${commander.name} is present as the system authority.` : 'Commander identity is missing from the live graph.',
      },
      {
        id: 'systems-wired',
        label: 'Core systems wired',
        passed: connectedSystemsCount > 0,
        detail: connectedSystemsCount > 0 ? `${connectedSystemsCount} connected systems are available to missions.` : 'No connected systems are wired into the live dock yet.',
      },
      {
        id: 'critical-alerts',
        label: 'Critical alerts contained',
        passed: criticalCount === 0,
        detail: criticalCount === 0 ? 'No critical alert pressure is active right now.' : `${criticalCount} critical alerts are still active in the command loop.`,
      },
      {
        id: 'approval-drag',
        label: 'Approval drag acceptable',
        passed: reviews.length + approvalMissions < 3,
        detail: reviews.length + approvalMissions < 3
          ? 'Approval pressure is light enough to launch confidently.'
          : `${reviews.length + approvalMissions} approvals are still slowing launch speed.`,
      },
      {
        id: 'intelligence-live',
        label: 'Intelligence surfaces live',
        passed: namespaces.length + directives.length + recommendations.length > 0,
        detail: namespaces.length + directives.length + recommendations.length > 0
          ? 'Knowledge, directives, or recommendations are flowing from live tables.'
          : 'Intelligence is still empty-state only; no live namespaces, directives, or recommendations are present.',
      },
    ];
    const failingChecks = readinessChecks.filter((item) => !item.passed);
    const readinessState = failingChecks.length === 0 ? 'ready' : criticalCount > 0 ? 'blocked' : 'caution';
    const readinessLabel = readinessState === 'ready'
      ? 'Launch ready'
      : readinessState === 'blocked'
        ? 'Blocked'
        : 'Needs review';

    return {
      commanderName: commander?.name || 'Jarvis Commander',
      connectedSystemsCount,
      pendingApprovals: reviews.length + approvalMissions,
      activeMissions,
      blockedMissions,
      unreadAlerts: unreadCount,
      criticalAlerts: criticalCount,
      profileState,
      alertPosture,
      notificationRoute,
      trustedWriteMode,
      approvalDoctrine,
      namespacesCount: namespaces.length,
      directivesCount: directives.length,
      recommendationsCount: recommendations.length,
      doctrineHighlights,
      readinessState,
      readinessLabel,
      readinessChecks,
      readinessFailures: failingChecks,
      checklist: [
        { id: 'commander', label: 'Commander identity', value: commander?.name || 'Jarvis Commander', target: 'Shell, Profile, Mission Control, Overview', healthy: Boolean(commander?.name || 'Jarvis Commander') },
        { id: 'approvals', label: 'Pending approvals', value: reviews.length + approvalMissions, target: 'Shell, Notifications, Mission Control, Profile', healthy: true },
        { id: 'systems', label: 'Connected systems', value: connectedSystemsCount, target: 'Settings, Profile, Mission Creator, Notifications', healthy: true },
        { id: 'alerts', label: 'Critical alerts', value: criticalCount, target: 'Shell pulse, Notifications, Mission Control', healthy: true },
        { id: 'route', label: 'Route posture', value: `${alertPosture} via ${notificationRoute}`, target: 'Settings, Profile, Notifications', healthy: true },
        { id: 'trust', label: 'Trust doctrine', value: `${trustedWriteMode} / ${approvalDoctrine}`, target: 'Settings, Mission Creator, Profile', healthy: true },
        { id: 'intelligence', label: 'Intelligence sources', value: `${namespaces.length} namespaces · ${directives.length} directives · ${recommendations.length} recommendations`, target: 'Intelligence, Reports, Mission Control doctrine', healthy: doctrineHighlights >= 0 },
      ],
    };
  }, [
    agents,
    alertPosture,
    approvalDoctrine,
    commandStyle,
    commanderPersona,
    connectedSystems,
    criticalCount,
    directives.length,
    namespaces.length,
    notificationRoute,
    recommendations.length,
    reviews.length,
    tasks,
    trustedWriteMode,
    unreadCount,
  ]);
}
