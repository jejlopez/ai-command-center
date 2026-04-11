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

export function describeTaskTransition(task = {}, allTasks = []) {
  const workflowStatus = inferWorkflowStatus(task);
  const dependencies = Array.isArray(task.dependsOn) ? task.dependsOn : Array.isArray(task.depends_on) ? task.depends_on : [];
  const dependencyRows = dependencies
    .map((dependencyId) => allTasks.find((candidate) => candidate.id === dependencyId))
    .filter(Boolean);
  const completedDependencies = dependencyRows.filter((dependency) => inferWorkflowStatus(dependency) === WORKFLOW_STATUS.COMPLETED).length;

  if (workflowStatus === WORKFLOW_STATUS.READY && dependencies.length > 0) {
    return {
      label: 'Released',
      detail: 'Upstream dependencies are complete, so this branch has been released into runnable execution.',
      tone: 'teal',
    };
  }

  if (workflowStatus === WORKFLOW_STATUS.PLANNED && dependencies.length > 0) {
    return {
      label: 'Held on upstream',
      detail: completedDependencies > 0
        ? `${completedDependencies}/${dependencies.length} upstream branch${dependencies.length === 1 ? '' : 'es'} cleared; waiting on the remaining dependency chain.`
        : 'This branch is still waiting on upstream branches before it can be released.',
      tone: 'amber',
    };
  }

  if (workflowStatus === WORKFLOW_STATUS.WAITING_ON_HUMAN) {
    return {
      label: 'Held for approval',
      detail: 'This branch is paused at a human gate before execution can continue.',
      tone: 'amber',
    };
  }

  if (workflowStatus === WORKFLOW_STATUS.BLOCKED) {
    return {
      label: 'Blocked',
      detail: dependencies.length > 0
        ? 'An upstream dependency, approval gate, or guarded execution posture is still blocking this branch.'
        : 'Commander is treating this branch as blocked until the current runtime pressure clears.',
      tone: 'rose',
    };
  }

  if (workflowStatus === WORKFLOW_STATUS.RUNNING) {
    return {
      label: 'Running',
      detail: 'This branch is actively executing on its assigned lane.',
      tone: 'teal',
    };
  }

  if (workflowStatus === WORKFLOW_STATUS.COMPLETED) {
    return {
      label: 'Completed',
      detail: 'This branch has finished and can now release any downstream dependency chain.',
      tone: 'teal',
    };
  }

  return {
    label: getWorkflowMeta(workflowStatus).label,
    detail: 'This branch is following its current workflow posture without extra dependency pressure.',
    tone: getWorkflowMeta(workflowStatus).tone,
  };
}

export function getMissionGraphSummary(tasks = [], missionId = null) {
  const scopedTasks = tasks.filter((task) => {
    if (!missionId) return true;
    return task.rootMissionId === missionId || task.root_mission_id === missionId || task.id === missionId;
  });

  const branchTasks = scopedTasks.filter((task) => {
    const nodeType = task.nodeType || task.node_type || 'mission';
    return nodeType !== 'mission';
  });
  const effectiveTasks = branchTasks.length ? branchTasks : scopedTasks;

  if (!effectiveTasks.length) {
    return {
      available: false,
      progressPercent: 0,
      completedCount: 0,
      runningCount: 0,
      releasedCount: 0,
      heldCount: 0,
      blockedCount: 0,
      totalCount: 0,
      title: 'Mission graph is still forming',
      detail: 'Commander needs more graph state before mission progress can be derived from workflow.',
    };
  }

  const counts = effectiveTasks.reduce((acc, task) => {
    const status = inferWorkflowStatus(task);
    acc.total += 1;
    if (status === WORKFLOW_STATUS.COMPLETED) acc.completed += 1;
    if (status === WORKFLOW_STATUS.RUNNING) acc.running += 1;
    if (status === WORKFLOW_STATUS.READY) acc.released += 1;
    if ([WORKFLOW_STATUS.PLANNED, WORKFLOW_STATUS.WAITING_ON_HUMAN].includes(status)) acc.held += 1;
    if (status === WORKFLOW_STATUS.BLOCKED) acc.blocked += 1;
    return acc;
  }, {
    total: 0,
    completed: 0,
    running: 0,
    released: 0,
    held: 0,
    blocked: 0,
  });

  const weightedProgress = Math.round(((counts.completed * 1) + (counts.running * 0.55) + (counts.released * 0.25)) / Math.max(1, counts.total) * 100);
  const title = counts.blocked > 0
    ? `${counts.blocked} blocked branch${counts.blocked === 1 ? ' is' : 'es are'} slowing the graph`
    : counts.held > 0
      ? `${counts.held} branch${counts.held === 1 ? ' is' : 'es are'} still held upstream`
      : counts.running > 0
        ? 'Mission graph is actively moving'
        : counts.completed === counts.total
          ? 'Mission graph is complete'
          : 'Mission graph is ready to move';
  const detail = counts.blocked > 0
    ? `${counts.completed}/${counts.total} branches are complete, ${counts.running} are running, and ${counts.held} are still held while blocked work clears.`
    : counts.held > 0
      ? `${counts.completed}/${counts.total} branches are complete, ${counts.released} are released, and ${counts.held} are still waiting on dependencies or approval.`
      : counts.running > 0
        ? `${counts.completed}/${counts.total} branches are complete and ${counts.running} are actively executing.`
        : counts.completed === counts.total
          ? 'Every branch in the current mission graph has completed.'
          : `${counts.released} branches are ready to run next with no major holds visible.`;

  return {
    available: true,
    progressPercent: weightedProgress,
    completedCount: counts.completed,
    runningCount: counts.running,
    releasedCount: counts.released,
    heldCount: counts.held,
    blockedCount: counts.blocked,
    totalCount: counts.total,
    title,
    detail,
  };
}

function normalizeInterventionTimestamp(entry = {}) {
  const raw = entry.timestamp || entry.createdAt || entry.created_at || null;
  const value = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
}

function getInterventionReason(entry = {}) {
  return entry.metadata?.reason
    || entry.reason
    || entry.detail
    || entry.message
    || '';
}

export function getApprovalTransitionState(item = {}, interventions = []) {
  if (!item?.id) {
    return {
      available: false,
      kind: 'none',
      label: 'No approval transition',
      detail: 'Commander has not recorded an approval transition for this item yet.',
      tone: 'slate',
      nextMove: null,
    };
  }

  const itemId = item.id;
  const reviewId = item.reviewId || item.review_id || item.id;
  const isReview = item.outputType != null
    || item.reviewId != null
    || item.review_id != null
    || ['awaiting_approval', 'approved', 'revision_requested', 'needs_intervention'].includes(item.status);
  const related = (Array.isArray(interventions) ? interventions : [])
    .filter((entry) => {
      const entryTaskId = entry.taskId || entry.task_id || null;
      const entryReviewId = entry.metadata?.reviewId || entry.reviewId || entry.review_id || null;
      if (isReview) return entryReviewId === reviewId;
      return entryTaskId === itemId;
    })
    .sort((a, b) => normalizeInterventionTimestamp(b) - normalizeInterventionTimestamp(a));
  const latest = related[0] || null;
  const latestEventType = String(latest?.eventType || latest?.event_type || '').toLowerCase();
  const latestReason = getInterventionReason(latest);
  const approvalState = String(latest?.metadata?.approvalState || latest?.approvalState || '').toLowerCase();

  if (isReview) {
    if (latestEventType === 'review_approve' || item.status === 'approved' || approvalState === 'released') {
      return {
        available: true,
        kind: 'review_released',
        label: 'Review released',
        detail: latestReason || 'Review approval cleared this output for release.',
        tone: 'teal',
        nextMove: 'publish_review_output',
      };
    }
    if (latestEventType === 'review_reject' || item.status === 'revision_requested' || approvalState === 'rejected') {
      return {
        available: true,
        kind: 'review_rejected',
        label: 'Revision requested',
        detail: latestReason || 'Review rejection sent this output back for revision before release.',
        tone: 'amber',
        nextMove: 'revise_before_requeue',
      };
    }
    if (item.status === 'awaiting_approval' || item.status === 'needs_intervention') {
      return {
        available: true,
        kind: 'queued_review',
        label: 'Queued for review',
        detail: 'This output is waiting in the review queue before release can continue.',
        tone: 'amber',
        nextMove: 'clear_review_outputs_first',
      };
    }
  }

  if (latestEventType === 'approve' || approvalState === 'released') {
    return {
      available: true,
      kind: 'approval_released',
      label: 'Approval released',
      detail: latestReason || 'Human approval released this branch back into runnable execution.',
      tone: 'teal',
      nextMove: 'dispatch_ready_work',
    };
  }
  if (latestEventType === 'cancel' || approvalState === 'rejected') {
    return {
      available: true,
      kind: 'approval_rejected',
      label: 'Rejected and held',
      detail: latestReason || 'This branch was rejected at the approval gate and is being held out of execution.',
      tone: 'amber',
      nextMove: 'keep_high_risk_work_held',
    };
  }
  if (item.status === 'needs_approval' || item.requiresApproval || item.requires_approval) {
    return {
      available: true,
      kind: 'queued_mission_approval',
      label: 'Queued for approval',
      detail: 'This branch is waiting on a mission-level approval decision before execution can continue.',
      tone: 'amber',
      nextMove: 'release_low_risk_mission_gates',
    };
  }

  return {
    available: false,
    kind: 'none',
    label: 'No approval transition',
    detail: 'No explicit approval transition is active for this item.',
    tone: 'slate',
    nextMove: null,
  };
}

export function getTaskLiveControlState(task = {}, interventions = [], allTasks = []) {
  if (!task?.id) {
    return {
      available: false,
      kind: 'none',
      label: 'No control state',
      detail: 'Commander has not recorded a live control state for this branch yet.',
      tone: 'slate',
      nextMove: null,
      actionLabel: null,
      resolutionLabel: null,
      resolutionDetail: null,
      canAutoResume: false,
      shouldStayHeld: false,
    };
  }

  const rootMissionId = task.rootMissionId || task.root_mission_id || task.id;
  const transition = describeTaskTransition(task, allTasks);
  const related = (Array.isArray(interventions) ? interventions : [])
    .filter((entry) => {
      const taskId = entry.taskId || entry.task_id || null;
      const entryRootMissionId = entry.rootMissionId || entry.root_mission_id || null;
      return taskId === task.id || (!taskId && entryRootMissionId === rootMissionId);
    })
    .sort((a, b) => normalizeInterventionTimestamp(b) - normalizeInterventionTimestamp(a));
  const latest = related[0] || null;
  const latestEventType = String(latest?.eventType || latest?.event_type || '').toLowerCase();
  const latestReason = getInterventionReason(latest);
  const latestNextMove = latest?.metadata?.nextMove || latest?.nextMove || null;
  const triageVerdict = String(latest?.metadata?.triageVerdict || latest?.triageVerdict || '').toLowerCase();
  const approvalState = String(latest?.metadata?.approvalState || latest?.approvalState || '').toLowerCase();

  if (latestEventType === 'interrupt_redirect' || latestEventType === 'reroute') {
    return {
      available: true,
      kind: 'rerouted',
      label: latestEventType === 'interrupt_redirect' ? 'Interrupted and rerouted' : 'Rerouted',
      detail: latestReason || 'Commander moved this branch onto a different lane so execution can continue under a safer routing posture.',
      tone: 'blue',
      nextMove: latestNextMove || 'review_reroute',
      actionLabel: 'Stage reroute review',
      resolutionLabel: 'Keep the reroute active until the new lane proves out',
      resolutionDetail: 'Do not bounce this branch back yet. Let the redirected lane either stabilize cleanly or produce enough evidence for one more routing decision.',
      canAutoResume: true,
      shouldStayHeld: false,
    };
  }

  if (latestEventType === 'retry') {
    const guarded = triageVerdict === 'guarded_retry'
      || approvalState === 'waiting'
      || inferWorkflowStatus(task) === WORKFLOW_STATUS.WAITING_ON_HUMAN;
    return {
      available: true,
      kind: guarded ? 'guarded_retry' : 'retrying',
      label: guarded ? 'Guarded retry' : 'Retry in motion',
      detail: latestReason || (guarded
        ? 'Commander restarted this branch but held it behind review because the rescue trail is still noisy.'
        : 'Commander restarted this branch on a runnable lane after the latest recovery decision.'),
      tone: guarded ? 'amber' : 'teal',
      nextMove: latestNextMove || (guarded ? 'review_retry' : 'watch_retry'),
      actionLabel: guarded ? 'Stage retry review' : 'Stage retry monitor',
      resolutionLabel: guarded
        ? 'Keep this retry held until a human recovery decision lands'
        : 'Let the retry keep moving unless it drifts again',
      resolutionDetail: guarded
        ? 'Commander has enough rescue noise here that this branch should not self-resume into another blind rerun.'
        : 'The retry is already on a cleaner path, so the safest move is usually to monitor it rather than interrupt it again too early.',
      canAutoResume: !guarded,
      shouldStayHeld: guarded,
    };
  }

  if (latestEventType === 'stop' || latestEventType === 'cancel') {
    return {
      available: true,
      kind: latestEventType === 'cancel' || approvalState === 'rejected' ? 'approval_rejected' : 'held',
      label: latestEventType === 'cancel' || approvalState === 'rejected' ? 'Rejected and held' : 'Commander hold',
      detail: latestReason || (latestEventType === 'cancel' || approvalState === 'rejected'
        ? 'Human rejection kept this branch out of execution because the approval gate did not clear.'
        : 'Commander held this branch out of the active lane to stop unstable execution from compounding.'),
      tone: latestEventType === 'cancel' || approvalState === 'rejected' ? 'amber' : 'rose',
      nextMove: latestNextMove || (latestEventType === 'cancel' || approvalState === 'rejected' ? 'keep_high_risk_work_held' : 'review_hold'),
      actionLabel: latestEventType === 'cancel' || approvalState === 'rejected' ? 'Stage rejection review' : 'Stage hold review',
      resolutionLabel: latestEventType === 'cancel' || approvalState === 'rejected'
        ? 'Keep this branch held until the rejection pattern or risk posture changes'
        : 'Keep this branch held until Commander has a clearer recovery decision',
      resolutionDetail: latestEventType === 'cancel' || approvalState === 'rejected'
        ? 'Commander should not auto-resume a branch that just failed human approval unless the branch is reworked or rerouted first.'
        : 'This branch is not a safe auto-resume candidate right now. It needs an explicit release, reroute, or cancellation decision first.',
      canAutoResume: false,
      shouldStayHeld: true,
    };
  }

  if (latestEventType === 'dependency_release' || latestEventType === 'approve' || latestEventType === 'review_approve' || approvalState === 'released') {
    return {
      available: true,
      kind: latestEventType === 'approve' || approvalState === 'released' ? 'approval_released' : latestEventType === 'review_approve' ? 'review_released' : 'released',
      label: latestEventType === 'approve' || approvalState === 'released'
        ? 'Approval released'
        : latestEventType === 'review_approve'
          ? 'Review released'
          : 'Released to execute',
      detail: latestReason || (latestEventType === 'approve' || approvalState === 'released'
        ? 'A human approval gate cleared, so this branch is now back in runnable execution.'
        : latestEventType === 'review_approve'
          ? 'A review-room approval cleared a related output and Commander can keep the release lane moving.'
          : 'A dependency or approval gate cleared, so this branch is now back in runnable execution.'),
      tone: 'teal',
      nextMove: latestNextMove || 'keep_flowing',
      actionLabel: null,
      resolutionLabel: latestEventType === 'approve' || approvalState === 'released'
        ? 'Safe to resume automatically once the approved lane is clear'
        : 'Safe to resume automatically when the lane is clear',
      resolutionDetail: latestEventType === 'approve' || approvalState === 'released'
        ? 'Human approval already released this branch, so Commander should treat it as runnable work rather than a lingering gate.'
        : 'Commander has already cleared the relevant hold, so this branch should keep flowing without another manual release step.',
      canAutoResume: true,
      shouldStayHeld: false,
    };
  }

  if (latestEventType === 'dependency') {
    return {
      available: true,
      kind: 'dependency_update',
      label: 'Dependency path changed',
      detail: latestReason || 'Commander changed the dependency chain for this branch and is waiting for the new release path to settle.',
      tone: 'blue',
      nextMove: latestNextMove || 'watch_dependency_chain',
      actionLabel: 'Stage dependency review',
      resolutionLabel: 'Wait for the revised dependency path to settle before forcing a release',
      resolutionDetail: 'Commander changed the graph, so the safest next move is to let the new release path resolve instead of pushing this branch prematurely.',
      canAutoResume: false,
      shouldStayHeld: true,
    };
  }

  if (transition.label === 'Held for approval' || transition.label === 'Held on upstream' || transition.label === 'Blocked') {
    return {
      available: true,
      kind: transition.label === 'Held for approval' ? 'approval_hold' : transition.label === 'Held on upstream' ? 'upstream_hold' : 'blocked',
      label: transition.label,
      detail: transition.detail,
      tone: transition.tone,
      nextMove: transition.label === 'Held for approval'
        ? 'clear_approval_gate'
        : transition.label === 'Held on upstream'
          ? 'clear_release_chain'
          : 'clear_blocker',
      actionLabel: transition.label === 'Blocked' ? 'Stage blocker review' : 'Stage release review',
      resolutionLabel: transition.label === 'Held for approval'
        ? 'Keep this branch held until the approval gate is cleared'
        : transition.label === 'Held on upstream'
          ? 'Let upstream work release this branch instead of forcing it early'
          : 'Do not resume until the blocker is cleared or the branch is rerouted',
      resolutionDetail: transition.label === 'Held for approval'
        ? 'This branch is waiting on explicit human judgment, so auto-resume would weaken the active approval posture.'
        : transition.label === 'Held on upstream'
          ? 'This branch can safely resume as soon as the release chain clears, but not before.'
          : 'Commander is still reading active blocker pressure here, so a direct resume would likely just create another rescue event.',
      canAutoResume: transition.label === 'Held on upstream',
      shouldStayHeld: transition.label !== 'Held on upstream',
    };
  }

  return {
    available: true,
    kind: 'flowing',
    label: transition.label,
    detail: transition.detail,
    tone: transition.tone,
    nextMove: 'keep_flowing',
    actionLabel: null,
    resolutionLabel: 'Keep the branch moving',
    resolutionDetail: 'Commander is not seeing a reason to interrupt this branch right now.',
    canAutoResume: true,
    shouldStayHeld: false,
  };
}

export function buildTaskControlActionDraft(controlState = null, task = {}) {
  if (!controlState?.available || !controlState?.actionLabel || !task?.id) return null;

  const taskTitle = task.title || task.name || 'the selected branch';
  const promptByKind = {
    rerouted: `Create an operations specialist to review the reroute posture for ${taskTitle}. Objective: confirm the redirected lane is safer, decide whether to keep the reroute or adjust it again, and verify the branch can now complete without creating more rescue pressure.`,
    guarded_retry: `Create an operations specialist to review the guarded retry posture for ${taskTitle}. Objective: decide whether this branch should stay held for review, reroute before rerun, or be released into a safer retry path.`,
    retrying: `Create an operations specialist to monitor the retry path for ${taskTitle}. Objective: verify the retry is progressing cleanly, catch early signs of repeat failure, and recommend reroute or hold if the branch drifts again.`,
    held: `Create an operations specialist to review the current commander hold on ${taskTitle}. Objective: decide whether to keep the hold, release the branch, or reroute it into a safer lane before work resumes.`,
    approval_hold: `Create an operations specialist to clear the approval hold on ${taskTitle}. Objective: verify what still needs human judgment, reduce avoidable approval drag, and recommend the fastest safe release path.`,
    upstream_hold: `Create an operations specialist to clear the upstream release chain for ${taskTitle}. Objective: identify which upstream dependency is still holding this branch and recommend the fastest safe way to release it.`,
    blocked: `Create an operations specialist to unblock ${taskTitle}. Objective: identify whether this branch needs retry, reroute, approval, or dependency cleanup, then stage the safest recovery move.`,
    dependency_update: `Create an operations specialist to review the dependency change for ${taskTitle}. Objective: confirm the revised dependency path is sound and stage the next safe release move for the branch.`,
  };

  const quickstartPrompt = promptByKind[controlState.kind];
  if (!quickstartPrompt) return null;

  return {
    tab: 'create',
    quickstartPrompt,
    notice: `Commander staged a live control brief for ${taskTitle}: ${controlState.actionLabel}.`,
    controlActionBrief: {
      taskId: task.id,
      taskTitle,
      title: `${controlState.label} on ${taskTitle}`,
      actionLabel: controlState.actionLabel,
      currentState: controlState.label,
      expectedImprovement: controlState.kind === 'upstream_hold'
        ? 'The branch should stop waiting on the release chain and re-enter runnable execution with less manual chase.'
        : controlState.kind === 'approval_hold'
          ? 'Approval drag should drop because the remaining human gate becomes explicit and easier to clear.'
          : controlState.kind === 'rerouted' || controlState.kind === 'dependency_update'
            ? 'Execution should stabilize because the branch is being reviewed against the lane or dependency path it is actually using.'
            : 'Recovery pressure should fall because Commander will have a clearer decision on whether to retry, reroute, or keep the branch held.',
      verificationTarget: controlState.kind === 'upstream_hold'
        ? 'Verify that the next upstream completion or release decision moves this branch into queued or running posture.'
        : 'Verify that the branch stops bouncing between retry, reroute, and hold without a clean decision.',
      successCriteria: controlState.kind === 'released'
        ? 'The branch stays in flow and no new hold or rescue event lands immediately after release.'
        : 'The branch gets one clear next move and the next control event shows less confusion than the current state.',
      rollbackCriteria: 'Back this move out if it creates a new unstable lane, adds approval drag without reducing risk, or fails to change the control state on the next pass.',
      nextMove: controlState.nextMove || 'review_control_state',
    },
  };
}

export function getTaskExecutableControlAction({
  task = {},
  controlState = null,
  approvalTransition = null,
  redirectAgent = null,
} = {}) {
  if (!task?.id) {
    return {
      available: false,
      kind: null,
      label: null,
      detail: null,
      tone: 'slate',
    };
  }

  if (
    task.status === 'needs_approval'
    && (approvalTransition?.kind === 'queued_mission_approval' || controlState?.kind === 'approval_hold')
  ) {
    return {
      available: true,
      kind: 'release',
      label: 'Release branch',
      detail: 'Human approval is the active gate here, so the clean direct move is to release this branch back into runnable execution.',
      tone: 'teal',
    };
  }

  if (
    redirectAgent?.id
    && ['rerouted', 'guarded_retry', 'blocked', 'dependency_update'].includes(controlState?.kind)
  ) {
    return {
      available: true,
      kind: 'reroute',
      label: `Reroute to ${redirectAgent.name}`,
      detail: 'Commander has enough routing or recovery pressure here that a cleaner lane change is the safest direct move.',
      tone: 'blue',
    };
  }

  if (task.status === 'running' && ['held', 'approval_rejected'].includes(controlState?.kind)) {
    return {
      available: true,
      kind: 'hold',
      label: 'Hold branch',
      detail: 'This branch should come out of the active lane before more unstable execution compounds.',
      tone: 'rose',
    };
  }

  if (['failed', 'error', 'blocked'].includes(task.status) && controlState?.kind === 'retrying') {
    return {
      available: true,
      kind: 'retry',
      label: 'Retry branch',
      detail: 'The branch is already on a cleaner retry posture, so a direct rerun is still the safest next move.',
      tone: 'amber',
    };
  }

  return {
    available: false,
    kind: null,
    label: null,
    detail: null,
    tone: controlState?.tone || 'slate',
  };
}

export function getTaskControlActionMode({
  controlState = null,
  executableAction = null,
  controlActionDraft = null,
} = {}) {
  const hasDirectAction = Boolean(executableAction?.available);
  const hasStagedReview = Boolean(controlActionDraft);

  if (!hasDirectAction && !hasStagedReview) {
    return {
      available: false,
      directLabel: null,
      stageLabel: null,
      helperText: null,
    };
  }

  return {
    available: true,
    directLabel: hasDirectAction ? executableAction.label : null,
    stageLabel: hasStagedReview
      ? (hasDirectAction ? 'Stage review' : (controlState?.actionLabel || 'Stage control review'))
      : null,
    helperText: hasDirectAction && hasStagedReview
      ? 'Act now for the safest in-place move, or stage review for a more deliberate operator brief.'
      : hasDirectAction
        ? 'Commander has enough signal to execute this move directly.'
        : 'Commander recommends staging this move for a deliberate operator review.',
  };
}

export function getLiveControlNarrativeSummary(tasks = [], interventions = []) {
  const activeTasks = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => !isTerminalWorkflowStatus(inferWorkflowStatus(task)))
    .map((task) => ({
      task,
      controlState: getTaskLiveControlState(task, interventions, tasks),
    }))
    .filter((entry) => entry.controlState?.available && entry.controlState.kind !== 'flowing');

  if (!activeTasks.length) {
    return {
      available: false,
      title: 'Live control is calm',
      detail: 'No branch is currently carrying a strong hold, reroute, retry, or release narrative.',
      tone: 'teal',
      topBranch: null,
      topControlState: null,
      branches: [],
      nextMove: 'keep_flowing',
      actionLabel: null,
      controlActionDraft: null,
    };
  }

  const scoreByKind = {
    blocked: 100,
    approval_hold: 92,
    guarded_retry: 89,
    held: 84,
    upstream_hold: 78,
    dependency_update: 68,
    rerouted: 61,
    retrying: 56,
    released: 40,
  };

  const ranked = activeTasks
    .slice()
    .sort((a, b) => {
      const scoreA = scoreByKind[a.controlState.kind] || 0;
      const scoreB = scoreByKind[b.controlState.kind] || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return Number(b.task.priority || 0) - Number(a.task.priority || 0);
    });

  const top = ranked[0];
  const branches = ranked.slice(0, 3).map((entry) => ({
    id: entry.task.id,
    title: entry.task.title || entry.task.name || entry.task.id,
    stateLabel: entry.controlState.label,
    resolutionLabel: entry.controlState.resolutionLabel,
    canAutoResume: entry.controlState.canAutoResume,
  }));
  const title = `${top.controlState.label} is the main live control signal`;
  const detail = `${top.task.title || top.task.name || 'Top branch'} is currently ${top.controlState.label.toLowerCase()}. ${top.controlState.detail} Safest next move: ${top.controlState.resolutionLabel}.`;

  return {
    available: true,
    title,
    detail,
    tone: top.controlState.tone || 'amber',
    topBranch: top.task,
    topControlState: top.controlState,
    branches,
    nextMove: top.controlState.nextMove || 'review_control_state',
    actionLabel: top.controlState.actionLabel,
    controlActionDraft: buildTaskControlActionDraft(top.controlState, top.task),
  };
}

export function getTaskDecisionNarrative(task = {}, allTasks = [], interventions = []) {
  if (!task?.id) {
    return {
      available: false,
      title: 'No decision narrative',
      detail: 'Commander has not derived a decision narrative for this branch yet.',
      tone: 'slate',
      nextMove: null,
      stateLabel: null,
      transitionLabel: null,
      approvalLabel: null,
    };
  }

  const controlState = getTaskLiveControlState(task, interventions, allTasks);
  const transition = describeTaskTransition(task, allTasks);
  const approvalTransition = getApprovalTransitionState(task, interventions);
  const taskTitle = task.title || task.name || task.id;

  if (approvalTransition.available && ['approval_released', 'review_released'].includes(approvalTransition.kind)) {
    return {
      available: true,
      title: `${taskTitle} advanced through an approval release`,
      detail: `${approvalTransition.detail} ${controlState.resolutionLabel || 'Commander can keep this lane moving.'}`,
      tone: 'teal',
      nextMove: approvalTransition.nextMove || controlState.nextMove || 'keep_flowing',
      stateLabel: controlState.label,
      transitionLabel: transition.label,
      approvalLabel: approvalTransition.label,
    };
  }

  if (approvalTransition.available && ['approval_rejected', 'review_rejected'].includes(approvalTransition.kind)) {
    return {
      available: true,
      title: `${taskTitle} is being held after rejection`,
      detail: `${approvalTransition.detail} ${controlState.resolutionLabel || 'Commander should keep this branch held until the risk posture changes.'}`,
      tone: 'amber',
      nextMove: approvalTransition.nextMove || controlState.nextMove || 'keep_high_risk_work_held',
      stateLabel: controlState.label,
      transitionLabel: transition.label,
      approvalLabel: approvalTransition.label,
    };
  }

  if (approvalTransition.available && ['queued_review', 'queued_mission_approval'].includes(approvalTransition.kind)) {
    return {
      available: true,
      title: `${taskTitle} is waiting in the approval lane`,
      detail: `${approvalTransition.detail} ${controlState.resolutionLabel || 'Commander should clear the lightest approval work first.'}`,
      tone: 'amber',
      nextMove: approvalTransition.nextMove || controlState.nextMove || 'clear_approval_gate',
      stateLabel: controlState.label,
      transitionLabel: transition.label,
      approvalLabel: approvalTransition.label,
    };
  }

  if (controlState.available && ['rerouted', 'guarded_retry', 'retrying', 'dependency_update', 'blocked', 'upstream_hold', 'held'].includes(controlState.kind)) {
    return {
      available: true,
      title: `${taskTitle} is moving under active commander control`,
      detail: `${controlState.detail} ${controlState.resolutionLabel || transition.detail}`,
      tone: controlState.tone || 'amber',
      nextMove: controlState.nextMove || 'review_control_state',
      stateLabel: controlState.label,
      transitionLabel: transition.label,
      approvalLabel: approvalTransition.available ? approvalTransition.label : null,
    };
  }

  if (transition?.label) {
    return {
      available: true,
      title: `${taskTitle} is following the current execution path`,
      detail: transition.detail,
      tone: transition.tone || 'teal',
      nextMove: controlState.nextMove || 'keep_flowing',
      stateLabel: controlState.label,
      transitionLabel: transition.label,
      approvalLabel: approvalTransition.available ? approvalTransition.label : null,
    };
  }

  return {
    available: false,
    title: 'No decision narrative',
    detail: 'Commander does not have a strong branch-level decision narrative yet.',
    tone: 'slate',
    nextMove: null,
    stateLabel: null,
    transitionLabel: null,
    approvalLabel: null,
  };
}

export function getDecisionNarrativeSummary(tasks = [], interventions = []) {
  const activeTasks = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => !isTerminalWorkflowStatus(inferWorkflowStatus(task)))
    .map((task) => ({
      task,
      narrative: getTaskDecisionNarrative(task, tasks, interventions),
    }))
    .filter((entry) => entry.narrative.available);

  if (!activeTasks.length) {
    return {
      available: false,
      title: 'Decision narrative is quiet',
      detail: 'No branch currently has a strong enough control story to dominate the board.',
      tone: 'teal',
      topBranch: null,
      topNarrative: null,
      branches: [],
      nextMove: 'keep_flowing',
    };
  }

  const scoreByTone = { rose: 100, amber: 82, blue: 66, teal: 48, slate: 20 };
  const ranked = activeTasks
    .slice()
    .sort((a, b) => {
      const scoreA = scoreByTone[a.narrative.tone] || 0;
      const scoreB = scoreByTone[b.narrative.tone] || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return Number(b.task.priority || 0) - Number(a.task.priority || 0);
    });

  const top = ranked[0];
  return {
    available: true,
    title: top.narrative.title,
    detail: top.narrative.detail,
    tone: top.narrative.tone,
    topBranch: top.task,
    topNarrative: top.narrative,
    branches: ranked.slice(0, 3).map((entry) => ({
      id: entry.task.id,
      title: entry.task.title || entry.task.name || entry.task.id,
      narrativeTitle: entry.narrative.title,
      stateLabel: entry.narrative.stateLabel,
      transitionLabel: entry.narrative.transitionLabel,
      approvalLabel: entry.narrative.approvalLabel,
    })),
    nextMove: top.narrative.nextMove || 'keep_flowing',
  };
}
