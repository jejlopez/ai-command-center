export function buildTimelineEntries({ tasks = [], reviews = [], logs = [], connectedSystems = [] }) {
  const taskEntries = tasks.slice(0, 4).map((task) => ({
    id: `task-${task.id}`,
    type: 'mission',
    title: task.name || task.title || 'Mission update',
    detail: `${String(task.status || 'queued').replaceAll('_', ' ')}${task.agentName ? ` · ${task.agentName}` : ''}`,
    timestamp: task.updatedAt || task.startedAt || task.runAt || task.createdAt,
  }));

  const reviewEntries = reviews.slice(0, 3).map((review) => ({
    id: `review-${review.id}`,
    type: 'approval',
    title: review.title || 'Approval requested',
    detail: `${review.agentName || 'System'} is waiting on human judgment.`,
    timestamp: review.createdAt,
  }));

  const systemEntries = connectedSystems
    .filter((system) => ['degraded', 'needs_refresh', 'error', 'connected'].includes(String(system.status || '').toLowerCase()))
    .slice(0, 3)
    .map((system) => ({
      id: `system-${system.id}`,
      type: 'system',
      title: system.displayName,
      detail: `${String(system.status || 'connected').replaceAll('_', ' ')} · ${system.category || 'System'}`,
      timestamp: system.updatedAt || system.lastVerifiedAt || system.createdAt,
    }));

  const logEntries = logs.slice(-4).reverse().map((log, index) => ({
    id: `log-${log.id || index}`,
    type: String(log.message || '').includes('[batch-intervention-]')
      ? 'command'
      : log.type === 'ERR'
        ? 'alert'
        : 'log',
    title: String(log.message || '').includes('[batch-intervention-]')
      ? 'Batch command audit'
      : log.type === 'ERR'
        ? 'Execution anomaly'
        : 'Command traffic',
    detail: log.message,
    timestamp: log.timestamp,
  }));

  return [...reviewEntries, ...taskEntries, ...systemEntries, ...logEntries]
    .filter(Boolean)
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 8);
}
