export const WORKFLOW_STATUS = {
  INTAKE: 'intake',
  PLANNED: 'planned',
  READY: 'ready',
  RUNNING: 'running',
  WAITING_ON_HUMAN: 'waiting_on_human',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export const WORKFLOW_META = {
  [WORKFLOW_STATUS.INTAKE]: { label: 'Intake', tone: 'slate', dagStatus: 'pending' },
  [WORKFLOW_STATUS.PLANNED]: { label: 'Planned', tone: 'blue', dagStatus: 'pending' },
  [WORKFLOW_STATUS.READY]: { label: 'Ready', tone: 'teal', dagStatus: 'pending' },
  [WORKFLOW_STATUS.RUNNING]: { label: 'Running', tone: 'amber', dagStatus: 'running' },
  [WORKFLOW_STATUS.WAITING_ON_HUMAN]: { label: 'Waiting on Human', tone: 'amber', dagStatus: 'pending' },
  [WORKFLOW_STATUS.BLOCKED]: { label: 'Blocked', tone: 'rose', dagStatus: 'error' },
  [WORKFLOW_STATUS.COMPLETED]: { label: 'Completed', tone: 'green', dagStatus: 'completed' },
  [WORKFLOW_STATUS.FAILED]: { label: 'Failed', tone: 'rose', dagStatus: 'error' },
  [WORKFLOW_STATUS.CANCELLED]: { label: 'Cancelled', tone: 'slate', dagStatus: 'pending' },
};

const LEGACY_STATUS_TO_WORKFLOW = {
  queued: WORKFLOW_STATUS.READY,
  running: WORKFLOW_STATUS.RUNNING,
  pending: WORKFLOW_STATUS.PLANNED,
  needs_approval: WORKFLOW_STATUS.WAITING_ON_HUMAN,
  done: WORKFLOW_STATUS.COMPLETED,
  completed: WORKFLOW_STATUS.COMPLETED,
  failed: WORKFLOW_STATUS.FAILED,
  error: WORKFLOW_STATUS.FAILED,
  blocked: WORKFLOW_STATUS.BLOCKED,
  cancelled: WORKFLOW_STATUS.CANCELLED,
  in_progress: WORKFLOW_STATUS.RUNNING,
};

export function inferWorkflowStatus(task = {}) {
  if (task.workflow_status) return task.workflow_status;
  if (task.workflowStatus) return task.workflowStatus;
  if (task.status && LEGACY_STATUS_TO_WORKFLOW[task.status]) return LEGACY_STATUS_TO_WORKFLOW[task.status];
  if (task.requires_approval || task.requiresApproval) return WORKFLOW_STATUS.WAITING_ON_HUMAN;
  return WORKFLOW_STATUS.INTAKE;
}

export function isTerminalWorkflowStatus(status) {
  return [WORKFLOW_STATUS.COMPLETED, WORKFLOW_STATUS.FAILED, WORKFLOW_STATUS.CANCELLED].includes(status);
}

export function getWorkflowMeta(status) {
  return WORKFLOW_META[status] || WORKFLOW_META[WORKFLOW_STATUS.INTAKE];
}

export function getTaskGraphShape(row = {}) {
  const rootMissionId = row.root_mission_id || row.rootMissionId || row.parent_id || row.parentId || row.id || null;
  return {
    nodeType: row.node_type || row.nodeType || 'mission',
    workflowStatus: inferWorkflowStatus(row),
    rootMissionId,
    dependsOn: Array.isArray(row.depends_on) ? row.depends_on : Array.isArray(row.dependsOn) ? row.dependsOn : [],
  };
}
