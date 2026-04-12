import { buildConnectorActionDraft, buildDispatchActionDraft, getBranchConnectorPressureSummary, getGraphContractPressureSummary, getGroupedConnectorBlockers, getLaunchReadinessPressure, getMissionDispatchPressureSummary, getTaskGraphContractReadback } from './executionReadiness';
import { getMissionGraphSummary } from './missionLifecycle';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseCostRangeToMidpoint(value) {
  const text = String(value || '');
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  if (matches.length === 0) return 0;
  if (matches.length === 1) return matches[0];
  return (matches[0] + matches[1]) / 2;
}

export function inferAgentProvider(agent = {}) {
  const explicit = String(agent.provider || agent.providerOverride || '').trim();
  if (explicit) return explicit;
  const model = String(agent.model || agent.modelOverride || '').toLowerCase();
  if (model.includes('claude')) return 'Anthropic';
  if (model.includes('gpt')) return 'OpenAI';
  if (model.includes('gemini')) return 'Google';
  if (model.includes('ollama') || model.includes('local') || model.includes('qwen') || model.includes('gemma') || model.includes('llama') || model.includes('deepseek')) return 'Ollama';
  return 'Adaptive';
}

export function isTaskClosed(task = {}) {
  const status = String(task.status || '').toLowerCase();
  return ['completed', 'done'].includes(status) || task.workflowStatus === 'completed';
}

export function isTaskFailed(task = {}) {
  const status = String(task.status || '').toLowerCase();
  return ['failed', 'error', 'blocked', 'cancelled'].includes(status) || task.workflowStatus === 'failed';
}

export function scoreTaskOutcome(task = {}) {
  let score = 52;

  if (isTaskClosed(task)) score += 24;
  if (isTaskFailed(task)) score -= 30;
  if (task.routingReason) score += 6;
  if ((task.contextPackIds || []).length > 0) score += 4;
  if ((task.contextPackIds || []).length > 4) score -= 4;
  if ((task.requiredCapabilities || []).length > 0) score += 3;
  if (task.approvalLevel === 'human_required') score -= 6;
  if (task.executionStrategy === 'parallel') score += 4;
  if (task.budgetClass === 'premium' && Number(task.costUsd || 0) > 3) score -= 6;
  if (Number(task.costUsd || 0) <= 0.75) score += 5;
  if (Number(task.durationMs || 0) > 0 && Number(task.durationMs || 0) <= 12 * 60 * 1000) score += 4;
  if (Number(task.durationMs || 0) > 50 * 60 * 1000) score -= 4;

  const clamped = clamp(Math.round(score), 0, 100);
  return {
    score: clamped,
    label: clamped >= 85 ? 'Elite' : clamped >= 70 ? 'Strong' : clamped >= 55 ? 'Stable' : clamped >= 40 ? 'Fragile' : 'Critical',
    trust: clamped >= 80 ? 'high' : clamped >= 60 ? 'medium' : 'low',
  };
}

export function parseInterventionLogs(logs = []) {
  return logs
    .filter((entry) => {
      const message = String(entry.message || '');
      return (
        message.includes('[intervention-approve]')
        || message.includes('[intervention-retry]')
        || message.includes('[intervention-stop]')
        || message.includes('[intervention-cancel]')
        || message.includes('[branch-routing]')
        || message.includes('[branch-dependency]')
      );
    })
    .map((entry) => {
      const message = String(entry.message || '');
      let eventType = 'override';
      if (message.includes('[intervention-approve]')) eventType = 'approve';
      if (message.includes('[intervention-retry]')) eventType = 'retry';
      if (message.includes('[intervention-stop]')) eventType = 'stop';
      if (message.includes('[intervention-cancel]')) eventType = 'cancel';
      if (message.includes('[branch-routing]')) eventType = 'reroute';
      if (message.includes('[branch-dependency]')) eventType = 'dependency';

      return {
        ...entry,
        eventType,
        cleanMessage: message
          .replace('[intervention-approve] ', '')
          .replace('[intervention-retry] ', '')
          .replace('[intervention-stop] ', '')
          .replace('[intervention-cancel] ', '')
          .replace('[branch-routing] ', '')
          .replace('[branch-dependency] ', ''),
      };
    })
    .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime());
}

export function normalizeInterventionEvents(interventions = [], logs = []) {
  if (Array.isArray(interventions) && interventions.length > 0) {
    return interventions
      .map((entry) => ({
        ...entry,
        eventType: entry.eventType || 'override',
        cleanMessage: String(entry.message || ''),
        timestamp: entry.createdAt || entry.timestamp,
      }))
      .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime());
  }

  return parseInterventionLogs(logs);
}

export function getLatestBatchCommandAudit(logs = []) {
  const batchLog = [...logs]
    .filter((log) => String(log?.message || '').includes('[batch-intervention-]'))
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0];

  if (!batchLog) return null;

  const message = String(batchLog.message || '');
  const label = message
    .replace(/^\[batch-intervention-/, '')
    .replace(/\].*$/, '')
    .replaceAll('-', ' ')
    .trim();

  return {
    id: batchLog.id || `batch-${batchLog.timestamp || 'latest'}`,
    label: label || 'batch',
    message,
    timestamp: batchLog.timestamp || null,
    type: batchLog.type || 'SYS',
  };
}

function humanizeUnderscoreValue(value = '') {
  return String(value || '').replaceAll('_', ' ').trim();
}

function deriveControlCategory(entry = {}) {
  return entry.metadata?.controlCategory
    || (entry.eventType === 'approve' || entry.eventType === 'cancel' || entry.eventType === 'review_approve' || entry.eventType === 'review_reject'
      ? 'approval'
      : entry.eventType === 'retry' || entry.eventType === 'stop'
        ? 'recovery'
        : entry.eventType === 'interrupt_redirect' || entry.eventType === 'reroute' || entry.eventType === 'dependency'
          ? 'routing'
          : entry.eventType === 'tuning'
            ? 'automation'
            : 'intervention');
}

function humanizeEventType(value = '') {
  return humanizeUnderscoreValue(String(value || '').replaceAll('-', ' '));
}

function sortByTimestampDesc(left = {}, right = {}) {
  return new Date(right.timestamp || right.createdAt || 0).getTime() - new Date(left.timestamp || left.createdAt || 0).getTime();
}

export function normalizeApprovalAuditRows(rows = []) {
  return [...rows]
    .map((row) => ({
      id: row.id,
      reviewId: row.reviewId || row.review_id || null,
      decision: row.decision || 'approved',
      feedback: row.feedback || '',
      timestamp: row.createdAt || row.created_at || null,
    }))
    .sort(sortByTimestampDesc);
}

export function getHybridApprovalSummary({ tasks = [], reviews = [], interventions = [], approvalAudit = [] } = {}) {
  const normalizedInterventions = normalizeInterventionEvents(interventions, []);
  const normalizedAudit = normalizeApprovalAuditRows(approvalAudit);
  const missionApprovals = tasks.filter((task) => task.status === 'needs_approval' || task.requiresApproval);
  const reviewApprovals = Array.isArray(reviews) ? reviews : [];
  const recentApprovalEvents = normalizedInterventions.filter((entry) => deriveControlCategory(entry) === 'approval').slice(0, 8);
  const releasedCount = recentApprovalEvents.filter((entry) => entry.metadata?.approvalState === 'released' || ['approve', 'review_approve'].includes(entry.eventType)).length;
  const rejectedCount = recentApprovalEvents.filter((entry) => entry.metadata?.approvalState === 'rejected' || ['cancel', 'review_reject'].includes(entry.eventType)).length;
  const batchedCount = recentApprovalEvents.filter((entry) => entry.metadata?.isBatchAction).length;
  const latestDecision = normalizedAudit[0] || recentApprovalEvents[0] || null;
  const totalQueue = missionApprovals.length + reviewApprovals.length;
  const queuePosture = totalQueue > 0
    ? reviewApprovals.length >= missionApprovals.length
      ? 'queued_review'
      : 'queued_release'
    : rejectedCount > releasedCount && rejectedCount > 0
      ? 'holding_gate'
      : releasedCount > 0
        ? 'releasing_cleanly'
        : 'clear';
  const title = totalQueue > 0
    ? `${totalQueue} approval ${totalQueue === 1 ? 'decision is' : 'decisions are'} still open`
    : 'Hybrid approval is currently flowing cleanly';
  const detail = totalQueue > 0
    ? `${missionApprovals.length} mission branch${missionApprovals.length === 1 ? '' : 'es'} and ${reviewApprovals.length} review item${reviewApprovals.length === 1 ? '' : 's'} are still waiting on humans.`
    : releasedCount + rejectedCount > 0
      ? `${releasedCount} recent release${releasedCount === 1 ? '' : 's'} and ${rejectedCount} held/rejected decision${rejectedCount === 1 ? '' : 's'} are already captured in the control trail.`
      : 'No meaningful approval queue or recent approval churn is visible right now.';
  const resolutionLabel = queuePosture === 'queued_review'
    ? 'Clear the lowest-risk review outputs first and keep stricter branch gates held'
    : queuePosture === 'queued_release'
      ? 'Release the lightest mission approvals first and avoid widening the strict gate'
      : queuePosture === 'holding_gate'
        ? 'Keep risky work held until the rejection pattern stops repeating'
        : queuePosture === 'releasing_cleanly'
          ? 'Keep the release lane moving while approval drag stays contained'
          : 'Approval flow is stable enough to keep autonomy moving';
  const resolutionDetail = queuePosture === 'queued_review'
    ? 'Most of the queue is sitting in review posture, so the safest win is clearing easy review decisions before touching riskier branch approvals.'
    : queuePosture === 'queued_release'
      ? 'Mission branches are the main approval load, so Commander should release the lightest branches first and leave higher-risk work gated.'
      : queuePosture === 'holding_gate'
        ? 'Recent rejections or cancellations are telling Commander the gate is still protecting quality, so loosening it now would be premature.'
        : queuePosture === 'releasing_cleanly'
          ? 'Recent approval decisions are turning back into released work instead of more holds, so Commander can keep the approval lane moving without extra hardening.'
          : 'No strong approval drag or rejection pattern is visible right now.';
  const nextMove = queuePosture === 'queued_review'
    ? 'clear_review_outputs_first'
    : queuePosture === 'queued_release'
      ? 'release_low_risk_mission_gates'
      : queuePosture === 'holding_gate'
        ? 'keep_high_risk_work_held'
        : queuePosture === 'releasing_cleanly'
          ? 'keep_releasing_clean_work'
          : 'keep_flowing';
  const transitionLabel = queuePosture === 'queued_review'
    ? 'Review queue is the active approval transition'
    : queuePosture === 'queued_release'
      ? 'Mission-release queue is the active approval transition'
      : queuePosture === 'holding_gate'
        ? 'Recent rejection is still defining the gate'
        : queuePosture === 'releasing_cleanly'
          ? 'Recent approvals are releasing work cleanly'
          : 'Approval flow is stable';
  const transitionDetail = queuePosture === 'queued_review'
    ? 'Most of the open approval load is sitting in review posture, so Commander should clear low-risk review outputs before widening branch release.'
    : queuePosture === 'queued_release'
      ? 'Mission branches are the main approval queue, so the next release should come from the lightest branch gates instead of piling more review work first.'
      : queuePosture === 'holding_gate'
        ? 'The latest rejection or cancellation is still telling Commander to hold risky work out of the live lane until the risk posture changes.'
        : queuePosture === 'releasing_cleanly'
          ? 'Recent approvals are turning back into runnable work instead of more holds, which means the release path is behaving as intended.'
          : 'No single approval transition is dominating the system right now.';

  return {
    available: missionApprovals.length > 0 || reviewApprovals.length > 0 || recentApprovalEvents.length > 0 || normalizedAudit.length > 0,
    title,
    detail,
    totalQueue,
    missionApprovalCount: missionApprovals.length,
    reviewApprovalCount: reviewApprovals.length,
    releasedCount,
    rejectedCount,
    batchedCount,
    queuePosture,
    transitionLabel,
    transitionDetail,
    resolutionLabel,
    resolutionDetail,
    nextMove,
    latestDecision: latestDecision
      ? {
          label: latestDecision.decision ? humanizeUnderscoreValue(latestDecision.decision) : humanizeEventType(latestDecision.eventType),
          timestamp: latestDecision.timestamp || latestDecision.createdAt || null,
          detail: latestDecision.feedback || latestDecision.message || '',
        }
      : null,
    tone: totalQueue > 0 ? 'amber' : 'teal',
  };
}

export function getFailureTriageSummary({ tasks = [], interventions = [], logs = [], mission = null } = {}) {
  const normalizedInterventions = normalizeInterventionEvents(interventions, logs);
  const missionId = mission?.rootMissionId || mission?.id || null;
  const failedTasks = tasks
    .filter((task) => isTaskFailed(task))
    .filter((task) => !missionId || task.rootMissionId === missionId || task.id === missionId)
    .sort((left, right) => {
      const priorityDelta = Number(right.priority || 0) - Number(left.priority || 0);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(right.failedAt || right.updatedAt || 0).getTime() - new Date(left.failedAt || left.updatedAt || 0).getTime();
    });
  const topFailure = failedTasks[0] || null;
  const relatedEvents = normalizedInterventions
    .filter((entry) => deriveControlCategory(entry) === 'recovery' || ['interrupt_redirect', 'reroute'].includes(entry.eventType))
    .filter((entry) => {
      if (!topFailure) return !missionId || entry.rootMissionId === missionId || entry.taskId === missionId;
      return entry.rootMissionId === topFailure.rootMissionId || entry.taskId === topFailure.id;
    });
  const latestEvent = relatedEvents[0] || null;
  const graphContract = topFailure ? getTaskGraphContractReadback(topFailure, tasks, normalizedInterventions) : null;
  const fallbackVerdict = topFailure?.status === 'blocked' ? 'blocked_waiting' : topFailure ? 'needs_triage' : 'stable';
  const fallbackNextMove = topFailure?.status === 'blocked' ? 'clear_dependency_or_approval' : topFailure ? 'retry_or_reroute' : 'keep_flowing';
  let verdict = latestEvent?.metadata?.triageVerdict || fallbackVerdict;
  let nextMove = latestEvent?.metadata?.nextMove || fallbackNextMove;
  let recoveryMode = 'generic_recovery';
  let actionLabel = 'Run top triage order';
  let resolutionLabel = 'Choose the shortest safe recovery path';
  let resolutionDetail = 'Decide whether this branch should retry, reroute, or stay held before scaling adjacent work.';

  if (!latestEvent && topFailure && graphContract?.dispatchContract === 'release_on_upstream_completion') {
    verdict = 'release_chain_recovery';
    nextMove = 'clear_release_chain_before_retry';
    recoveryMode = 'clear_release_chain';
    actionLabel = 'Clear release chain first';
    resolutionLabel = 'Do not retry before upstream release clears';
    resolutionDetail = 'This branch is bound to the release chain, so another retry is lower value than clearing the upstream dependency that is still holding execution.';
  } else if (!latestEvent && topFailure && graphContract?.dispatchContract === 'serialized_mission_order') {
    verdict = 'guarded_lane_recovery';
    nextMove = 'hold_or_reroute_guarded_lane';
    recoveryMode = 'guarded_lane_recovery';
    actionLabel = 'Hold or reroute guarded lane';
    resolutionLabel = 'Keep this branch controlled until the guarded lane is safer';
    resolutionDetail = 'This branch is already on a guarded serialized path, so the safer move is to hold or reroute it instead of widening retry pressure immediately.';
  } else if (!latestEvent && topFailure && graphContract?.dispatchContract === 'safe_parallel_fanout') {
    verdict = 'safe_parallel_recovery';
    nextMove = 'reroute_or_retry_on_safe_parallel_lane';
    recoveryMode = 'safe_parallel_recovery';
    actionLabel = 'Reroute into safe parallel recovery';
    resolutionLabel = 'Use the safe-parallel lane for the next recovery move';
    resolutionDetail = 'This branch has room to recover on a cleaner parallel-safe lane, so Commander can favor reroute or retry there instead of forcing a tighter serialized hold.';
  } else if (String(verdict).includes('guarded')) {
    recoveryMode = 'guarded_lane_recovery';
    actionLabel = 'Review guarded retry';
    resolutionLabel = 'Keep this retry controlled until the rescue path is clearer';
    resolutionDetail = 'Recent rescue history is noisy enough that Commander should keep this branch under tighter review before another full rerun.';
  } else if (String(nextMove).includes('reroute')) {
    recoveryMode = 'reroute_recovery';
    actionLabel = 'Stage reroute recovery';
    resolutionLabel = 'Use reroute before repeating the same failure path';
    resolutionDetail = 'Commander is seeing enough branch pressure here that a lane change is safer than another blind retry.';
  }

  const title = topFailure
    ? recoveryMode === 'clear_release_chain'
      ? `${topFailure.title || topFailure.name || 'Top branch'} needs release-chain recovery first`
      : recoveryMode === 'guarded_lane_recovery'
        ? `${topFailure.title || topFailure.name || 'Top branch'} needs controlled guarded-lane recovery`
        : recoveryMode === 'safe_parallel_recovery'
          ? `${topFailure.title || topFailure.name || 'Top branch'} can recover on a safer parallel lane`
          : `${topFailure.title || topFailure.name || 'Top branch'} is the main recovery drag`
    : 'Failure pressure is currently contained';
  const detail = topFailure
    ? `${topFailure.status === 'cancelled' ? 'Cancelled' : humanizeUnderscoreValue(topFailure.status)} branch in ${humanizeUnderscoreValue(topFailure.domain)} is holding the line. ${latestEvent?.message || graphContract?.detail || 'No structured triage verdict has been recorded yet, so this branch still needs an explicit next move.'}`
    : 'No failed, blocked, or cancelled branch is currently dominating throughput.';

  return {
    available: Boolean(topFailure || latestEvent),
    title,
    detail,
    failedCount: failedTasks.length,
    topFailure,
    latestEvent,
    graphContract,
    recoveryMode,
    actionLabel,
    resolutionLabel,
    resolutionDetail,
    opsPrompt: topFailure
      ? `Stabilize ${topFailure.title || topFailure.name || 'the top failed branch'} using the current graph contract. ${detail} Safest next move: ${String(nextMove).replaceAll('_', ' ')}.`
      : null,
    verdict: humanizeUnderscoreValue(verdict),
    nextMove: humanizeUnderscoreValue(nextMove),
    tone: recoveryMode === 'clear_release_chain' ? 'amber' : topFailure ? 'rose' : 'teal',
  };
}

export function buildFailureTriageActionDraft(failureTriage = null) {
  if (!failureTriage?.available || !failureTriage?.opsPrompt) return null;

  return {
    tab: 'create',
    quickstartPrompt: failureTriage.opsPrompt,
    notice: `Commander staged the graph-aware recovery move: ${failureTriage.actionLabel || 'Run top triage order'}.`,
    controlActionBrief: {
      title: failureTriage.title,
      actionLabel: failureTriage.actionLabel || 'Run top triage order',
      currentState: failureTriage.verdict,
      expectedImprovement: 'Recovery pressure should drop because Commander is following the graph-aware recovery path instead of retrying blindly.',
      verificationTarget: 'Verify that the next control event reduces rescue churn and moves the branch into a clearer release, reroute, or held posture.',
      successCriteria: 'The branch takes one cleaner recovery path and stops bouncing between blocked, retry, and hold.',
      rollbackCriteria: 'Back this recovery move out if it adds rescue noise, widens risk, or fails to change the branch control state on the next pass.',
      nextMove: failureTriage.nextMove,
      taskId: failureTriage.topFailure?.id || null,
      taskTitle: failureTriage.topFailure?.title || failureTriage.topFailure?.name || null,
    },
  };
}

export function getExecutionAuditReadback({ interventions = [], approvalAudit = [], logs = [], mission = null, limit = 6 } = {}) {
  const normalizedInterventions = normalizeInterventionEvents(interventions, logs);
  const normalizedAudit = normalizeApprovalAuditRows(approvalAudit);
  const missionId = mission?.rootMissionId || mission?.id || null;
  const interventionEntries = normalizedInterventions
    .filter((entry) => ['approve', 'cancel', 'retry', 'stop', 'interrupt_redirect', 'reroute', 'dependency', 'tuning', 'review_approve', 'review_reject'].includes(entry.eventType))
    .filter((entry) => {
      if (!missionId) return true;
      return entry.rootMissionId === missionId || entry.taskId === missionId;
    })
    .map((entry) => ({
      id: entry.id || `${entry.eventType}-${entry.timestamp || 'latest'}`,
      category: deriveControlCategory(entry),
      label: humanizeEventType(entry.eventType),
      detail: entry.message || '',
      timestamp: entry.timestamp || entry.createdAt || null,
      tone: entry.tone || (deriveControlCategory(entry) === 'approval' ? 'amber' : deriveControlCategory(entry) === 'recovery' ? 'rose' : 'blue'),
      nextMove: entry.metadata?.nextMove ? humanizeUnderscoreValue(entry.metadata.nextMove) : null,
      verdict: entry.metadata?.triageVerdict ? humanizeUnderscoreValue(entry.metadata.triageVerdict) : null,
    }));
  const approvalEntries = missionId
    ? []
    : normalizedAudit.map((entry) => ({
        id: entry.id || `approval-audit-${entry.reviewId || 'latest'}`,
        category: 'approval',
        label: `Review ${humanizeUnderscoreValue(entry.decision)}`,
        detail: entry.feedback || `Approval audit recorded for review ${entry.reviewId || 'unknown'}.`,
        timestamp: entry.timestamp || null,
        tone: entry.decision === 'approved' ? 'amber' : 'rose',
        nextMove: entry.decision === 'approved' ? 'publish review output' : 'revise output',
        verdict: entry.decision === 'approved' ? 'released' : 'revision requested',
      }));
  const batchAudit = !missionId ? getLatestBatchCommandAudit(logs) : null;
  const batchEntry = batchAudit
    ? [{
        id: batchAudit.id,
        category: 'batch',
        label: `Batch ${batchAudit.label}`,
        detail: batchAudit.message,
        timestamp: batchAudit.timestamp,
        tone: batchAudit.type === 'ERR' ? 'rose' : batchAudit.type === 'OK' ? 'amber' : 'blue',
        nextMove: 'review batch effect',
        verdict: 'batched',
      }]
    : [];

  const entries = [...interventionEntries, ...approvalEntries, ...batchEntry]
    .sort(sortByTimestampDesc)
    .slice(0, limit);

  return {
    available: entries.length > 0,
    entries,
    title: entries.length > 0 ? 'Execution control audit' : 'Execution control audit is still sparse',
    detail: entries.length > 0
      ? 'Approvals, recovery actions, routing interventions, and batch commands are now being read back as one control trail.'
      : 'Commander needs more control events before the unified audit trail can say something meaningful.',
  };
}

export function getMissionCreateBrief(interventions = [], mission = null) {
  const normalized = normalizeInterventionEvents(interventions, []);
  const missionId = mission?.rootMissionId || mission?.id || null;
  const matching = normalized
    .filter((entry) => entry.eventType === 'mission_create')
    .filter((entry) => {
      if (!missionId) return true;
      return entry.rootMissionId === missionId || entry.taskId === missionId;
    })
    .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime());

  const latest = matching[0];
  if (!latest) return null;

  const metadata = latest.metadata || {};
  const objective = metadata.objective || mission?.description || mission?.title || 'Mission objective';
  const domain = metadata.domain || mission?.domain || 'general';
  const intentType = metadata.intentType || mission?.intentType || 'general';
  const riskLevel = metadata.riskLevel || mission?.riskLevel || 'medium';
  const approvalPosture = metadata.approvalPosture || mission?.approvalLevel || 'risk_weighted';
  const costPosture = metadata.costPosture || mission?.budgetClass || 'balanced';
  const branchCount = Number(metadata.branchCount || 0) || 1;
  const strategy = metadata.strategy || mission?.executionStrategy || 'sequential';
  const dependencyPosture = metadata.dependencyPosture || 'launch_ready';
  const verificationRequirement = metadata.verificationRequirement || 'lightweight';
  const specialistRoles = Array.isArray(metadata.specialistRoles) ? metadata.specialistRoles.filter(Boolean) : [];
  const constraints = Array.isArray(metadata.constraints) ? metadata.constraints.filter(Boolean) : [];

  return {
    id: latest.id || `mission-create-${missionId || 'latest'}`,
    objective,
    successDefinition: metadata.successDefinition || null,
    domain,
    intentType,
    riskLevel,
    approvalPosture,
    costPosture,
    branchCount,
    strategy,
    dependencyPosture,
    verificationRequirement,
    specialistRoles,
    constraints,
    timestamp: latest.timestamp || null,
    title: `${humanizeUnderscoreValue(domain)} / ${humanizeUnderscoreValue(intentType)} launch brief`,
    detail: `${humanizeUnderscoreValue(riskLevel)} risk • ${humanizeUnderscoreValue(approvalPosture)} approval • ${humanizeUnderscoreValue(costPosture)} cost posture`,
  };
}

export function getBatchCommandSignals(logs = []) {
  const batchLogs = [...logs]
    .filter((entry) => String(entry?.message || '').includes('[batch-intervention-]'))
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

  const actionCounts = {};
  let totalActions = 0;
  let totalBranches = 0;

  batchLogs.forEach((entry) => {
    const message = String(entry.message || '');
    const actionMatch = message.match(/^\[batch-intervention-([a-z-]+)\]/i);
    const countMatch = message.match(/\]\s+(\d+)\s+branch/i);
    const action = String(actionMatch?.[1] || 'batch').toLowerCase();
    const branchCount = Number(countMatch?.[1] || 0);

    actionCounts[action] = (actionCounts[action] || 0) + 1;
    totalActions += 1;
    totalBranches += branchCount;
  });

  const latest = batchLogs[0] || null;
  const latestAction = latest
    ? String(latest.message || '').match(/^\[batch-intervention-([a-z-]+)\]/i)?.[1] || 'batch'
    : null;
  const safeApproveRate = totalActions > 0
    ? Math.round(((actionCounts.approve || 0) / totalActions) * 100)
    : 0;

  return {
    totalActions,
    totalBranches,
    actionCounts,
    latestAction,
    latestAudit: latest ? getLatestBatchCommandAudit([latest]) : null,
    safeApproveRate,
    rescuePressure: Number(actionCounts.retry || 0) + Number(actionCounts.stop || 0),
    redirectPressure: Number(actionCounts.redirect || 0),
  };
}

export function getBatchRoutingTrustSummary({ logs = [], doctrineItem = null } = {}) {
  const batchSignals = getBatchCommandSignals(logs);
  const approveCount = Number(batchSignals.actionCounts.approve || 0);
  const rescueCount = Number(batchSignals.actionCounts.retry || 0)
    + Number(batchSignals.actionCounts.redirect || 0)
    + Number(batchSignals.actionCounts.stop || 0);

  if (!batchSignals.totalActions && !doctrineItem) {
    return {
      available: false,
      tone: 'slate',
      title: 'Batch routing trust still forming',
      detail: 'Commander needs grouped bridge history before it should move provider and lane defaults from clustered intervention behavior.',
    };
  }

  if (approveCount > rescueCount) {
    return {
      available: true,
      tone: 'teal',
      title: 'Grouped approvals are promoting lighter lane trust',
      detail: doctrineItem?.detail || `${approveCount} grouped approvals are landing more cleanly than grouped rescues, so Commander can promote lighter provider and lane defaults faster on similar low-risk work.`,
    };
  }

  if (rescueCount > approveCount) {
    return {
      available: true,
      tone: 'amber',
      title: 'Grouped rescues are demoting brittle lane defaults',
      detail: doctrineItem?.detail || `${rescueCount} grouped retries, redirects, or stops are clustering harder than grouped approvals, so Commander should demote brittle provider and lane defaults faster on similar work.`,
    };
  }

  return {
    available: true,
    tone: 'blue',
    title: 'Grouped routing trust is balanced',
    detail: doctrineItem?.detail || 'Grouped approvals and grouped rescues are balanced enough that Commander should keep lane-default changes measured until a clearer signal forms.',
  };
}

export function getRecurringBriefFitSummary(tasks = [], interventions = [], outcomes = []) {
  const candidates = (
    Array.isArray(tasks)
      && tasks.length > 0
      && (tasks[0]?.automationScore !== undefined || tasks[0]?.launchBriefFit !== undefined)
  )
    ? tasks.filter((candidate) => candidate?.launchBrief)
    : getAutomationCandidates(tasks, 150, interventions, outcomes).filter((candidate) => candidate.launchBrief);
  if (!candidates.length) {
    return {
      available: false,
      underVerifiedCount: 0,
      driftingCount: 0,
      holdingCount: 0,
      topCandidate: null,
      title: 'Recurring brief-fit signal still forming',
      detail: 'Commander needs more recurring launch-brief history before it should change recommendation rank or bottleneck priority from recurring brief fit.',
    };
  }

  const underVerifiedCount = candidates.filter((candidate) => candidate.launchBriefFit === 'drifting').length;
  const driftingCount = candidates.filter((candidate) => candidate.launchBriefFit === 'drifting').length;
  const watchCount = candidates.filter((candidate) => candidate.launchBriefFit === 'watch').length;
  const holdingCount = candidates.filter((candidate) => candidate.launchBriefFit === 'holding').length;
  const topCandidate = candidates.sort((left, right) => {
    const leftPenalty = left.launchBriefFit === 'drifting' ? 3 : left.launchBriefFit === 'watch' ? 2 : 1;
    const rightPenalty = right.launchBriefFit === 'drifting' ? 3 : right.launchBriefFit === 'watch' ? 2 : 1;
    if (rightPenalty !== leftPenalty) return rightPenalty - leftPenalty;
    return (right.automationScore || 0) - (left.automationScore || 0);
  })[0] || null;

  return {
    available: true,
    underVerifiedCount,
    driftingCount,
    watchCount,
    holdingCount,
    topCandidate,
    title: driftingCount > 0
      ? 'Recurring launch briefs are drifting from runtime quality'
      : watchCount > 0
        ? 'Recurring launch briefs still need tighter verification'
        : 'Recurring launch briefs are holding cleanly',
    detail: driftingCount > 0
      ? `${driftingCount} recurring flow${driftingCount === 1 ? '' : 's'} are drifting from their saved objective or verification bar, so Commander should elevate them in recommendations and bottleneck pressure.`
      : watchCount > 0
        ? `${watchCount} recurring flow${watchCount === 1 ? '' : 's'} are still earning trust against the saved launch brief, so Commander should keep them visible in managed review posture.`
        : `${holdingCount} recurring flow${holdingCount === 1 ? '' : 's'} are holding against the saved launch brief, so Commander can treat them as safer places to scale automation.`,
  };
}

export function getRecurringBriefFitReadback(tasks = [], interventions = [], outcomes = []) {
  const summary = getRecurringBriefFitSummary(tasks, interventions, outcomes);
  if (!summary.available) {
    return {
      available: false,
      title: 'Recurring brief-fit signal still forming',
      detail: summary.detail,
      tone: 'blue',
    };
  }

  if (summary.driftingCount > 0) {
    return {
      available: true,
      title: `${summary.driftingCount} recurring flow${summary.driftingCount === 1 ? '' : 's'} are drifting from the saved brief`,
      detail: summary.detail,
      tone: 'amber',
    };
  }

  if (summary.watchCount > 0) {
    return {
      available: true,
      title: `${summary.watchCount} recurring flow${summary.watchCount === 1 ? '' : 's'} are still earning trust`,
      detail: summary.detail,
      tone: 'blue',
    };
  }

  return {
    available: true,
    title: `${summary.holdingCount} recurring flow${summary.holdingCount === 1 ? '' : 's'} are holding against the saved brief`,
    detail: summary.detail,
    tone: 'teal',
  };
}

export function getRecurringBriefFitAction(tasks = [], interventions = [], outcomes = []) {
  const summary = getRecurringBriefFitSummary(tasks, interventions, outcomes);
  const topCandidate = summary.topCandidate;
  const adaptiveControl = getRecurringAdaptiveControlSummary(tasks, interventions, outcomes);
  const trustSummary = getRecurringAutonomyTuningSummary(topCandidate);
  const candidateTitle = topCandidate?.title || 'the recurring flow';
  const objective = topCandidate?.launchBrief?.objective || 'the saved recurring objective';
  const verification = humanizeUnderscoreValue(topCandidate?.launchBrief?.verificationRequirement || 'current verification posture');
  const currentPosture = topCandidate ? {
    cadence: topCandidate.currentRecurrenceRule?.frequency || 'weekly',
    approvalPosture: topCandidate.currentApprovalPosture || 'risk_weighted',
    missionMode: topCandidate.currentMissionMode || 'watch_and_approve',
    paused: Boolean(topCandidate.currentPaused),
  } : null;
  if (!summary.available) {
    return {
      available: false,
      title: 'Recurring action signal still forming',
      detail: summary.detail,
      actionLabel: 'Keep current watch posture',
      opsPrompt: '',
      expectedImprovement: '',
      verificationTarget: '',
      successCriteria: '',
      rollbackCriteria: '',
      taskId: null,
      currentPosture,
      proposedPosture: null,
      tone: 'blue',
    };
  }

  if (adaptiveControl.available && adaptiveControl.tone === 'amber') {
    return {
      available: true,
      title: 'Harden recurring defaults until payback improves',
      detail: adaptiveControl.detail,
      actionLabel: adaptiveControl.actionLabel,
      opsPrompt: `Create an operations specialist to stabilize recurring automation for ${candidateTitle}. Objective: ${objective}. Harden approval, keep cadence slow, and verify against the saved ${verification} requirement until the recurring posture pays back cleanly again.`,
      expectedImprovement: 'Recurring quality should stabilize and rescue pressure should fall as Commander hardens default posture on similar recurring launches.',
      verificationTarget: `Verify that the saved ${verification} requirement holds through another clean recurring cycle before recurring defaults are relaxed again.`,
      successCriteria: 'The recurring flow stops underperforming after the saved posture change and starts holding against the saved brief without fresh rescues.',
      rollbackCriteria: 'Back this hardened default out only after recurring payback turns cleanly positive and the saved verification bar holds for another cycle.',
      taskId: topCandidate?.latestTaskId || null,
      currentPosture,
      proposedPosture: {
        cadence: adaptiveControl.recommendedFrequency,
        approvalPosture: adaptiveControl.recommendedApprovalPosture,
        missionMode: adaptiveControl.recommendedMissionMode,
        paused: adaptiveControl.recommendedPaused,
      },
      tone: 'amber',
    };
  }

  if (summary.driftingCount > 0) {
    return {
      available: true,
      title: 'Tighten approval and slow recurring cadence',
      detail: `${summary.driftingCount} recurring flow${summary.driftingCount === 1 ? '' : 's'} are drifting from the saved objective or verification bar, so Commander should harden approval posture and slow cadence until quality matches the brief again.`,
      actionLabel: 'Tighten approval and slow cadence',
      opsPrompt: `Create an operations specialist to stabilize recurring automation for ${candidateTitle}. Objective: ${objective}. Tighten approval posture, slow cadence, and verify against the saved ${verification} requirement before autonomy is relaxed again.`,
      expectedImprovement: 'Recurring quality should stabilize and rescue pressure should fall as approval and cadence become more conservative.',
      verificationTarget: `Verify that the saved ${verification} requirement is being met consistently across the next clean recurring cycle.`,
      successCriteria: 'The recurring flow holds the saved objective cleanly, avoids fresh guardrail trips, and stops drifting from the brief.',
      rollbackCriteria: 'Back this change out if rescue pressure still rises, quality keeps slipping, or the tighter posture creates no trust recovery after another cycle.',
      taskId: topCandidate?.latestTaskId || null,
      currentPosture,
      proposedPosture: {
        cadence: trustSummary.recommendedFrequency,
        approvalPosture: trustSummary.recommendedApprovalPosture,
        missionMode: trustSummary.recommendedMissionMode,
        paused: trustSummary.recommendedPaused,
      },
      tone: 'amber',
    };
  }

  if (summary.watchCount > 0) {
    return {
      available: true,
      title: 'Keep watch posture on the recurring risers',
      detail: `${summary.watchCount} recurring flow${summary.watchCount === 1 ? '' : 's'} are still earning trust against the saved brief, so Commander should hold watch-and-verify posture instead of relaxing controls too early.`,
      actionLabel: 'Keep watch posture',
      opsPrompt: `Create an operations specialist to monitor recurring automation for ${candidateTitle}. Objective: ${objective}. Keep watch posture, confirm the saved ${verification} bar is holding, and only recommend lighter autonomy after another clean cycle.`,
      expectedImprovement: 'Trust should continue to rise without widening authority too early, keeping the recurring flow stable while it earns autonomy back.',
      verificationTarget: `Verify that the saved ${verification} bar holds through another clean cycle before recommending lighter approval or cadence.`,
      successCriteria: 'The recurring flow completes another cycle cleanly, maintains quality, and shows trust recovery without fresh rescue pressure.',
      rollbackCriteria: 'Back this watch posture out only if quality or rescue pressure worsens enough to justify stricter cadence or approval instead.',
      taskId: topCandidate?.latestTaskId || null,
      currentPosture,
      proposedPosture: {
        cadence: trustSummary.recommendedFrequency,
        approvalPosture: trustSummary.recommendedApprovalPosture,
        missionMode: trustSummary.recommendedMissionMode,
        paused: trustSummary.recommendedPaused,
      },
      tone: 'blue',
    };
  }

  if (adaptiveControl.available && adaptiveControl.tone === 'teal') {
    return {
      available: true,
      title: 'Promote winning recurring defaults',
      detail: adaptiveControl.detail,
      actionLabel: adaptiveControl.actionLabel,
      opsPrompt: `Create an operations specialist to scale recurring automation for ${candidateTitle}. Objective: ${objective}. Let the winning saved cadence and approval posture promote stronger recurring defaults while keeping the saved ${verification} bar intact.`,
      expectedImprovement: 'Similar recurring launches should start with a cleaner default posture, reducing verification drag while keeping quality high.',
      verificationTarget: `Verify that the saved ${verification} requirement keeps holding after similar recurring launches inherit the lighter default posture.`,
      successCriteria: 'Matching recurring flows launch with lighter supervision, hold quality, and avoid new rescue or guardrail pressure.',
      rollbackCriteria: 'Back this promoted default out if lighter recurring launches start to slip, trigger fresh rescues, or fail the saved verification bar.',
      taskId: topCandidate?.latestTaskId || null,
      currentPosture,
      proposedPosture: {
        cadence: adaptiveControl.recommendedFrequency,
        approvalPosture: adaptiveControl.recommendedApprovalPosture,
        missionMode: adaptiveControl.recommendedMissionMode,
        paused: adaptiveControl.recommendedPaused,
      },
      tone: 'teal',
    };
  }

  return {
    available: true,
    title: 'Scale autonomy on the clean recurring holders',
    detail: `${summary.holdingCount} recurring flow${summary.holdingCount === 1 ? '' : 's'} are holding cleanly against the saved brief, so Commander can scale autonomy on those systems with lower verification drag.`,
    actionLabel: 'Scale autonomy',
    opsPrompt: `Create an operations specialist to scale recurring automation for ${candidateTitle}. Objective: ${objective}. The saved ${verification} bar is holding, so recommend lighter approval drag, safer autonomy expansion, and the next scaling move for this recurring system.`,
    expectedImprovement: 'Automation throughput should rise while verification drag falls because this recurring system is already holding against the saved brief.',
    verificationTarget: `Verify that the saved ${verification} requirement keeps holding after autonomy is lightened on the next recurring pass.`,
    successCriteria: 'The recurring flow keeps quality high, stays within trust guardrails, and scales without triggering new rescue or approval drag.',
    rollbackCriteria: 'Back the autonomy expansion out if lighter supervision causes fresh guardrails, quality drift, or a new spike in rescue pressure.',
    taskId: topCandidate?.latestTaskId || null,
    currentPosture,
    proposedPosture: {
      cadence: trustSummary.recommendedFrequency,
      approvalPosture: trustSummary.recommendedApprovalPosture,
      missionMode: trustSummary.recommendedMissionMode,
      paused: trustSummary.recommendedPaused,
    },
    tone: 'teal',
  };
}

export function getRecurringChangeReadback(candidate = null) {
  if (!candidate) {
    return {
      available: false,
      tone: 'blue',
      title: 'Recurring change history still forming',
      detail: 'Commander needs persisted recurring tuning events before it can confirm saved posture changes across surfaces.',
      latest: null,
      history: [],
    };
  }

  const latestTuning = candidate.latestTuningEvent || null;
  const latestGuardrail = candidate.latestGuardrailEvent || null;
  const history = Array.isArray(candidate.recurringChangeHistory) ? candidate.recurringChangeHistory : [];

  if (!latestTuning && !latestGuardrail) {
    return {
      available: false,
      tone: 'blue',
      title: 'Recurring change history still forming',
      detail: 'No saved recurring tuning or guardrail event has landed on this flow yet.',
      latest: null,
      history,
    };
  }

  const latest = latestTuning || latestGuardrail;
  const tone = latest?.eventType === 'guardrail' ? 'amber' : 'teal';
  const title = latest?.eventType === 'guardrail'
    ? 'Recurring guardrails are still shaping saved posture'
    : 'Recurring posture change has been saved';
  const detail = latest?.summary
    || latest?.message
    || (latest?.eventType === 'guardrail'
      ? 'Commander applied a recurring guardrail to keep the automation within trust limits.'
      : 'Commander saved a recurring posture update for this flow.');

  return {
    available: true,
    tone,
    title,
    detail,
    latest,
    history,
  };
}

export function getRecurringChangePayback(candidate = null) {
  if (!candidate) {
    return {
      available: false,
      tone: 'blue',
      title: 'Recurring payback still forming',
      detail: 'Commander needs saved recurring posture changes plus enough follow-on outcomes before it can judge whether the change is paying off.',
      outcomeLabel: 'Forming',
      history: [],
    };
  }

  const history = Array.isArray(candidate.recurringChangeHistory) ? candidate.recurringChangeHistory : [];
  const latestTuning = candidate.latestTuningEvent || null;
  if (!latestTuning) {
    return {
      available: false,
      tone: 'blue',
      title: 'Recurring payback still forming',
      detail: 'No saved recurring posture change has landed on this flow yet.',
      outcomeLabel: 'Forming',
      history,
    };
  }

  const avgOutcome = Number(candidate.avgOutcome || 0);
  const rescueCount = Number(candidate.rescueCount || 0);
  const guardrailCount = Number(candidate.guardrailCount || 0);
  const tuningCount = Number(candidate.tuningCount || 0);
  const payingOff = avgOutcome >= 72 && rescueCount <= 1 && guardrailCount <= 1;
  const mixed = avgOutcome >= 58 && rescueCount <= 2;

  return {
    available: true,
    tone: payingOff ? 'teal' : mixed ? 'blue' : 'amber',
    title: payingOff
      ? 'Recurring posture change is paying off'
      : mixed
        ? 'Recurring posture change is still settling'
        : 'Recurring posture change is not paying back yet',
    detail: payingOff
      ? `Average recurring outcome is ${avgOutcome}, with ${rescueCount} rescue event${rescueCount === 1 ? '' : 's'} and ${guardrailCount} guardrail hold${guardrailCount === 1 ? '' : 's'} after the saved posture change.`
      : mixed
        ? `Average recurring outcome is ${avgOutcome}. Commander is seeing some stabilization, but ${rescueCount} rescue event${rescueCount === 1 ? '' : 's'} or ${guardrailCount} guardrail hold${guardrailCount === 1 ? '' : 's'} still mean the posture needs more proof.`
        : `Average recurring outcome is ${avgOutcome}, while ${rescueCount} rescue event${rescueCount === 1 ? '' : 's'} and ${guardrailCount} guardrail hold${guardrailCount === 1 ? '' : 's'} still suggest the saved posture change has not stabilized the flow yet.`,
    outcomeLabel: payingOff ? 'Paying off' : mixed ? 'Mixed' : 'Underperforming',
    history,
    metrics: [
      { label: 'Outcome', value: avgOutcome || 'n/a' },
      { label: 'Rescues', value: rescueCount },
      { label: 'Guardrails', value: guardrailCount },
      { label: 'Tunings', value: tuningCount },
    ],
  };
}

function extractRecurringPostureFromChange(entry = null) {
  if (!entry?.metadata) return null;
  return {
    cadence: entry.metadata.frequency || null,
    approvalPosture: entry.metadata.approvalPosture || null,
    missionMode: entry.metadata.missionMode || null,
    paused: entry.metadata.paused ?? null,
  };
}

export function getRecurringPostChangeVerdict(candidate = null) {
  const change = getRecurringChangeReadback(candidate);
  const payback = getRecurringChangePayback(candidate);
  if (!change.available || !payback.available) {
    return {
      available: false,
      tone: 'blue',
      title: 'Recurring verdict still forming',
      detail: 'Commander needs a saved recurring posture change plus enough follow-on outcomes before it can judge the result.',
      previousPosture: null,
      currentPosture: null,
      nextActionLabel: null,
    };
  }

  const tuningHistory = (change.history || []).filter((entry) => entry.eventType === 'tuning');
  const latestPosture = extractRecurringPostureFromChange(candidate?.latestTuningEvent) || {
    cadence: candidate?.currentRecurrenceRule?.frequency || null,
    approvalPosture: candidate?.currentApprovalPosture || null,
    missionMode: candidate?.currentMissionMode || null,
    paused: candidate?.currentPaused ?? null,
  };
  const previousPosture = extractRecurringPostureFromChange(tuningHistory[1]) || null;
  const title = payback.tone === 'teal'
    ? 'Latest recurring change is compounding'
    : payback.tone === 'amber'
      ? 'Latest recurring change needs another correction'
      : 'Latest recurring change is still settling';
  const detail = payback.tone === 'teal'
    ? `${payback.detail} Commander can start treating this saved posture as a stronger recurring default.`
    : payback.tone === 'amber'
      ? `${payback.detail} Commander should queue the next corrective move instead of assuming the saved posture is good enough.`
      : `${payback.detail} Commander should keep this in managed review posture until the next cycle separates more clearly.`;

  return {
    available: true,
    tone: payback.tone,
    title,
    detail,
    previousPosture,
    currentPosture: latestPosture,
    nextActionLabel: payback.tone === 'amber'
      ? 'Stage next correction'
      : payback.tone === 'blue'
        ? 'Keep watch posture'
        : 'Promote winning default',
  };
}

export function getRecurringNextCorrection(candidate = null) {
  const verdict = getRecurringPostChangeVerdict(candidate);
  const action = getRecurringBriefFitAction(candidate ? [candidate] : [], [], []);
  if (!verdict.available || !action.available) {
    return {
      available: false,
      tone: 'blue',
      title: 'Next recurring correction still forming',
      detail: 'Commander does not have a clean enough recurring verdict to recommend the next move yet.',
      action: null,
    };
  }

  if (verdict.tone === 'amber') {
    return {
      available: true,
      tone: 'amber',
      title: 'Stage the next recurring correction',
      detail: `${verdict.detail} Next move: ${action.actionLabel.toLowerCase()}.`,
      action,
    };
  }

  if (verdict.tone === 'blue') {
    return {
      available: true,
      tone: 'blue',
      title: 'Keep the recurring flow under managed review',
      detail: `${verdict.detail} Next move: ${action.actionLabel.toLowerCase()}.`,
      action,
    };
  }

  return {
    available: true,
    tone: 'teal',
    title: 'Recurring change is earning stronger defaults',
    detail: `${verdict.detail} Next move: ${action.actionLabel.toLowerCase()}.`,
    action,
  };
}

export function getRecurringAdaptiveControlSummary(tasks = [], interventions = [], outcomes = []) {
  const briefFit = getRecurringBriefFitSummary(tasks, interventions, outcomes);
  const candidate = briefFit.topCandidate || null;
  const payback = getRecurringChangePayback(candidate);
  const trustSummary = getRecurringAutonomyTuningSummary(candidate);

  if (!briefFit.available || !candidate) {
    return {
      available: false,
      tone: 'blue',
      title: 'Recurring adaptive control is still forming',
      detail: briefFit.detail || 'Commander needs stronger recurring evidence before it should promote or demote launch defaults automatically.',
      actionLabel: 'Keep recurring defaults conservative',
      recommendedMissionMode: 'watch_and_approve',
      recommendedApprovalPosture: 'risk_weighted',
      recommendedFrequency: 'weekly',
      recommendedPaused: false,
      candidate: null,
      payback,
      trustSummary,
    };
  }

  if (payback.available && payback.tone === 'amber') {
    return {
      available: true,
      tone: 'amber',
      title: 'Recurring defaults should harden until payback improves',
      detail: `${candidate.title} is still underperforming after the latest saved posture change, so Commander should default similar recurring launches into tighter approval and slower cadence until the brief holds cleanly again.`,
      actionLabel: 'Harden recurring defaults',
      recommendedMissionMode: 'watch_and_approve',
      recommendedApprovalPosture: 'human_required',
      recommendedFrequency: 'weekly',
      recommendedPaused: trustSummary.recommendedPaused,
      candidate,
      payback,
      trustSummary,
    };
  }

  if (payback.available && payback.tone === 'teal' && briefFit.holdingCount > 0) {
    return {
      available: true,
      tone: 'teal',
      title: 'Winning recurring posture should promote launch defaults',
      detail: `${candidate.title} is paying back cleanly against the saved launch brief, so Commander can let similar recurring launches inherit lighter approval drag and a stronger cadence by default.`,
      actionLabel: 'Promote winning recurring defaults',
      recommendedMissionMode: trustSummary.recommendedMissionMode || 'do_now',
      recommendedApprovalPosture: trustSummary.recommendedApprovalPosture || 'auto_low_risk',
      recommendedFrequency: trustSummary.recommendedFrequency || 'daily',
      recommendedPaused: false,
      candidate,
      payback,
      trustSummary,
    };
  }

  return {
    available: true,
    tone: 'blue',
    title: 'Recurring defaults should stay measured while the signal settles',
    detail: `${candidate.title} is directionally improving, but Commander should keep similar recurring launches in a managed posture until the next saved cycle separates cleanly.`,
    actionLabel: 'Keep recurring defaults measured',
    recommendedMissionMode: trustSummary.recommendedMissionMode || 'plan_first',
    recommendedApprovalPosture: trustSummary.recommendedApprovalPosture || 'risk_weighted',
    recommendedFrequency: trustSummary.recommendedFrequency || 'weekly',
    recommendedPaused: trustSummary.recommendedPaused,
    candidate,
    payback,
    trustSummary,
  };
}

export function getObservedModelBenchmarks(tasks = [], agents = [], logs = [], interventions = []) {
  const grouped = new Map();
  const interventionLogs = normalizeInterventionEvents(interventions, logs);

  tasks
    .filter((task) => task.routingReason)
    .forEach((task) => {
      const agent = agents.find((candidate) => candidate.id === task.agentId);
      const model = agent?.model || task.modelOverride || 'Adaptive lane';
      const provider = inferAgentProvider(agent || task);
      const key = `${provider}::${model}`;
      const quality = scoreTaskOutcome(task);
      const interventionCount = interventionLogs.filter((entry) => {
        const message = String(entry.message || '');
        return (
          (task.id && message.includes(task.id))
          || (task.taskId && message.includes(task.taskId))
          || (task.rootMissionId && message.includes(task.rootMissionId))
        );
      }).length;
      const current = grouped.get(key) || {
        key,
        model,
        provider,
        runs: 0,
        completedRuns: 0,
        totalCost: 0,
        totalDurationMs: 0,
        totalQuality: 0,
        totalInterventions: 0,
      };

      current.runs += 1;
      current.completedRuns += isTaskClosed(task) ? 1 : 0;
      current.totalCost += Number(task.costUsd || 0);
      current.totalDurationMs += Number(task.durationMs || 0);
      current.totalQuality += quality.score;
      current.totalInterventions += interventionCount;
      grouped.set(key, current);
    });

  return Array.from(grouped.values())
    .map((entry) => {
      const avgQuality = entry.runs ? entry.totalQuality / entry.runs : 0;
      const successRate = entry.runs ? (entry.completedRuns / entry.runs) * 100 : 0;
      const avgCost = entry.runs ? entry.totalCost / entry.runs : 0;
      const avgDurationMs = entry.runs ? entry.totalDurationMs / entry.runs : 0;
      const avgInterventions = entry.runs ? entry.totalInterventions / entry.runs : 0;
      const speedScore = avgDurationMs > 0 ? clamp(Math.round(100 - Math.min(80, avgDurationMs / 15000)), 20, 100) : 60;
      const costScore = avgCost > 0 ? clamp(Math.round(100 - Math.min(75, avgCost * 16)), 20, 100) : 95;
      const interventionPenalty = Math.min(18, Math.round(avgInterventions * 6));
      const benchmarkScore = Math.round(((avgQuality * 0.45) + (successRate * 0.3) + (speedScore * 0.15) + (costScore * 0.1)) - interventionPenalty);

      return {
        ...entry,
        avgQuality: Math.round(avgQuality),
        successRate: Math.round(successRate),
        avgCost,
        avgDurationMs,
        avgInterventions: Number(avgInterventions.toFixed(1)),
        interventionPenalty,
        speedScore,
        costScore,
        benchmarkScore,
      };
    })
    .sort((left, right) => {
      if (right.benchmarkScore !== left.benchmarkScore) return right.benchmarkScore - left.benchmarkScore;
      return right.runs - left.runs;
    });
}

export function parseAutomationGuardrailLogs(logs = []) {
  return logs
    .filter((entry) => String(entry.message || '').includes('[automation-guardrail]'))
    .map((entry) => ({
      ...entry,
      cleanMessage: String(entry.message || '').replace('[automation-guardrail] ', ''),
    }))
    .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime());
}

export function parseAutomationGuardrailEvents(interventions = [], logs = []) {
  const normalized = normalizeInterventionEvents(interventions, logs);
  return normalized
    .filter((entry) => entry.eventType === 'guardrail')
    .map((entry) => ({
      ...entry,
      cleanMessage: String(entry.cleanMessage || entry.message || ''),
    }))
    .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime());
}

export function buildPolicyDemotionSummary(policy, tasks = [], interventions = [], logs = []) {
  if (!policy) {
    return {
      score: 0,
      reasons: [],
      matchingRuns: 0,
      interventionCount: 0,
    };
  }

  const normalized = normalizeInterventionEvents(interventions, logs);
  const matchingTasks = tasks.filter((task) => {
    const domainMatch = (policy.taskDomain || 'general') === 'general' || task.domain === policy.taskDomain;
    const intentMatch = (policy.intentType || 'general') === 'general' || task.intentType === policy.intentType;
    return domainMatch && intentMatch;
  });
  const rootMissionIds = new Set(matchingTasks.map((task) => task.rootMissionId || task.id).filter(Boolean));
  const matchingInterventions = normalized.filter((entry) => {
    const domainMatch = (policy.taskDomain || 'general') === 'general' || entry.domain === policy.taskDomain;
    const intentMatch = (policy.intentType || 'general') === 'general' || entry.intentType === policy.intentType;
    const missionMatch = !rootMissionIds.size || rootMissionIds.has(entry.rootMissionId || entry.taskId);
    return domainMatch && intentMatch && missionMatch;
  });

  const counts = matchingInterventions.reduce((acc, entry) => {
    const key = entry.eventType || 'override';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const score = Number(counts.stop || 0) * 3
    + Number(counts.cancel || 0) * 3
    + Number(counts.reroute || 0) * 2
    + Number(counts.dependency || 0) * 1
    + Number(counts.retry || 0) * 1
    + Number(counts.guardrail || 0) * 2;

  const reasons = [
    counts.reroute ? `${counts.reroute} reroute${counts.reroute === 1 ? '' : 's'} pushed work off the preferred lane.` : null,
    counts.stop || counts.cancel ? `${Number(counts.stop || 0) + Number(counts.cancel || 0)} hard stop/cancel intervention${Number(counts.stop || 0) + Number(counts.cancel || 0) === 1 ? '' : 's'} needed human rescue.` : null,
    counts.retry ? `${counts.retry} retry intervention${counts.retry === 1 ? '' : 's'} signaled brittle execution under this doctrine.` : null,
    counts.guardrail ? `${counts.guardrail} recurring guardrail hold${counts.guardrail === 1 ? '' : 's'} slowed this lane before execution.` : null,
    matchingInterventions.length > 0 && matchingTasks.length > 0 ? `${(matchingInterventions.length / Math.max(matchingTasks.length, 1)).toFixed(1)} interventions per matching mission on average.` : null,
  ].filter(Boolean);

  const sortedTasks = matchingTasks
    .slice()
    .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime());
  const recentRuns = sortedTasks.slice(0, 5);
  const priorRuns = sortedTasks.slice(5, 10);
  const averageOutcome = (taskList) => taskList.length
    ? taskList.reduce((sum, task) => sum + scoreTaskOutcome(task).score, 0) / taskList.length
    : 0;
  const interventionRate = (taskList) => {
    if (!taskList.length) return 0;
    const missionIds = new Set(taskList.map((task) => task.rootMissionId || task.id).filter(Boolean));
    const count = matchingInterventions.filter((entry) => missionIds.has(entry.rootMissionId || entry.taskId)).length;
    return count / taskList.length;
  };
  const recentOutcome = averageOutcome(recentRuns);
  const priorOutcome = averageOutcome(priorRuns);
  const recentInterventionRate = interventionRate(recentRuns);
  const priorInterventionRate = interventionRate(priorRuns);
  const trendDelta = Math.round((recentOutcome - priorOutcome) - ((recentInterventionRate - priorInterventionRate) * 8));
  const trend = matchingTasks.length < 3
    ? 'forming'
    : trendDelta >= 6
      ? 'improving'
      : trendDelta <= -6 || score >= Math.max(4, Math.ceil(matchingTasks.length * 0.8))
        ? 'demoted'
        : 'flat';
  const confidence = matchingTasks.length >= 8 ? 'high' : matchingTasks.length >= 4 ? 'medium' : 'low';
  const pressureSources = [
    { key: 'stop', label: 'Stops', count: Number(counts.stop || 0), detail: 'Human operators had to stop execution outright.' },
    { key: 'cancel', label: 'Cancels', count: Number(counts.cancel || 0), detail: 'The lane produced work that needed to be canceled instead of completed.' },
    { key: 'reroute', label: 'Reroutes', count: Number(counts.reroute || 0), detail: 'Work was moved off the preferred lane to recover delivery.' },
    { key: 'guardrail', label: 'Guardrails', count: Number(counts.guardrail || 0), detail: 'Recurring automation safety rules held the lane before execution.' },
    { key: 'retry', label: 'Retries', count: Number(counts.retry || 0), detail: 'Commander needed to rerun work to get a usable outcome.' },
    { key: 'dependency', label: 'Dependency edits', count: Number(counts.dependency || 0), detail: 'Branch dependency surgery was needed to keep the mission graph viable.' },
  ].filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count);
  const completionRate = matchingTasks.length
    ? Math.round((matchingTasks.filter((task) => isTaskClosed(task)).length / matchingTasks.length) * 100)
    : 0;
  const averageCost = matchingTasks.length
    ? matchingTasks.reduce((sum, task) => sum + Number(task.costUsd || 0), 0) / matchingTasks.length
    : 0;
  const laneStrengths = [
    matchingTasks.length > 0 ? `${completionRate}% of matching runs are still closing successfully.` : null,
    recentOutcome > 0 ? `Recent outcome quality is averaging ${Math.round(recentOutcome)} across the latest ${recentRuns.length || 0} run${recentRuns.length === 1 ? '' : 's'}.` : null,
    averageCost > 0 ? `Average spend is holding near $${averageCost.toFixed(2)} per matching run.` : null,
  ].filter(Boolean);
  const laneRisks = [
    pressureSources[0] ? `${pressureSources[0].label} are currently the strongest demotion pressure.` : null,
    recentInterventionRate > 0 ? `${recentInterventionRate.toFixed(1)} intervention events per recent run are still landing on this lane.` : null,
    priorRuns.length > 0 && recentOutcome < priorOutcome ? `Recent quality has dropped ${Math.round(priorOutcome - recentOutcome)} points versus the prior window.` : null,
  ].filter(Boolean);
  const trendDetail = trend === 'improving'
    ? 'Recent outcome quality is rising and intervention pressure is easing.'
    : trend === 'demoted'
      ? 'Human rescue pressure is outweighing recent execution quality, so Commander should trust this lane less.'
      : trend === 'forming'
        ? 'Commander needs more run density before it can call this lane stable or weak.'
        : 'Recent quality and rescue pressure are roughly balanced, so the lane is holding but not separating.';

  return {
    score,
    reasons,
    matchingRuns: matchingTasks.length,
    interventionCount: matchingInterventions.length,
    counts,
    trend,
    trendDelta,
    trendDetail,
    confidence,
    recentOutcome: Math.round(recentOutcome),
    priorOutcome: Math.round(priorOutcome),
    recentInterventionRate: Number(recentInterventionRate.toFixed(1)),
    priorInterventionRate: Number(priorInterventionRate.toFixed(1)),
    pressureSources,
    laneStrengths,
    laneRisks,
  };
}

export function getPolicyDeltaReadback(policy, tasks = [], interventions = [], logs = []) {
  if (!policy) {
    return {
      title: 'Policy delta still forming',
      detail: 'Commander needs a live routing policy before it can explain provider, model, and approval movement.',
      tone: 'slate',
      providerDelta: 'Holding',
      modelDelta: 'Holding',
      approvalDelta: 'Holding',
    };
  }

  const demotion = buildPolicyDemotionSummary(policy, tasks, interventions, logs);
  const batchTrust = getBatchRoutingTrustSummary({ logs });
  const approvingBatchTrust = batchTrust.available && batchTrust.tone === 'teal';
  const demotingBatchTrust = batchTrust.available && batchTrust.tone === 'amber';

  const providerDelta = demotion.trend === 'demoted'
    ? `Demoting ${policy.preferredProvider || 'adaptive'}`
    : approvingBatchTrust
      ? `Promoting ${policy.preferredProvider || 'adaptive'}`
      : 'Holding provider';
  const modelDelta = demotion.trend === 'demoted'
    ? (policy.preferredModel ? `Loosening ${policy.preferredModel}` : 'Avoiding a hard model lock')
    : approvingBatchTrust
      ? (policy.preferredModel ? `Reinforcing ${policy.preferredModel}` : 'Keeping model adaptive')
      : 'Holding model';
  const approvalDelta = demotingBatchTrust || demotion.trend === 'demoted'
    ? (policy.approvalRule === 'auto_low_risk' ? 'Hardening approval' : 'Keeping approval gated')
    : approvingBatchTrust
      ? (policy.approvalRule === 'risk_weighted' ? 'Lightening approval' : 'Holding low-friction approval')
      : 'Holding approval';
  const tone = demotion.trend === 'demoted'
    ? 'amber'
    : approvingBatchTrust
      ? 'teal'
      : demotion.trend === 'improving'
        ? 'blue'
        : 'slate';
  const title = demotion.trend === 'demoted'
    ? `${policy.name} is losing trust`
    : approvingBatchTrust
      ? `${policy.name} is earning lane trust`
      : `${policy.name} is holding steady`;
  const detail = demotion.trend === 'demoted'
    ? `${policy.preferredProvider || 'Adaptive'} / ${policy.preferredModel || 'adaptive model'} is slipping because ${demotion.pressureSources[0]?.label?.toLowerCase() || 'rescue pressure'} is outweighing recent quality. ${batchTrust.available ? batchTrust.detail : ''}`.trim()
    : approvingBatchTrust
      ? `${policy.preferredProvider || 'Adaptive'} / ${policy.preferredModel || 'adaptive model'} is being reinforced by grouped approvals landing safely on similar work. ${demotion.trendDetail}`
      : `${policy.preferredProvider || 'Adaptive'} / ${policy.preferredModel || 'adaptive model'} is holding. ${demotion.trendDetail}`;

  return {
    title,
    detail,
    tone,
    providerDelta,
    modelDelta,
    approvalDelta,
    trend: demotion.trend,
    confidence: demotion.confidence,
  };
}

export function getPolicyActionGuidance(policy, tasks = [], interventions = [], logs = [], agents = []) {
  const delta = getPolicyDeltaReadback(policy, tasks, interventions, logs);
  const demotion = buildPolicyDemotionSummary(policy, tasks, interventions, logs);
  const batchTrust = getBatchRoutingTrustSummary({ logs });
  const benchmarks = getObservedModelBenchmarks(tasks, agents, logs, interventions);
  const evidence = [];

  if (demotion.matchingRuns > 0) {
    evidence.push(`${demotion.matchingRuns} matching run${demotion.matchingRuns === 1 ? '' : 's'} in memory`);
  }
  if (demotion.recentOutcome != null) {
    evidence.push(`recent quality ${demotion.recentOutcome}`);
  }
  if (demotion.recentInterventionRate != null) {
    evidence.push(`rescue rate ${demotion.recentInterventionRate}%`);
  }
  if (batchTrust.available) {
    evidence.push(batchTrust.title);
  }

  const relevantBenchmarks = benchmarks.filter((entry) => {
    if (!policy) return false;
    return tasks.some((task) => {
      const domainMatch = (policy.taskDomain || 'general') === 'general' || task.domain === policy.taskDomain;
      const intentMatch = (policy.intentType || 'general') === 'general' || task.intentType === policy.intentType;
      const taskModel = task.modelOverride || agents.find((candidate) => candidate.id === task.agentId)?.model;
      const taskProvider = inferAgentProvider(agents.find((candidate) => candidate.id === task.agentId) || task);
      return domainMatch && intentMatch && taskModel === entry.model && taskProvider === entry.provider;
    });
  });
  const benchmarkPool = relevantBenchmarks.length ? relevantBenchmarks : benchmarks;
  const currentLane = benchmarkPool.find((entry) => (
    entry.provider === (policy?.preferredProvider || 'Adaptive')
    && entry.model === (policy?.preferredModel || 'Adaptive lane')
  )) || null;
  const strongerCandidate = benchmarkPool.find((entry) => (
    entry.provider !== (policy?.preferredProvider || '')
    || entry.model !== (policy?.preferredModel || '')
  )) || null;
  const saferCandidate = benchmarkPool
    .filter((entry) => (
      (entry.provider !== (policy?.preferredProvider || '') || entry.model !== (policy?.preferredModel || ''))
      && entry.avgInterventions <= ((currentLane?.avgInterventions ?? 99))
      && entry.successRate >= 65
    ))
    .sort((left, right) => {
      if (left.avgInterventions !== right.avgInterventions) return left.avgInterventions - right.avgInterventions;
      return right.benchmarkScore - left.benchmarkScore;
    })[0] || null;

  const canHarden = policy?.approvalRule !== 'human_required';
  const canLoosen = Boolean(
    policy
    && policy.approvalRule !== 'auto_low_risk'
    && demotion.trend !== 'demoted'
    && demotion.confidence >= 60
    && batchTrust.tone !== 'amber'
    && (demotion.trend === 'improving' || batchTrust.tone === 'teal')
  );

  const hardenReason = !policy
    ? 'Commander needs a live policy before it can harden approval safely.'
    : !canHarden
      ? 'This routing policy is already at the strictest approval posture.'
      : demotion.trend === 'demoted'
        ? `Pressure is rising from ${demotion.pressureSources[0]?.label?.toLowerCase() || 'recent rescue pressure'}, so a stricter approval gate is justified.`
        : 'You can harden approval proactively if you want to slow risky work while evidence is still mixed.';

  const loosenReason = !policy
    ? 'Commander needs a live policy before it can relax approval safely.'
    : policy.approvalRule === 'auto_low_risk'
      ? 'This routing policy is already running at the lightest approval posture.'
      : canLoosen
        ? 'Trust is strong enough to stage a lighter approval posture from the summary surface.'
        : 'Commander is not ready to relax approval yet because trust is still mixed or rescue pressure is too recent.';

  const shouldPreferSaferSwap = demotion.trend === 'demoted' || batchTrust.tone === 'amber';
  const swapCandidate = shouldPreferSaferSwap ? saferCandidate || strongerCandidate : strongerCandidate || saferCandidate;
  const canSwap = Boolean(
    policy
    && swapCandidate
    && (
      swapCandidate.provider !== (policy.preferredProvider || '')
      || swapCandidate.model !== (policy.preferredModel || '')
    )
  );
  const swapDetail = !policy
    ? 'Commander needs a live policy before it can suggest a provider or model swap.'
    : !canSwap
      ? 'The current provider and model are still the best-supported lane for this policy.'
      : shouldPreferSaferSwap
        ? `${swapCandidate.provider} / ${swapCandidate.model} is the safer next lane because it is carrying less rescue pressure while still holding quality at ${swapCandidate.avgQuality}.`
        : `${swapCandidate.provider} / ${swapCandidate.model} is the stronger next lane because it is leading observed benchmark score at ${swapCandidate.benchmarkScore}.`;
  const swapEvidence = canSwap
    ? [
        `${swapCandidate.provider} / ${swapCandidate.model}`,
        `benchmark ${swapCandidate.benchmarkScore}`,
        `quality ${swapCandidate.avgQuality}`,
        `success ${swapCandidate.successRate}%`,
        `avg interventions ${swapCandidate.avgInterventions}`,
      ]
    : evidence;
  const benchmarkDelta = canSwap && currentLane ? swapCandidate.benchmarkScore - currentLane.benchmarkScore : null;
  const interventionDelta = canSwap && currentLane ? Number((currentLane.avgInterventions - swapCandidate.avgInterventions).toFixed(1)) : null;
  const qualityDelta = canSwap && currentLane ? swapCandidate.avgQuality - currentLane.avgQuality : null;
  const costDelta = canSwap && currentLane ? Number((currentLane.avgCost - swapCandidate.avgCost).toFixed(2)) : null;
  const durationDeltaMinutes = canSwap && currentLane ? Math.round(((currentLane.avgDurationMs - swapCandidate.avgDurationMs) / 60000) * 10) / 10 : null;
  const swapIntent = !canSwap
    ? 'none'
    : shouldPreferSaferSwap
      ? 'safer'
      : (costDelta ?? 0) >= 0.35 && swapCandidate.successRate >= ((currentLane?.successRate || 0) - 5)
        ? 'cheaper'
        : (durationDeltaMinutes ?? 0) >= 4 && swapCandidate.avgQuality >= ((currentLane?.avgQuality || 0) - 4)
          ? 'faster'
          : 'stronger';
  const swapIntentLabel = swapIntent === 'safer'
    ? 'safer lane'
    : swapIntent === 'cheaper'
      ? 'cheaper lane'
      : swapIntent === 'faster'
        ? 'faster lane'
        : swapIntent === 'stronger'
          ? 'stronger lane'
          : 'lane swap';
  const swapSignal = !canSwap
    ? 'No provider/model swap signal is dominant yet.'
    : swapIntent === 'safer'
      ? `Safer lane signal: ${swapCandidate.provider} / ${swapCandidate.model} is cutting rescue pressure by ${interventionDelta ?? 0}.`
      : swapIntent === 'cheaper'
        ? `Cheaper lane signal: ${swapCandidate.provider} / ${swapCandidate.model} is saving about $${Math.max(0, costDelta ?? 0).toFixed(2)} per run.`
        : swapIntent === 'faster'
          ? `Faster lane signal: ${swapCandidate.provider} / ${swapCandidate.model} is trimming about ${Math.max(0, durationDeltaMinutes ?? 0)} minutes per run.`
          : `Stronger lane signal: ${swapCandidate.provider} / ${swapCandidate.model} is up ${benchmarkDelta ?? 0} benchmark points.`;
  const swapLabel = canSwap ? `Stage ${swapIntentLabel}` : 'No lane swap suggested';
  const thresholdMet = Boolean(
    canSwap
    && (
      (shouldPreferSaferSwap && ((interventionDelta ?? 0) >= 0.5 || (swapCandidate.successRate - (currentLane?.successRate || 0)) >= 5))
      || (!shouldPreferSaferSwap && ((benchmarkDelta ?? 0) >= 8 || (qualityDelta ?? 0) >= 6))
    )
  );
  const thresholdLabel = !canSwap
    ? 'No swap threshold met'
    : swapIntent === 'safer'
      ? thresholdMet
        ? 'Safety threshold cleared'
        : 'Safety case still forming'
      : swapIntent === 'cheaper'
        ? thresholdMet
          ? 'Cost threshold cleared'
          : 'Cost case still forming'
        : swapIntent === 'faster'
          ? thresholdMet
            ? 'Speed threshold cleared'
            : 'Speed case still forming'
          : thresholdMet
            ? 'Performance threshold cleared'
            : 'Performance case still forming';
  const stageFallback = Boolean(thresholdMet && currentLane && (
    currentLane.provider !== swapCandidate?.provider || currentLane.model !== swapCandidate?.model
  ));

  return {
    delta,
    evidence,
    open: {
      label: 'Open policy',
      detail: delta.detail,
      evidence,
    },
    harden: {
      label: 'Harden approval',
      enabled: canHarden,
      detail: hardenReason,
      evidence,
    },
    loosen: {
      label: 'Loosen approval',
      enabled: canLoosen,
      detail: loosenReason,
      evidence,
    },
    swap: {
      label: swapLabel,
      enabled: canSwap,
      detail: swapDetail,
      evidence: swapEvidence,
      signal: swapSignal,
      provider: swapCandidate?.provider || null,
      model: swapCandidate?.model || null,
      intent: swapIntent,
      intentLabel: swapIntentLabel,
      thresholdMet,
      thresholdLabel,
      stageFallback,
      currentLane: currentLane ? {
        provider: currentLane.provider,
        model: currentLane.model,
        benchmarkScore: currentLane.benchmarkScore,
        avgQuality: currentLane.avgQuality,
        successRate: currentLane.successRate,
        avgInterventions: currentLane.avgInterventions,
        avgCost: currentLane.avgCost,
        avgDurationMs: currentLane.avgDurationMs,
      } : null,
      suggestedLane: swapCandidate ? {
        provider: swapCandidate.provider,
        model: swapCandidate.model,
        benchmarkScore: swapCandidate.benchmarkScore,
        avgQuality: swapCandidate.avgQuality,
        successRate: swapCandidate.successRate,
        avgInterventions: swapCandidate.avgInterventions,
        avgCost: swapCandidate.avgCost,
        avgDurationMs: swapCandidate.avgDurationMs,
      } : null,
      comparison: {
        benchmarkDelta,
        interventionDelta,
        qualityDelta,
        costDelta,
        durationDeltaMinutes,
      },
    },
  };
}

export function getTradeoffOutcomeSummary(swap = null) {
  if (!swap?.enabled || !swap.currentLane || !swap.suggestedLane) {
    return {
      available: false,
      title: 'No tradeoff outcome signal yet',
      detail: 'Commander still needs a clear lane tradeoff before it can judge whether safer, cheaper, faster, or stronger routing is paying off.',
      tone: 'slate',
      outcomeLabel: 'forming',
      metrics: [],
    };
  }

  const benchmarkDelta = swap.comparison?.benchmarkDelta ?? 0;
  const qualityDelta = swap.comparison?.qualityDelta ?? 0;
  const interventionDelta = swap.comparison?.interventionDelta ?? 0;
  const costDelta = swap.comparison?.costDelta ?? 0;
  const durationDeltaMinutes = swap.comparison?.durationDeltaMinutes ?? 0;

  let payingOff = false;
  if (swap.intent === 'safer') payingOff = interventionDelta > 0 || (swap.suggestedLane.successRate - swap.currentLane.successRate) >= 5;
  if (swap.intent === 'cheaper') payingOff = costDelta > 0 && qualityDelta >= -4;
  if (swap.intent === 'faster') payingOff = durationDeltaMinutes > 0 && qualityDelta >= -4;
  if (swap.intent === 'stronger') payingOff = benchmarkDelta > 0 || qualityDelta > 0;

  const outcomeLabel = payingOff ? 'paying off' : swap.thresholdMet ? 'mixed return' : 'still forming';
  const tone = payingOff ? 'teal' : swap.thresholdMet ? 'amber' : 'slate';
  const title = payingOff
    ? `${swap.intentLabel[0].toUpperCase()}${swap.intentLabel.slice(1)} is paying off`
    : `${swap.intentLabel[0].toUpperCase()}${swap.intentLabel.slice(1)} is still being proven`;
  const detail = swap.intent === 'safer'
    ? payingOff
      ? `${swap.suggestedLane.provider} / ${swap.suggestedLane.model} is reducing rescue pressure while keeping success stable enough to justify the safer posture.`
      : `${swap.suggestedLane.provider} / ${swap.suggestedLane.model} looks safer, but Commander still needs cleaner rescue and success evidence before that tradeoff is proven.`
    : swap.intent === 'cheaper'
      ? payingOff
        ? `${swap.suggestedLane.provider} / ${swap.suggestedLane.model} is cutting cost without a material quality collapse, so the cheaper route is earning trust.`
        : `${swap.suggestedLane.provider} / ${swap.suggestedLane.model} is cheaper, but Commander is still checking whether the quality tradeoff is acceptable.`
      : swap.intent === 'faster'
        ? payingOff
          ? `${swap.suggestedLane.provider} / ${swap.suggestedLane.model} is reducing execution time while keeping quality stable enough to justify the faster route.`
          : `${swap.suggestedLane.provider} / ${swap.suggestedLane.model} is faster, but Commander still needs to prove speed is not hurting outcomes.`
        : payingOff
          ? `${swap.suggestedLane.provider} / ${swap.suggestedLane.model} is outperforming the current lane strongly enough to justify the stronger route.`
          : `${swap.suggestedLane.provider} / ${swap.suggestedLane.model} looks stronger on paper, but Commander still needs the performance gap to hold.`;

  return {
    available: true,
    title,
    detail,
    tone,
    payingOff,
    outcomeLabel,
    metrics: [
      { label: 'Benchmark', value: benchmarkDelta > 0 ? `+${benchmarkDelta}` : `${benchmarkDelta}` },
      { label: 'Quality', value: qualityDelta > 0 ? `+${qualityDelta}` : `${qualityDelta}` },
      { label: 'Interventions', value: interventionDelta > 0 ? `-${interventionDelta}` : `${interventionDelta}` },
      { label: 'Cost', value: costDelta > 0 ? `-$${costDelta.toFixed(2)}` : `$${Math.abs(costDelta).toFixed(2)}` },
      { label: 'Time', value: durationDeltaMinutes > 0 ? `-${durationDeltaMinutes}m` : `${Math.abs(durationDeltaMinutes)}m` },
    ],
  };
}

export function getTradeoffCorrectiveAction(tradeoffOutcome = null, swap = null) {
  if (!tradeoffOutcome?.available || !swap?.enabled) {
    return {
      label: 'No corrective action yet',
      detail: 'Commander still needs a clear routing tradeoff before it can suggest a precise correction.',
      tone: 'slate',
      routeState: null,
      expectedImpact: null,
      postureComparison: null,
      doctrineImpact: null,
      verificationImpact: null,
      successCriteria: null,
      rollbackCriteria: null,
    };
  }

  const currentProvider = swap.currentLane?.provider || 'Adaptive provider';
  const currentModel = swap.currentLane?.model || 'Adaptive model';
  const suggestedProvider = swap.suggestedLane?.provider || currentProvider;
  const suggestedModel = swap.suggestedLane?.model || currentModel;
  const trustLift = tradeoffOutcome.payingOff ? 'gain' : swap.intent === 'safer' || swap.intent === 'faster' ? 'recover' : 'stabilize';

  if (tradeoffOutcome.payingOff) {
    return {
      label: 'Keep scaling this tradeoff',
      detail: swap.intent === 'safer'
        ? 'The safer lane is calming rescue pressure, so keep routing similar work through it.'
        : swap.intent === 'cheaper'
          ? 'The cheaper lane is preserving quality well enough to keep scaling it.'
          : swap.intent === 'faster'
          ? 'The faster lane is preserving outcomes, so it is safe to keep using it on matching work.'
          : 'The stronger lane is earning its extra cost, so keep reinforcing it on high-value work.',
      tone: 'teal',
      routeState: null,
      expectedImpact: {
        primary: 'Routing trust should strengthen further if similar runs stay clean.',
        tradeoff: 'Commander should keep watching for drift, but no immediate corrective cost is expected.',
      },
      postureComparison: {
        current: `Stay on ${suggestedProvider} / ${suggestedModel} with the current approval posture.`,
        proposed: 'No posture change. Commander should keep reinforcing the current winning lane.',
      },
      doctrineImpact: {
        confidence: 'Doctrine confidence should keep climbing if similar runs stay clean.',
        trust: `Commander expects this policy to keep ${trustLift}ing routing trust without a corrective reset.`,
      },
      verificationImpact: {
        threshold: 'Light verification',
        detail: 'A quick spot-check is enough here because Commander is reinforcing a tradeoff that is already paying off.',
      },
      successCriteria: [
        'Matching runs stay clean with no new rescue spike.',
        'Commander keeps or increases routing trust on this lane.',
      ],
      rollbackCriteria: [
        'Grouped rescues or reroutes start clustering again on matching work.',
        'Routing trust slips instead of holding or climbing.',
      ],
    };
  }

  if (swap.intent === 'safer') {
    return {
      label: 'Reroute back toward the stronger lane',
      detail: 'This safer lane is not calming the board enough, so Commander should lean back toward the stronger benchmark lane for similar work.',
      tone: 'amber',
      routeState: swap.currentLane ? {
        providerSwap: swap.currentLane.provider,
        modelSwap: swap.currentLane.model,
        fallbackSwap: swap.suggestedLane,
        stageFallback: true,
      } : null,
      expectedImpact: {
        primary: 'Quality and rescue pressure should stabilize if Commander moves back to the stronger lane.',
        tradeoff: 'Cost may rise relative to the safer lane, but branch failure pressure should drop.',
      },
      postureComparison: {
        current: `Current posture is leaning on the safer lane ${suggestedProvider} / ${suggestedModel}.`,
        proposed: `Proposed posture reroutes back toward ${currentProvider} / ${currentModel} and keeps the current lane staged as fallback.`,
      },
      doctrineImpact: {
        confidence: 'Doctrine confidence should recover if the stronger lane reduces rescue pressure on matching work.',
        trust: `Commander expects trust to move back toward ${currentProvider} / ${currentModel} once brittle safer-lane pressure drops.`,
      },
      verificationImpact: {
        threshold: 'Strong verification',
        detail: 'Commander should watch the next few matching runs closely because this reroute changes the preferred lane and cost posture together.',
      },
      successCriteria: [
        'Rescue and reroute pressure fall on the next matching runs.',
        'Quality recovers without another policy hardening step.',
      ],
      rollbackCriteria: [
        'Cost rises but rescue pressure does not improve.',
        'The stronger lane still needs repeated manual rescue on matching work.',
      ],
    };
  }
  if (swap.intent === 'cheaper') {
    return {
      label: 'Harden approval on the cheaper lane',
      detail: 'The cheaper route is not protecting quality enough, so Commander should tighten approval before scaling it further.',
      tone: 'amber',
      routeState: {
        adjustment: 'harden',
        evidenceRequired: true,
      },
      expectedImpact: {
        primary: 'Rescue risk should fall because low-confidence cheap-lane work will hit a tighter approval gate.',
        tradeoff: 'Approval drag will increase until the cheaper lane proves it can hold quality.',
      },
      postureComparison: {
        current: `Current posture is scaling the cheaper lane ${suggestedProvider} / ${suggestedModel} with its existing approval gate.`,
        proposed: `Proposed posture keeps ${suggestedProvider} / ${suggestedModel} but hardens approval and requires more evidence before scale.`,
      },
      doctrineImpact: {
        confidence: 'Doctrine confidence should stabilize because weaker cheap-lane runs will stop self-advancing so easily.',
        trust: 'Commander expects approval trust to rise even if throughput relaxes for a while.',
      },
      verificationImpact: {
        threshold: 'Moderate verification',
        detail: 'Check the next approval-gated runs for cleaner quality and lower rescue pressure before relaxing the human bar again.',
      },
      successCriteria: [
        'Approval-gated runs land with fewer rescues.',
        'Quality holds while the cheaper lane stays in use.',
      ],
      rollbackCriteria: [
        'Approval drag rises without a meaningful rescue or quality improvement.',
        'The cheaper lane still needs repeated overrides after hardening.',
      ],
    };
  }
  if (swap.intent === 'faster') {
    return {
      label: 'Slow down and verify',
      detail: 'The faster lane is creating drag or quality loss, so Commander should add verification before trusting it at speed.',
      tone: 'amber',
      routeState: {
        adjustment: 'harden',
        evidenceRequired: true,
        contextPolicy: 'balanced',
      },
      expectedImpact: {
        primary: 'Failure pressure should fall because faster work will slow down for more verification.',
        tradeoff: 'Latency will rise, but Commander should recover cleaner output.',
      },
      postureComparison: {
        current: `Current posture is favoring the faster lane ${suggestedProvider} / ${suggestedModel} for speed.`,
        proposed: `Proposed posture keeps ${suggestedProvider} / ${suggestedModel} but slows down with a harder approval gate and balanced verification context.`,
      },
      doctrineImpact: {
        confidence: 'Doctrine confidence should recover if added verification stops speed-led quality drift.',
        trust: 'Commander expects the routing policy to trade some throughput for a more trustworthy confidence signal.',
      },
      verificationImpact: {
        threshold: 'Strong verification',
        detail: 'Commander should verify the next fast-lane runs carefully because this change is explicitly trading speed for reliability.',
      },
      successCriteria: [
        'Failure pressure drops on the next fast-lane runs.',
        'Latency rises less than the quality recovery gained.',
      ],
      rollbackCriteria: [
        'Latency rises sharply but failures do not improve.',
        'Fast-lane quality is still drifting even with added verification.',
      ],
    };
  }

  return {
    label: 'Keep the stronger lane and scale it carefully',
    detail: 'The stronger lane is still the best available option, but Commander should keep the cheaper or safer alternatives from bleeding trust into it.',
    tone: 'teal',
    routeState: swap.suggestedLane ? {
      providerSwap: swap.suggestedLane.provider,
      modelSwap: swap.suggestedLane.model,
      fallbackSwap: swap.currentLane,
      stageFallback: true,
    } : null,
    expectedImpact: {
      primary: 'High-value work should keep landing cleanly if Commander keeps the stronger lane in front.',
      tradeoff: 'Cost may stay elevated, so weaker work should still be pushed down-stack where possible.',
    },
    postureComparison: {
      current: `Current posture is still allowing weaker alternatives to compete with ${suggestedProvider} / ${suggestedModel}.`,
      proposed: `Proposed posture moves ${suggestedProvider} / ${suggestedModel} to the front and stages ${currentProvider} / ${currentModel} as fallback coverage.`,
    },
    doctrineImpact: {
      confidence: 'Doctrine confidence should rise if the stronger lane keeps outperforming nearby alternatives.',
      trust: `Commander expects trust to consolidate around ${suggestedProvider} / ${suggestedModel} while keeping fallback safety intact.`,
    },
    verificationImpact: {
      threshold: 'Moderate verification',
      detail: 'Watch the next few high-value runs to confirm the stronger lane keeps earning its extra cost before widening the policy further.',
    },
    successCriteria: [
      'High-value runs keep landing cleanly on the stronger lane.',
      'The stronger lane continues to outperform fallback options on trust.',
    ],
    rollbackCriteria: [
      'The stronger lane stops outperforming fallback options on trust.',
      'Extra cost keeps rising without a matching quality or rescue advantage.',
    ],
  };
}

export function buildProviderEscalationExplanation(benchmarks = []) {
  if (!benchmarks.length) {
    return {
      title: 'Commander still needs outcome history before it can justify escalation cleanly.',
      detail: 'Once benchmark data accumulates, this rail will explain when to stay cheap, when to escalate, and which provider is currently earning that trust.',
      cheapestStrongLane: null,
      premiumLeader: null,
    };
  }

  const premiumLeader = benchmarks[0] || null;
  const cheapestStrongLane = benchmarks
    .filter((entry) => entry.avgQuality >= 70 && entry.successRate >= 65)
    .slice()
    .sort((left, right) => {
      if (left.avgCost !== right.avgCost) return left.avgCost - right.avgCost;
      return right.benchmarkScore - left.benchmarkScore;
    })[0] || premiumLeader;

  if (!premiumLeader) {
    return {
      title: 'No dominant provider lane yet',
      detail: 'Traffic is still too dispersed to explain a confident escalation posture.',
      cheapestStrongLane: null,
      premiumLeader: null,
    };
  }

  if (premiumLeader.key === cheapestStrongLane?.key) {
    return {
      title: `${premiumLeader.provider} is winning without needing a second lane`,
      detail: `${premiumLeader.model} is currently the strongest all-around lane on quality, success, and economics. Commander does not need to escalate away from it often right now.`,
      cheapestStrongLane,
      premiumLeader,
    };
  }

  return {
    title: `Stay on ${cheapestStrongLane.provider} until ambiguity forces ${premiumLeader.provider}`,
    detail: `${cheapestStrongLane.model} is the cheapest lane still clearing quality at ${cheapestStrongLane.avgQuality}. Escalate to ${premiumLeader.model} only when the task is ambiguous, high-risk, or needs final judgment because it is the current benchmark leader at ${premiumLeader.benchmarkScore}.`,
    cheapestStrongLane,
    premiumLeader,
  };
}

export function parseOutcomeScoreLogs(logs = []) {
  return logs
    .filter((entry) => String(entry.message || '').includes('[outcome-score]'))
    .map((entry) => {
      const message = String(entry.message || '').replace('[outcome-score] ', '');
      const scoreMatch = message.match(/score (\d+)/i);
      const trustMatch = message.match(/trust ([a-z]+)/i);
      const rootMatch = message.match(/root ([a-z0-9-]+)/i);
      return {
        ...entry,
        score: scoreMatch ? Number(scoreMatch[1]) : null,
        trust: trustMatch ? trustMatch[1] : 'unknown',
        rootMissionId: rootMatch ? rootMatch[1] : null,
        cleanMessage: message,
      };
    })
    .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime());
}

export function getOutcomeMemorySummary(outcomes = []) {
  const averageScore = outcomes.length
    ? Math.round(outcomes.reduce((sum, outcome) => sum + Number(outcome.score || 0), 0) / outcomes.length)
    : 0;
  const byTrust = outcomes.reduce((acc, outcome) => {
    const trust = outcome.trust || 'unknown';
    acc[trust] = (acc[trust] || 0) + 1;
    return acc;
  }, {});

  return {
    averageScore,
    total: outcomes.length,
    highTrust: byTrust.high || 0,
    mediumTrust: byTrust.medium || 0,
    lowTrust: byTrust.low || 0,
  };
}

export function getPostLaunchConfidenceSummary({ outcomes = [], interventions = [] } = {}) {
  const outcomeSummary = getOutcomeMemorySummary(outcomes);
  const normalizedInterventions = Array.isArray(interventions)
    ? interventions
    : [];
  const rescueEvents = normalizedInterventions.filter((entry) => ['stop', 'cancel', 'retry'].includes(entry.eventType)).length;
  const rerouteEvents = normalizedInterventions.filter((entry) => ['reroute', 'dependency'].includes(entry.eventType)).length;
  const approvalEvents = normalizedInterventions.filter((entry) => entry.eventType === 'approve').length;
  const guardrailEvents = normalizedInterventions.filter((entry) => entry.eventType === 'guardrail').length;
  const pressureScore = (rescueEvents * 14) + (rerouteEvents * 8) + (approvalEvents * 5) + (guardrailEvents * 6);
  const runtimeConfidence = clamp(
    Math.round((outcomeSummary.averageScore || 58) - pressureScore + (outcomeSummary.highTrust * 3) - (outcomeSummary.lowTrust * 5)),
    0,
    100,
  );
  const posture = outcomeSummary.total === 0
    ? 'forming'
    : runtimeConfidence >= 74
      ? 'grounded'
      : runtimeConfidence >= 58
        ? 'cautious'
        : 'drifting';
  const label = posture === 'grounded'
    ? 'Confidence is grounded in runtime reality'
    : posture === 'cautious'
      ? 'Confidence is usable, but runtime rescue is visible'
      : posture === 'drifting'
        ? 'Runtime reality is eroding launch confidence'
        : 'Commander needs more completed runs before confidence can close honestly';
  const detail = posture === 'grounded'
    ? `${outcomeSummary.highTrust} high-trust outcome${outcomeSummary.highTrust === 1 ? '' : 's'} and low rescue pressure are keeping the launch readback honest.`
    : posture === 'cautious'
      ? `${rescueEvents + rerouteEvents} rescue/reroute event${rescueEvents + rerouteEvents === 1 ? '' : 's'} are landing after launch, so confidence should stay measured.`
      : posture === 'drifting'
        ? `Human rescue, reroutes, or guardrails are landing often enough that Commander should tighten the next preflight before scaling.`
        : 'Completed mission density is still too light to compare preflight confidence with runtime truth reliably.';

  return {
    runtimeConfidence,
    posture,
    label,
    detail,
    rescueEvents,
    rerouteEvents,
    approvalEvents,
    guardrailEvents,
    outcomeSummary,
  };
}

export function parseDoctrineFeedbackLogs(logs = []) {
  return logs
    .filter((entry) => String(entry.message || '').includes('[doctrine-feedback]'))
    .map((entry) => ({
      ...entry,
      cleanMessage: String(entry.message || '').replace('[doctrine-feedback] ', ''),
    }))
    .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime());
}

export function getAutomationRoiSummary(tasks = [], humanHourlyRate = 150) {
  const closedTasks = tasks.filter(isTaskClosed);
  const totalAgentSpend = tasks.reduce((sum, task) => sum + Number(task.costUsd || 0), 0);
  const totalDurationMs = tasks.reduce((sum, task) => sum + Number(task.durationMs || 0), 0);
  const inferredHours = totalDurationMs > 0
    ? totalDurationMs / 3_600_000
    : closedTasks.length * 0.33;
  const humanEquivalent = inferredHours * humanHourlyRate;
  const savings = humanEquivalent - totalAgentSpend;
  const roiMultiple = totalAgentSpend > 0 ? humanEquivalent / totalAgentSpend : humanEquivalent > 0 ? humanEquivalent : 0;
  const autonomousRuns = closedTasks.filter((task) => task.approvalLevel !== 'human_required').length;

  return {
    closedTasks: closedTasks.length,
    autonomousRuns,
    totalAgentSpend,
    humanEquivalent,
    savings,
    roiMultiple,
    estimatedHoursSaved: inferredHours,
  };
}

export function getPersistentFleetHistory(logs = [], agents = []) {
  const events = logs
    .filter((entry) => {
      const message = String(entry.message || '');
      return message.includes('[specialist-persistent]') || message.includes('[specialist-spawned]') || message.includes('[specialist-retired]');
    })
    .map((entry) => {
      const message = String(entry.message || '');
      let eventType = 'spawned';
      if (message.includes('[specialist-persistent]')) eventType = 'promoted';
      if (message.includes('[specialist-retired]')) eventType = 'retired';

      return {
        ...entry,
        eventType,
        cleanMessage: message
          .replace('[specialist-persistent] ', '')
          .replace('[specialist-spawned] ', '')
          .replace('[specialist-retired] ', ''),
      };
    })
    .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime());

  const persistentAgents = agents.filter((agent) => !agent.isEphemeral && !['commander', 'executor'].includes(agent.role || ''));
  const coverageByRole = persistentAgents.reduce((acc, agent) => {
    const role = agent.role || 'specialist';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  return {
    promotions: events.filter((entry) => entry.eventType === 'promoted'),
    retirements: events.filter((entry) => entry.eventType === 'retired'),
    events,
    coverageByRole,
  };
}

export function getSpecialistLifecycleSummary(lifecycleEvents = [], agents = []) {
  const normalizedEvents = lifecycleEvents
    .map((entry) => ({
      ...entry,
      cleanMessage: String(entry.message || '')
        .replace('[specialist-persistent] ', '')
        .replace('[specialist-spawned] ', '')
        .replace('[specialist-retired] ', ''),
      timestamp: entry.createdAt || entry.timestamp,
    }))
    .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime());

  const persistentAgents = agents.filter((agent) => !agent.isEphemeral && !['commander', 'executor'].includes(agent.role || ''));
  const coverageByRole = persistentAgents.reduce((acc, agent) => {
    const role = agent.role || 'specialist';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  return {
    promotions: normalizedEvents.filter((entry) => ['promoted', 'persistent_created'].includes(entry.eventType)),
    retirements: normalizedEvents.filter((entry) => ['retired', 'cleaned_up'].includes(entry.eventType)),
    spawned: normalizedEvents.filter((entry) => entry.eventType === 'spawned'),
    cleaned: normalizedEvents.filter((entry) => entry.eventType === 'cleaned_up'),
    events: normalizedEvents,
    coverageByRole,
  };
}

export function getFleetPostureSummary(lifecycleEvents = [], agents = []) {
  const lifecycle = getSpecialistLifecycleSummary(lifecycleEvents, agents);
  const persistentCount = agents.filter((agent) => !agent.isEphemeral && !['commander', 'executor'].includes(agent.role || '')).length;
  const spawnedCount = agents.filter((agent) => agent.isEphemeral).length;
  const promotionCount = lifecycle.promotions.length;
  const retirementCount = lifecycle.retirements.length;
  const cleanedCount = lifecycle.cleaned.length;
  const activeRoles = Object.keys(lifecycle.coverageByRole).length;
  const churnScore = retirementCount + cleanedCount + Math.max(0, spawnedCount - promotionCount);
  const posture = persistentCount >= 4 && churnScore <= Math.max(2, Math.ceil(persistentCount / 2))
    ? 'stable'
    : persistentCount <= 1 || activeRoles <= 1
      ? 'thin'
      : churnScore >= Math.max(3, persistentCount)
        ? 'churn-heavy'
        : 'forming';
  const label = posture === 'stable'
    ? 'Stable fleet'
    : posture === 'thin'
      ? 'Thin coverage'
      : posture === 'churn-heavy'
        ? 'Churn-heavy'
        : 'Forming fleet';
  const detail = posture === 'stable'
    ? 'Persistent specialist coverage is broad enough that Commander is not leaning heavily on disposable lanes.'
    : posture === 'thin'
      ? 'Too few persistent specialists are covering too much of the workload, so Commander still depends on ad-hoc execution.'
      : posture === 'churn-heavy'
        ? 'Spawn and retirement pressure is high relative to persistent coverage, which usually means the fleet is still too brittle.'
        : 'The fleet is filling in, but Commander still needs more durable role coverage before the posture feels settled.';

  return {
    posture,
    label,
    detail,
    persistentCount,
    spawnedCount,
    promotionCount,
    retirementCount,
    cleanedCount,
    activeRoles,
    coverageByRole: lifecycle.coverageByRole,
    recentEvents: lifecycle.events.slice(0, 6),
  };
}

function getRecommendationKeywordBoost(recommendation, signals) {
  const text = `${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase();
  let score = 0;
  const reasons = [];

  if (/(routing|lane|provider|model|doctrine|escalat)/.test(text)) {
    const routingPressure = (signals.reroutePressure * 6) + (signals.rescuePressure * 4) + (signals.policyDemotionPressure * 2);
    if (routingPressure > 0) {
      score += routingPressure;
      reasons.push(`${signals.reroutePressure} reroutes and ${signals.rescuePressure} rescue events are still stressing lane choice.`);
    }
    if (signals.tradeoffOutcome?.available) {
      if (signals.tradeoffOutcome.payingOff) {
        score += 10;
        reasons.push(`Current ${signals.tradeoffOutcome.outcomeLabel} routing tradeoff is paying back, so Commander should reinforce the winning lane logic.`);
      } else {
        score += 16;
        reasons.push(`Current routing tradeoff is ${signals.tradeoffOutcome.outcomeLabel}, so Commander should correct weak lane posture faster.`);
      }
    }
  }

  if (/(automation|recurring|cadence|approval posture|guardrail)/.test(text)) {
    const automationPressure = (signals.recurringGuardrailPressure * 8) + (signals.recurringTuningPressure * 5);
    if (automationPressure > 0) {
      score += automationPressure;
      reasons.push(`${signals.recurringGuardrailPressure} recurring guardrails and ${signals.recurringTuningPressure} tuning signals are still landing on managed flows.`);
    }
  }

  if (/(specialist|fleet|promotion|persistent|spawn)/.test(text)) {
    const fleetPressure = signals.fleetPosture.posture === 'thin'
      ? 18
      : signals.fleetPosture.posture === 'churn-heavy'
        ? 16
        : signals.fleetPosture.posture === 'forming'
          ? 8
          : 0;
    if (fleetPressure > 0) {
      score += fleetPressure;
      reasons.push(signals.fleetPosture.detail);
    }
  }

  if (/(failure|rescue|stabil|recover|throughput|bottleneck)/.test(text)) {
    const executionPressure = (signals.failedTasks * 6) + (signals.runningTasks > 4 ? 8 : 0) + (signals.rescuePressure * 4);
    if (executionPressure > 0) {
      score += executionPressure;
      reasons.push(`${signals.failedTasks} failed branches and ${signals.rescuePressure} rescue interventions are still shaping throughput.`);
    }
  }

  if (/(pattern|shape|default|repeatable|mission pattern)/.test(text) || String(recommendation.id || '').includes('pattern')) {
    const patternPressure = signals.patternStrength >= 75 ? 18 : signals.patternStrength >= 60 ? 10 : 0;
    if (patternPressure > 0) {
      score += patternPressure;
      reasons.push(`A repeated mission shape is separating cleanly enough that Commander should lean into it more aggressively.`);
    }
  }

  if (/(rescue|intervention|override|reroute)/.test(text) || String(recommendation.id || '').includes('rescue')) {
    const rescuePressure = (signals.rescuePressure * 5) + Math.round(signals.rescueRate / 4);
    if (rescuePressure > 0) {
      score += rescuePressure;
      reasons.push(`${signals.rescueRate}% of recent mission roots still needed rescue pressure, which should push weak lanes down faster.`);
    }
  }

  return {
    score,
    reasons,
  };
}

function getRecommendationClass(recommendation, signals, keywordBoost) {
  const id = String(recommendation.id || '').toLowerCase();
  const text = `${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase();

  if (/(pattern|shape|repeatable)/.test(text) || id.includes('pattern')) {
    return {
      label: 'Pattern winner',
      tone: 'teal',
    };
  }
  if (/(rescue|intervention|override|reroute)/.test(text) || id.includes('rescue') || signals.rescuePressure > signals.failedTasks) {
    return {
      label: 'Rescue pressure',
      tone: 'rose',
    };
  }
  if (/(specialist|fleet|promotion|persistent|spawn)/.test(text)) {
    return {
      label: 'Fleet pressure',
      tone: 'violet',
    };
  }
  if (/(automation|recurring|cadence|approval posture|guardrail)/.test(text)) {
    return {
      label: 'Automation tuning',
      tone: 'amber',
    };
  }
  if (/(routing|lane|provider|model|doctrine|escalat)/.test(text) || keywordBoost.score >= 18) {
    return {
      label: 'Routing pressure',
      tone: 'blue',
    };
  }

  return {
    label: 'Operational pressure',
    tone: 'slate',
  };
}

export function rankCommanderRecommendations({
  recommendations = [],
  tasks = [],
  outcomes = [],
  interventions = [],
  logs = [],
  lifecycleEvents = [],
  agents = [],
  learningMemory = null,
  tradeoffOutcome = null,
  tradeoffCorrectiveAction = null,
} = {}) {
  const normalizedInterventions = normalizeInterventionEvents(interventions, logs);
  const batchSignals = getBatchCommandSignals(logs);
  const fleetPosture = getFleetPostureSummary(lifecycleEvents, agents);
  const rescueTouchedRoots = new Set(
    normalizedInterventions
      .filter((entry) => ['stop', 'cancel', 'retry', 'reroute', 'dependency'].includes(entry.eventType))
      .map((entry) => entry.rootMissionId || entry.taskId)
      .filter(Boolean)
  );
  const totalMissionRoots = Math.max(new Set(tasks.map((task) => task.rootMissionId || task.id).filter(Boolean)).size, 1);
  const patternStrength = Number(learningMemory?.doctrineById?.['doctrine-mission-patterns']?.confidence || learningMemory?.doctrineById?.['mission-pattern-memory']?.confidence || 0);
  const policyDemotionPressure = recommendations.reduce((sum, recommendation) => {
    if (!recommendation?.taskDomain && !recommendation?.intentType) return sum;
    return sum + buildPolicyDemotionSummary(recommendation, tasks, interventions, logs).score;
  }, 0);
  const confidenceClosure = getPostLaunchConfidenceSummary({ outcomes, interventions: normalizedInterventions });
  const recurringBriefFit = getRecurringBriefFitSummary(tasks, normalizedInterventions, outcomes);
  const branchConnectorPressure = getBranchConnectorPressureSummary(tasks, normalizedInterventions);
  const signals = {
    failedTasks: tasks.filter((task) => ['failed', 'error', 'blocked'].includes(String(task.status || '').toLowerCase()) || task.workflowStatus === 'failed').length,
    runningTasks: tasks.filter((task) => String(task.status || '').toLowerCase() === 'running' || task.workflowStatus === 'running').length,
    rescuePressure: normalizedInterventions.filter((entry) => ['stop', 'cancel', 'retry'].includes(entry.eventType)).length,
    reroutePressure: normalizedInterventions.filter((entry) => ['reroute', 'dependency'].includes(entry.eventType)).length,
    recurringGuardrailPressure: normalizedInterventions.filter((entry) => entry.eventType === 'guardrail').length,
    recurringTuningPressure: normalizedInterventions.filter((entry) => {
      const scheduleType = String(entry.scheduleType || entry.metadata?.scheduleType || '').toLowerCase();
      const eventType = String(entry.eventType || '').toLowerCase();
      return scheduleType === 'recurring' && eventType !== 'guardrail';
    }).length,
    batchApprovePressure: Number(batchSignals.actionCounts.approve || 0),
    batchRetryPressure: Number(batchSignals.actionCounts.retry || 0),
    batchRedirectPressure: Number(batchSignals.actionCounts.redirect || 0),
    batchCommandPressure: batchSignals.totalActions,
    rescueRate: Math.round((rescueTouchedRoots.size / totalMissionRoots) * 100),
    patternStrength,
    policyDemotionPressure,
    fleetPosture,
    confidenceClosure,
    recurringBriefFit,
    branchConnectorPressure,
    tradeoffOutcome,
    tradeoffCorrectiveAction,
  };

  return recommendations
    .map((recommendation) => {
      const baseImpact = recommendation.impact === 'critical'
        ? 70
        : recommendation.impact === 'high'
          ? 56
          : recommendation.impact === 'medium'
            ? 44
            : 34;
      const keywordBoost = getRecommendationKeywordBoost(recommendation, signals);
      let score = baseImpact + keywordBoost.score;
      const id = String(recommendation.id || '');
      if (id.includes('mission-pattern')) score += Math.round(signals.patternStrength / 3);
      if (id.includes('rescue') || id.includes('intervention')) score += Math.round((signals.rescueRate + (signals.rescuePressure * 6)) / 3);
      if (/(batch|group|approval posture|approval|reroute|redirect)/.test(`${recommendation.id || ''} ${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase())) {
        score += (signals.batchRetryPressure * 4) + (signals.batchRedirectPressure * 3) + Math.round(signals.batchApprovePressure * 1.5);
      }
      if (signals.confidenceClosure.posture === 'drifting' && /(routing|lane|provider|model|automation|rescue|intervention|guardrail|confidence)/.test(`${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase())) {
        score += 16;
      } else if (signals.confidenceClosure.posture === 'cautious' && /(routing|automation|rescue|confidence)/.test(`${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase())) {
        score += 8;
      }
      if (signals.recurringBriefFit.available && /(automation|recurring|cadence|approval posture|guardrail|verification)/.test(`${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase())) {
        score += (signals.recurringBriefFit.driftingCount * 8) + (signals.recurringBriefFit.watchCount * 4);
      }
      if (signals.branchConnectorPressure.available && /(connector|permission|approval|guardrail|intervention|routing|lane|verification|write)/.test(`${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase())) {
        score += signals.branchConnectorPressure.guardedCount * 6;
        score += signals.branchConnectorPressure.draftCount * 3;
        score += signals.branchConnectorPressure.guardedExternalCount * 5;
        score -= signals.branchConnectorPressure.localFirstFallbackCount * 2;
      }
      if (signals.tradeoffOutcome?.available && /(routing|lane|provider|model|doctrine|escalat)/.test(`${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase())) {
        score += signals.tradeoffOutcome.payingOff ? 8 : 14;
      }
      const whyNow = keywordBoost.reasons[0]
        || (signals.recurringBriefFit.available && signals.recurringBriefFit.driftingCount > 0 && /(automation|recurring|verification)/.test(`${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase())
          ? signals.recurringBriefFit.detail
          : null)
        || (signals.branchConnectorPressure.available && signals.branchConnectorPressure.score > 0 && /(connector|permission|approval|guardrail|lane|write)/.test(`${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase())
          ? `${signals.branchConnectorPressure.detail}${signals.branchConnectorPressure.guardedExternalCount > 0 ? ' Guarded external fallback is still blocking downstream work, so intervention priority should stay close to those lanes.' : signals.branchConnectorPressure.localFirstFallbackCount > 0 ? ' Some branches are already on local-first fallback, so throughput can keep moving while risk stays lower there.' : ''}`
          : null)
        || (signals.confidenceClosure.posture === 'drifting' ? signals.confidenceClosure.detail : null)
        || (signals.failedTasks > 0 ? `${signals.failedTasks} failed branches are still active and keeping pressure on execution quality.` : 'This recommendation is persistent because Commander keeps seeing the same leverage point.');
      const recommendationClass = getRecommendationClass(recommendation, signals, keywordBoost);

      return {
        ...recommendation,
        rankingScore: score,
        whyNow,
        signalCount: keywordBoost.reasons.length,
        rankingReasons: keywordBoost.reasons,
        recommendationClass,
        correctiveAction: recommendation.correctiveAction
          || (signals.tradeoffOutcome?.available && signals.tradeoffCorrectiveAction && /(routing|lane|provider|model|doctrine|escalat)/.test(`${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase())
            ? signals.tradeoffCorrectiveAction
            : null),
      };
    })
    .sort((left, right) => {
      if (right.rankingScore !== left.rankingScore) return right.rankingScore - left.rankingScore;
      return String(left.title || '').localeCompare(String(right.title || ''));
    });
}

export function getDoctrineDeltaSummary(doctrineItems = []) {
  return doctrineItems
    .map((item) => {
      const history = Array.isArray(item.history) ? item.history : [];
      const latest = history[0] || null;
      const previous = history[1] || null;
      const delta = latest && previous
        ? Number(latest.confidence || item.confidence || 0) - Number(previous.confidence || 0)
        : 0;
      const trend = !previous
        ? 'forming'
        : delta >= 4
          ? 'up'
          : delta <= -4
            ? 'down'
            : 'flat';
      return {
        id: item.id,
        title: item.title,
        owner: item.owner,
        confidence: item.confidence,
        delta,
        trend,
        changeSummary: item.changeSummary || 'Doctrine is holding steady.',
        detail: item.detail,
      };
    })
    .sort((left, right) => {
      if (Math.abs(right.delta) !== Math.abs(left.delta)) return Math.abs(right.delta) - Math.abs(left.delta);
      return Number(right.confidence || 0) - Number(left.confidence || 0);
    });
}

export function getPersistentPromotionGuidance({ lifecycleEvents = [], agents = [], tasks = [] } = {}) {
  const fleetPosture = getFleetPostureSummary(lifecycleEvents, agents);
  const persistentRoles = new Set(
    agents
      .filter((agent) => !agent.isEphemeral && !['commander', 'executor'].includes(agent.role || ''))
      .map((agent) => agent.role || 'specialist')
  );
  const spawnedByRole = lifecycleEvents.reduce((acc, entry) => {
    if ((entry.eventType || '') !== 'spawned') return acc;
    const role = entry.role || 'specialist';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});
  const roleDemand = tasks.reduce((acc, task) => {
    const role = task.agentRole || task.assignedRole || task.role;
    if (!role || ['commander', 'executor'].includes(role)) return acc;
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});
  const domainRoleDemand = tasks.reduce((acc, task) => {
    const role = task.agentRole || task.assignedRole || task.role;
    if (!role || ['commander', 'executor'].includes(role)) return acc;
    const domain = task.domain || 'general';
    const intentType = task.intentType || 'general';
    const key = `${domain}::${intentType}::${role}`;
    if (!acc[key]) {
      acc[key] = {
        domain,
        intentType,
        role,
        count: 0,
      };
    }
    acc[key].count += 1;
    return acc;
  }, {});
  const rankedRoleDemand = Object.entries(roleDemand)
    .map(([role, count]) => ({
      role,
      count,
      covered: persistentRoles.has(role),
      spawnedCount: Number(spawnedByRole[role] || 0),
    }))
    .sort((left, right) => {
      if (left.covered !== right.covered) return left.covered ? 1 : -1;
      if ((right.spawnedCount || 0) !== (left.spawnedCount || 0)) return (right.spawnedCount || 0) - (left.spawnedCount || 0);
      return right.count - left.count;
    });
  const topGap = rankedRoleDemand.find((entry) => !entry.covered) || rankedRoleDemand[0] || null;
  const autoCreateRoles = rankedRoleDemand
    .filter((entry) => !entry.covered)
    .filter((entry) => {
      const entryPressure = (entry.count * 8) + ((entry.spawnedCount || 0) * 10)
        + (fleetPosture.posture === 'thin' ? 18 : 0)
        + (fleetPosture.posture === 'churn-heavy' ? 14 : 0);
      return entryPressure >= 32 || entry.count >= 4 || (entry.count >= 2 && (entry.spawnedCount || 0) >= 2);
    })
    .map((entry) => entry.role);
  const domainTargets = Object.values(domainRoleDemand)
    .map((entry) => ({
      ...entry,
      covered: persistentRoles.has(entry.role),
      spawnedCount: Number(spawnedByRole[entry.role] || 0),
    }))
    .filter((entry) => !entry.covered)
    .sort((left, right) => {
      if ((right.spawnedCount || 0) !== (left.spawnedCount || 0)) return (right.spawnedCount || 0) - (left.spawnedCount || 0);
      return right.count - left.count;
    })
    .slice(0, 4);
  const domainPackDemand = tasks.reduce((acc, task) => {
    const role = task.agentRole || task.assignedRole || task.role;
    if (!role || ['commander', 'executor'].includes(role)) return acc;
    const domain = task.domain || 'general';
    const key = `${domain}::${role}`;
    if (!acc[key]) {
      acc[key] = {
        domain,
        role,
        count: 0,
      };
    }
    acc[key].count += 1;
    return acc;
  }, {});
  const domainPackTargets = Object.values(domainPackDemand)
    .map((entry) => ({
      ...entry,
      covered: persistentRoles.has(entry.role),
      spawnedCount: Number(spawnedByRole[entry.role] || 0),
    }))
    .filter((entry) => !entry.covered)
    .sort((left, right) => {
      if ((right.spawnedCount || 0) !== (left.spawnedCount || 0)) return (right.spawnedCount || 0) - (left.spawnedCount || 0);
      return right.count - left.count;
    })
    .slice(0, 4);
  const recommendedActions = [
    ...autoCreateRoles.slice(0, 3).map((role) => ({
      key: `role-${role}`,
      label: `Create ${role} lane`,
      role,
      domain: null,
      count: rankedRoleDemand.find((entry) => entry.role === role)?.count || 0,
      tone: 'blue',
    })),
    ...domainPackTargets.slice(0, 3).map((entry) => ({
      key: `pack-${entry.domain}-${entry.role}`,
      label: `${entry.domain}: ${entry.role}`,
      role: entry.role,
      domain: entry.domain,
      count: entry.count,
      tone: 'violet',
    })),
  ].slice(0, 4);
  const pressureScore = topGap
    ? (topGap.count * 8) + ((topGap.spawnedCount || 0) * 10)
      + (fleetPosture.posture === 'thin' ? 18 : 0)
      + (fleetPosture.posture === 'churn-heavy' ? 14 : 0)
    : 0;
  const shouldAutoCreate = Boolean(
    topGap
    && !topGap.covered
    && (
      pressureScore >= 34
      || topGap.count >= 4
      || (topGap.count >= 2 && (topGap.spawnedCount || 0) >= 2)
    )
  );
  const recommendation = topGap
    ? topGap.covered
      ? `Persistent ${topGap.role} coverage exists already, so promotion pressure is low unless that lane starts choking.`
      : shouldAutoCreate
        ? `Commander should auto-create a persistent ${topGap.role} lane next. It is showing up in ${topGap.count} branch assignments with ${topGap.spawnedCount || 0} spawned specialist materializations and no durable coverage.`
        : `Promote or create a persistent ${topGap.role} lane next. It is showing up in ${topGap.count} branch assignments without durable coverage.`
    : 'Mission traffic is still too diffuse to call the next persistent specialist confidently.';

  return {
    posture: fleetPosture.posture,
    topGap,
    rankedRoleDemand,
    recommendation,
    pressureScore,
    shouldAutoCreate,
    autoCreateRoles,
    domainTargets,
    domainPackTargets,
    recommendedActions,
  };
}

export function getMissionPatternDefaultSummary(learningMemory = null) {
  const patternDoctrine = learningMemory?.doctrineById?.['doctrine-mission-patterns']
    || learningMemory?.doctrineById?.['mission-pattern-memory']
    || null;
  const winningPattern = patternDoctrine?.metrics?.winningPattern || null;

  if (!winningPattern) {
    return {
      available: false,
      label: 'Pattern defaults still forming',
      detail: 'Commander still needs more repeated mission shapes before it should push one pattern harder into default routing and lane choice.',
      tone: 'slate',
    };
  }

  const confidence = Number(patternDoctrine?.confidence || 0);
  const tone = confidence >= 78 ? 'teal' : confidence >= 60 ? 'amber' : 'blue';

  return {
    available: true,
    winningPattern,
    confidence,
    tone,
    label: `${winningPattern.domain} / ${winningPattern.intentType} is the strongest reusable pattern`,
    detail: `${winningPattern.executionStrategy} with ${winningPattern.approvalLevel} approval is closing ${(winningPattern.completionRate * 100).toFixed(0)}% of ${winningPattern.runs} runs, so Commander should bias defaults toward that shape more aggressively.`,
  };
}

export function getPatternApprovalBiasSummary({ winningPattern = null, routingDecision = null, observedWinningLane = null, batchSignals = null } = {}) {
  if (!winningPattern) {
    return {
      available: false,
      label: 'Approval defaults still forming',
      detail: 'Commander does not have a strong enough repeated mission shape yet to bias approval defaults beyond basic risk rules.',
      recommendedApprovalLevel: routingDecision?.approvalLevel || 'risk_weighted',
      tone: 'slate',
    };
  }

  const patternApproval = winningPattern.approvalLevel || routingDecision?.approvalLevel || 'risk_weighted';
  const confidence = Number(winningPattern.confidence || 0);
  const canLeanOnPattern = confidence >= 72 || Number(winningPattern.runs || 0) >= 4;
  const laneApproval = observedWinningLane?.approvalLevel || null;
  const safeBatchApprovals = Number(batchSignals?.actionCounts?.approve || 0);
  const batchRescuePressure = Number(batchSignals?.actionCounts?.retry || 0) + Number(batchSignals?.actionCounts?.redirect || 0) + Number(batchSignals?.actionCounts?.stop || 0);
  const strongBatchApprovalSignal = Number(batchSignals?.totalActions || 0) >= 2 && Number(batchSignals?.safeApproveRate || 0) >= 60 && safeBatchApprovals > batchRescuePressure;
  const strongBatchRescueSignal = batchRescuePressure >= 2 && batchRescuePressure >= safeBatchApprovals;
  let recommendedApprovalLevel = laneApproval === 'human_required' || patternApproval === 'human_required'
    ? 'human_required'
    : canLeanOnPattern
      ? patternApproval
      : routingDecision?.approvalLevel || patternApproval;
  let detail = `${winningPattern.executionStrategy} with ${patternApproval} approval is the strongest repeating shape across ${winningPattern.runs} runs, so Commander should bias this mission family toward ${recommendedApprovalLevel}.`;

  if (routingDecision?.riskLevel !== 'high') {
    if (strongBatchApprovalSignal && recommendedApprovalLevel === 'risk_weighted') {
      recommendedApprovalLevel = 'auto_low_risk';
      detail = `${detail} Grouped approvals are landing safely across ${batchSignals.totalBranches} recent branches, so low-risk repeats can lean toward auto_low_risk posture.`;
    } else if (strongBatchRescueSignal && recommendedApprovalLevel === 'auto_low_risk') {
      recommendedApprovalLevel = 'risk_weighted';
      detail = `${detail} Grouped retries and redirects are still exposing brittle clusters, so Commander should pull this mission family back to risk_weighted review.`;
    } else if (strongBatchRescueSignal && recommendedApprovalLevel === 'risk_weighted') {
      recommendedApprovalLevel = 'human_required';
      detail = `${detail} Grouped retries and redirects are recurring often enough that Commander should temporarily harden this mission family back to human_required review.`;
    }
  }
  const tone = recommendedApprovalLevel === 'human_required'
    ? 'amber'
    : recommendedApprovalLevel === 'auto_low_risk'
      ? 'teal'
      : 'blue';

  return {
    available: true,
    label: `${winningPattern.domain} / ${winningPattern.intentType} approval default`,
    detail,
    recommendedApprovalLevel,
    tone,
    confidence,
  };
}

export function getRecurringTrustRailSummary({ candidate = null, doctrine = [], learningMemory = null } = {}) {
  const doctrineDeltas = getDoctrineDeltaSummary(doctrine).slice(0, 2);
  const patternSummary = getMissionPatternDefaultSummary(learningMemory);
  const trustSummary = getRecurringAutonomyTuningSummary(candidate);

  return {
    doctrineDeltas,
    patternSummary,
    trustSummary,
  };
}

export function getRecurringAutonomyTuningSummary(candidate = null) {
  if (!candidate) {
    return {
      posture: 'forming',
      recommendedMissionMode: 'watch_and_approve',
      recommendedApprovalPosture: 'risk_weighted',
      recommendedFrequency: 'weekly',
      recommendedPaused: false,
      recoveryLabel: 'No trust recovery signal yet',
      recoveryProgress: 18,
      recoveryStage: 'forming',
      recoveryProgressLabel: 'Commander is still building enough runtime trust memory to judge recovery honestly.',
      earnedAutonomy: false,
      recoveryUpgradeLabel: 'Commander is not ready to relax this flow yet.',
      actionLabel: 'Keep this in supervised automation',
      detail: 'Commander still needs enough runtime memory before it should loosen recurring autonomy safely.',
      reasons: [],
    };
  }

  const rescuePressure = Number(candidate.rescueCount || 0);
  const guardrailPressure = Number(candidate.guardrailCount || 0);
  const tuningPressure = Number(candidate.tuningCount || 0);
  const maturityScore = Number(candidate.maturityScore || 0);
  const trustLabel = String(candidate.trustLabel || '');
  const avgOutcome = Number(candidate.avgOutcome || 0);
  const launchBrief = candidate.launchBrief || null;
  const briefVerification = String(launchBrief?.verificationRequirement || 'lightweight');
  const underVerifiedBrief = Boolean(launchBrief) && briefVerification === 'lightweight' && avgOutcome > 0 && avgOutcome < 70;
  const verificationHolding = Boolean(launchBrief) && ['human_gate', 'verifier_branch'].includes(briefVerification) && avgOutcome >= 72 && maturityScore >= 68;
  const lowTrust = trustLabel === 'Fragile' || maturityScore < 48;
  const watchTrust = trustLabel === 'Watch' || maturityScore < 72;

  let posture = 'stable';
  let recommendedMissionMode = 'do_now';
  let recommendedApprovalPosture = 'auto_low_risk';
  let recommendedFrequency = 'daily';
  let recommendedPaused = false;
  let recoveryLabel = 'Trust posture is still forming.';
  let recoveryProgress = 24;
  let recoveryStage = 'forming';
  let recoveryProgressLabel = 'Commander is still gathering enough runtime evidence to score recovery cleanly.';
  let earnedAutonomy = false;
  let recoveryUpgradeLabel = 'Commander should keep this flow supervised until the recovery signal is stronger.';
  let actionLabel = 'This recurring flow can carry more autonomy';

  if (lowTrust || rescuePressure >= 2 || guardrailPressure >= 2 || avgOutcome < 58 || underVerifiedBrief) {
    posture = 'tighten';
    recommendedMissionMode = 'watch_and_approve';
    recommendedApprovalPosture = rescuePressure >= 3 || guardrailPressure >= 3 ? 'human_required' : 'risk_weighted';
    recommendedFrequency = 'weekly';
    recommendedPaused = rescuePressure >= 4 || guardrailPressure >= 4 || avgOutcome < 40;
    recoveryProgress = recommendedPaused ? 12 : 36;
    recoveryStage = recommendedPaused ? 'paused' : 'recovering';
    recoveryLabel = recommendedPaused
      ? 'Flow needs a clean recovery window before it should unpause.'
      : 'Flow needs cleaner runtime history before it can loosen posture again.';
    recoveryProgressLabel = recommendedPaused
      ? 'Recovery progress is still too weak for autonomous runs. Commander should keep this paused and wait for a clean restart window.'
      : 'Recovery is underway, but the flow still needs cleaner outcomes before Commander should loosen posture.';
    recoveryUpgradeLabel = recommendedPaused
      ? 'This flow has not earned autonomy back yet.'
      : 'Recovery is visible, but Commander should not upgrade posture until a few cleaner runs land.';
    actionLabel = recommendedPaused ? 'Pause this recurring flow until it is stable again' : 'Tighten autonomy posture before this scales';
    if (underVerifiedBrief) {
      recommendedApprovalPosture = 'human_required';
      recommendedFrequency = 'weekly';
      recoveryLabel = 'Saved launch verification is too light for the quality this flow is returning.';
      recoveryProgressLabel = 'Commander should harden cadence and approval until the saved launch brief stops under-verifying this recurring work.';
      recoveryUpgradeLabel = 'Do not loosen this flow until the saved verification standard and runtime quality align.';
      actionLabel = 'Harden recurring verification posture before scaling';
    }
  } else if (watchTrust || tuningPressure >= 2 || avgOutcome < 72) {
    posture = 'watch';
    recommendedMissionMode = 'plan_first';
    recommendedApprovalPosture = 'risk_weighted';
    recommendedFrequency = Number(candidate.runs || 0) >= 5 && avgOutcome >= 66 ? 'daily' : 'weekly';
    recoveryProgress = 68;
    recoveryStage = 'recovering';
    recoveryLabel = 'One or two clean runs should be enough to graduate this back toward fuller autonomy.';
    recoveryProgressLabel = 'Recovery is moving in the right direction. Commander is close to letting this flow earn autonomy back.';
    recoveryUpgradeLabel = 'One or two cleaner runs should be enough for Commander to relax this flow again.';
    actionLabel = 'Keep this in managed review posture';
  } else {
    recommendedFrequency = Number(candidate.runs || 0) >= 4 ? 'daily' : 'weekly';
    recoveryProgress = 96;
    recoveryStage = 'ready';
    recoveryLabel = 'Runtime history is clean enough that this flow can safely earn autonomy back.';
    recoveryProgressLabel = 'This flow has recovered enough that Commander can trust it with a lighter posture again.';
    earnedAutonomy = true;
    recoveryUpgradeLabel = 'Commander can now safely let this flow reclaim a lighter mission and approval posture.';
    if (verificationHolding) {
      recommendedApprovalPosture = 'auto_low_risk';
      recommendedMissionMode = 'do_now';
      actionLabel = 'Saved verification is holding cleanly, so this recurring flow can scale with lighter supervision';
    }
  }

  const reasons = [
    rescuePressure > 0 ? `${rescuePressure} rescue intervention${rescuePressure === 1 ? '' : 's'} landed on this flow.` : null,
    guardrailPressure > 0 ? `${guardrailPressure} recurring guardrail${guardrailPressure === 1 ? '' : 's'} already triggered on this flow.` : null,
    tuningPressure > 0 ? `${tuningPressure} tuning change${tuningPressure === 1 ? '' : 's'} suggest the workflow is still settling.` : null,
    avgOutcome > 0 ? `Average runtime quality is ${avgOutcome}.` : null,
    launchBrief ? `Saved launch brief expects ${briefVerification.replaceAll('_', ' ')} verification for ${launchBrief.domain}/${launchBrief.intentType}.` : null,
  ].filter(Boolean);

  let detail = posture === 'tighten'
    ? 'Runtime trust is drifting enough that Commander should raise the human bar and slow the automation down before it creates more cleanup.'
    : posture === 'watch'
      ? 'Economics are promising, but runtime memory still says this flow should stay in a managed planning posture for now.'
      : 'This recurring flow is holding cleanly enough that Commander can let it run with a lighter approval posture.';

  if (launchBrief) {
    if (briefVerification === 'lightweight' && avgOutcome > 0 && avgOutcome < 70) {
      detail = `${detail} The saved launch brief is still under-verified for the quality this recurring flow is returning, so Commander should keep cadence and approval tighter until that closes.`;
    } else if (avgOutcome >= 72) {
      detail = `${detail} The saved launch brief for ${launchBrief.domain}/${launchBrief.intentType} is holding against runtime quality, which makes this recurring posture easier to trust.`;
    }
  }

  return {
    posture,
    recommendedMissionMode,
    recommendedApprovalPosture,
    recommendedFrequency,
    recommendedPaused,
    recoveryLabel,
    recoveryProgress,
    recoveryStage,
    recoveryProgressLabel,
    earnedAutonomy,
    recoveryUpgradeLabel,
    actionLabel,
    detail,
    reasons,
    launchBrief,
  };
}

export function getPreflightAlignmentSummary({
  tasks = [],
  routingDecision = {},
  missionSummary = {},
  estimatedCost = '',
  expectedBranches = 1,
} = {}) {
  const matchingTasks = tasks.filter((task) => {
    const domainMatch = !routingDecision.domain || task.domain === routingDecision.domain;
    const intentMatch = !routingDecision.intentType || task.intentType === routingDecision.intentType;
    return domainMatch && intentMatch;
  });

  if (matchingTasks.length === 0) {
    return {
      posture: 'forming',
      label: 'No runtime baseline yet',
      detail: 'Commander is still estimating this launch because there is not enough matching runtime history to compare against.',
      branchDelta: null,
      costDelta: null,
      sampleCount: 0,
    };
  }

  const missionsByRoot = matchingTasks.reduce((acc, task) => {
    const key = task.rootMissionId || task.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});
  const missionGroups = Object.values(missionsByRoot);
  const avgBranches = missionGroups.length
    ? missionGroups.reduce((sum, group) => sum + group.length, 0) / missionGroups.length
    : 1;
  const avgCost = matchingTasks.reduce((sum, task) => sum + Number(task.costUsd || 0), 0) / matchingTasks.length;
  const avgRuntimeConfidence = matchingTasks.length
    ? Math.round(matchingTasks.reduce((sum, task) => sum + scoreTaskOutcome(task).score, 0) / matchingTasks.length)
    : 0;
  const estimatedCostMid = parseCostRangeToMidpoint(estimatedCost);
  const branchDelta = Number((expectedBranches - avgBranches).toFixed(1));
  const costDelta = Number((estimatedCostMid - avgCost).toFixed(2));
  const confidenceDelta = Number((Number(missionSummary.confidence || 0) - avgRuntimeConfidence).toFixed(0));
  const posture = Math.abs(branchDelta) <= 0.75 && Math.abs(costDelta) <= 0.75
    ? 'aligned'
    : Math.abs(branchDelta) <= 1.5 && Math.abs(costDelta) <= 1.25
      ? 'close'
      : 'drifting';
  const label = posture === 'aligned'
    ? 'Preflight matches runtime'
    : posture === 'close'
      ? 'Preflight is directionally right'
      : 'Preflight is drifting from runtime';
  const detail = posture === 'aligned'
    ? `Matching missions are landing close to this plan, so Commander can trust the current briefing with relatively little caution.`
    : posture === 'close'
      ? `Matching missions are close enough that the briefing is useful, but the estimate should still be treated as soft guidance.`
      : `Recent matching missions are landing far enough from this estimate that Commander should flag the preflight as a planning guess, not a strong promise.`;
  const confidencePosture = confidenceDelta >= 12
    ? 'overconfident'
    : confidenceDelta <= -12
      ? 'underselling'
      : 'grounded';
  const confidenceLabel = confidencePosture === 'overconfident'
    ? 'Confidence is optimistic'
    : confidencePosture === 'underselling'
      ? 'Confidence is conservative'
      : 'Confidence is grounded';
  const confidenceDetail = confidencePosture === 'overconfident'
    ? `Launch confidence is running ${confidenceDelta} points above recent runtime quality for similar missions, so Commander should frame this as an estimate, not a promise.`
    : confidencePosture === 'underselling'
      ? `Launch confidence is ${Math.abs(confidenceDelta)} points below recent runtime quality, so this mission may be safer than the briefing suggests.`
      : 'Recent runtime quality is close enough to the preflight confidence that the briefing is reading honestly.';

  return {
    posture,
    label,
    detail,
    branchDelta,
    costDelta,
    sampleCount: matchingTasks.length,
    confidence: missionSummary.confidence || 0,
    runtimeConfidence: avgRuntimeConfidence,
    confidenceDelta,
    confidencePosture,
    confidenceLabel,
    confidenceDetail,
  };
}

export function getAutomationCandidates(tasks = [], humanHourlyRate = 150, interventions = [], outcomes = []) {
  const grouped = new Map();
  const normalizedInterventions = normalizeInterventionEvents(interventions, []);

  tasks.forEach((task) => {
    const key = `${task.domain || 'general'}::${task.intentType || 'general'}::${task.name || task.title || 'mission'}`;
    const current = grouped.get(key) || {
      key,
      title: task.name || task.title || 'Mission',
      domain: task.domain || 'general',
      intentType: task.intentType || 'general',
      runs: 0,
      totalCost: 0,
      totalDurationMs: 0,
      automatedRuns: 0,
      rootMissionIds: new Set(),
      latestTask: null,
    };
    current.runs += 1;
    current.totalCost += Number(task.costUsd || 0);
    current.totalDurationMs += Number(task.durationMs || 0);
    if (task.intentType === 'automation' || task.scheduleType === 'recurring') current.automatedRuns += 1;
    if (task.rootMissionId || task.id) current.rootMissionIds.add(task.rootMissionId || task.id);
    const currentLatestAt = new Date(current.latestTask?.updatedAt || current.latestTask?.createdAt || 0).getTime();
    const nextLatestAt = new Date(task.updatedAt || task.createdAt || 0).getTime();
    if (!current.latestTask || nextLatestAt >= currentLatestAt) {
      current.latestTask = task;
    }
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .filter((entry) => entry.runs >= 2)
    .map((entry) => {
      const rootMissionIds = [...entry.rootMissionIds];
      const relatedInterventions = normalizedInterventions.filter((item) => rootMissionIds.includes(item.rootMissionId || item.taskId));
      const orderedRecurringInterventions = relatedInterventions
        .filter((item) => item.scheduleType === 'recurring' && ['tuning', 'guardrail'].includes(String(item.eventType || '').toLowerCase()))
        .sort((left, right) => new Date(right.createdAt || right.timestamp || 0).getTime() - new Date(left.createdAt || left.timestamp || 0).getTime());
      const relatedOutcomes = outcomes.filter((item) => rootMissionIds.includes(item.rootMissionId || item.taskId));
      const rescueCount = relatedInterventions.filter((item) => ['stop', 'cancel', 'retry'].includes(item.eventType)).length;
      const guardrailCount = relatedInterventions.filter((item) => item.eventType === 'guardrail').length;
      const tuningCount = relatedInterventions.filter((item) => item.scheduleType === 'recurring' && item.eventType === 'tuning').length;
      const avgOutcome = relatedOutcomes.length
        ? Math.round(relatedOutcomes.reduce((sum, item) => sum + Number(item.score || 0), 0) / relatedOutcomes.length)
        : 0;
      const avgCost = entry.totalCost / entry.runs;
      const estimatedHours = entry.totalDurationMs > 0 ? entry.totalDurationMs / 3_600_000 : entry.runs * 0.25;
      const humanEquivalent = estimatedHours * humanHourlyRate;
      const roi = avgCost > 0 ? humanEquivalent / Math.max(entry.totalCost, 0.01) : humanEquivalent;
      const repetitionScore = entry.runs * 12;
      const trustPenalty = (rescueCount * 12) + (guardrailCount * 8) + (tuningCount * 4);
      const outcomeBoost = avgOutcome > 0 ? Math.round((avgOutcome - 50) / 2) : 0;
      const automationScore = Math.round(clamp(repetitionScore + Math.min(35, roi * 8) + (entry.automatedRuns === 0 ? 10 : 0) + outcomeBoost - trustPenalty, 0, 100));
      const maturityScore = Math.round(clamp((entry.runs * 10) + (avgOutcome > 0 ? (avgOutcome - 40) : 0) - (guardrailCount * 10) - (rescueCount * 14), 0, 100));
      const trustLabel = maturityScore >= 72
        ? 'Stable'
        : maturityScore >= 50
          ? 'Watch'
          : 'Fragile';
      const launchBrief = getMissionCreateBrief(relatedInterventions);
      const launchBriefFit = !launchBrief
        ? 'forming'
        : Number(avgOutcome || 0) >= 72
          ? 'holding'
          : Number(avgOutcome || 0) >= 58
            ? 'watch'
            : 'drifting';
      let trustDetail = maturityScore >= 72
        ? 'This recurring pattern is proving itself with enough clean runtime history to scale more confidently.'
        : maturityScore >= 50
          ? 'The economics are promising, but guardrails or rescue pressure still justify a tighter posture.'
          : 'Runtime memory is still noisy here, so keep cadence and approval posture conservative until the flow hardens.';
      if (launchBrief) {
        trustDetail = launchBriefFit === 'holding'
          ? `${trustDetail} The saved launch brief for ${launchBrief.domain}/${launchBrief.intentType} is holding against recent outcomes.`
          : launchBriefFit === 'watch'
            ? `${trustDetail} The saved launch brief is directionally right, but Commander should keep this under review until verification and outcomes line up more cleanly.`
            : `${trustDetail} The saved launch brief is drifting from runtime quality, so Commander should tighten cadence or approval before scaling this recurring flow.`;
      }
      const recurringChangeHistory = orderedRecurringInterventions.slice(0, 4).map((item) => ({
        id: item.id,
        eventType: item.eventType,
        timestamp: item.createdAt || item.timestamp || null,
        summary: item.eventType === 'tuning'
          ? `Saved ${humanizeUnderscoreValue(item.metadata?.frequency || 'weekly')} cadence, ${humanizeUnderscoreValue(item.metadata?.missionMode || 'watch_and_approve')} mode, ${humanizeUnderscoreValue(item.metadata?.approvalPosture || 'risk_weighted')} approval, ${item.metadata?.paused ? 'paused' : 'active'} state.`
          : `${Array.isArray(item.metadata?.guardrails) ? item.metadata.guardrails.join(' ') : item.message || 'Recurring guardrails adjusted the saved posture.'}`,
        message: item.message || '',
      }));
      return {
        ...entry,
        avgCost,
        estimatedHours,
        humanEquivalent,
        roi,
        automationScore,
        maturityScore,
        avgOutcome,
        rescueCount,
        guardrailCount,
        tuningCount,
        trustLabel,
        trustDetail,
        launchBrief,
        launchBriefFit,
        latestTaskId: entry.latestTask?.id || null,
        latestTaskName: entry.latestTask?.title || entry.latestTask?.name || entry.title,
        currentRecurrenceRule: entry.latestTask?.recurrenceRule || null,
        currentMissionMode: entry.latestTask?.recurrenceRule?.missionMode
          || (entry.latestTask?.requiresApproval ? 'watch_and_approve' : 'do_now'),
        currentApprovalPosture: entry.latestTask?.recurrenceRule?.approvalPosture
          || entry.latestTask?.approvalLevel
          || 'risk_weighted',
        currentPaused: entry.latestTask?.recurrenceRule?.paused
          ?? (String(entry.latestTask?.status || '').toLowerCase() === 'paused'),
        latestTuningEvent: orderedRecurringInterventions.find((item) => item.eventType === 'tuning') || null,
        latestGuardrailEvent: orderedRecurringInterventions.find((item) => item.eventType === 'guardrail') || null,
        recurringChangeHistory,
      };
    })
    .sort((left, right) => {
      if (right.automationScore !== left.automationScore) return right.automationScore - left.automationScore;
      return right.runs - left.runs;
    })
    .slice(0, 6);
}

export function getAutonomyMetrics(tasks = [], interventions = [], logs = []) {
  const normalizedInterventions = normalizeInterventionEvents(interventions, logs);
  const runnableTasks = tasks.filter((task) => !['cancelled'].includes(String(task.status || '').toLowerCase()));
  const completedTasks = runnableTasks.filter((task) => isTaskClosed(task));
  const missionIds = completedTasks.map((task) => task.rootMissionId || task.id).filter(Boolean);
  const uniqueMissionIds = [...new Set(missionIds)];
  const interventionByMission = new Map();

  normalizedInterventions.forEach((entry) => {
    const key = entry.rootMissionId || entry.taskId;
    if (!key) return;
    const current = interventionByMission.get(key) || { total: 0, rescue: 0, reroute: 0, approval: 0, retry: 0 };
    current.total += 1;
    if (['stop', 'cancel'].includes(entry.eventType)) current.rescue += 1;
    if (['reroute', 'dependency'].includes(entry.eventType)) current.reroute += 1;
    if (['approve', 'guardrail'].includes(entry.eventType)) current.approval += 1;
    if (entry.eventType === 'retry') current.retry += 1;
    interventionByMission.set(key, current);
  });

  const cleanAutonomousMissions = uniqueMissionIds.filter((missionId) => {
    const pressure = interventionByMission.get(missionId);
    return !pressure || pressure.total === 0;
  }).length;
  const rescueTouchedMissions = uniqueMissionIds.filter((missionId) => {
    const pressure = interventionByMission.get(missionId);
    return pressure && (pressure.rescue > 0 || pressure.reroute > 0 || pressure.retry > 0);
  }).length;
  const approvalTouchedMissions = uniqueMissionIds.filter((missionId) => {
    const pressure = interventionByMission.get(missionId);
    return pressure && pressure.approval > 0;
  }).length;

  const totalMissions = Math.max(uniqueMissionIds.length, completedTasks.length, 1);
  const autonomyRatio = Math.round((cleanAutonomousMissions / totalMissions) * 100);
  const rescueRate = Math.round((rescueTouchedMissions / totalMissions) * 100);
  const approvalRate = Math.round((approvalTouchedMissions / totalMissions) * 100);
  const state = autonomyRatio >= 70 && rescueRate <= 15
    ? 'self-driving'
    : autonomyRatio >= 45
      ? 'assisted'
      : 'gated';

  return {
    totalMissions,
    autonomyRatio,
    rescueRate,
    approvalRate,
    cleanAutonomousMissions,
    rescueTouchedMissions,
    approvalTouchedMissions,
    state,
    label: state === 'self-driving' ? 'Self-driving' : state === 'assisted' ? 'Assisted' : 'Gate-heavy',
    detail: state === 'self-driving'
      ? 'Most completed work is closing without rescue or human gates.'
      : state === 'assisted'
        ? 'Commander is moving work, but human intervention is still shaping enough of the result to matter.'
        : 'Too much of the finished work still needs rescue, approval, or rerouting to call the machine self-driving.',
  };
}

export function getPrimaryBottleneck({ tasks = [], reviews = [], schedules = [], agents = [], interventions = [], logs = [], costData = null }) {
  const normalizedInterventions = normalizeInterventionEvents(interventions, logs);
  const recurringBriefFit = getRecurringBriefFitSummary(tasks, normalizedInterventions, []);
  const launchReadinessPressure = getLaunchReadinessPressure(normalizedInterventions);
  const missionGraph = getMissionGraphSummary(tasks);
  const graphContractPressure = getGraphContractPressureSummary(tasks, normalizedInterventions);
  const failedTasks = tasks.filter((task) => isTaskFailed(task)).length;
  const pendingApprovals = reviews.length;
  const lateSchedules = schedules.filter((job) => job.status === 'active' && job.nextRunAt && new Date(job.nextRunAt).getTime() < Date.now()).length;
  const stalledAgents = agents.filter((agent) => {
    if (!agent.lastHeartbeat) return false;
    const age = Date.now() - new Date(agent.lastHeartbeat).getTime();
    return age > 10 * 60 * 1000 && agent.status !== 'idle';
  }).length;
  const reroutePressure = normalizedInterventions.filter((entry) => ['reroute', 'dependency'].includes(entry.eventType)).length;
  const rescuePressure = normalizedInterventions.filter((entry) => ['stop', 'cancel', 'retry'].includes(entry.eventType)).length;
  const guardrailPressure = normalizedInterventions.filter((entry) => entry.eventType === 'guardrail').length;
  const topSpend = Array.isArray(costData?.models) ? Number(costData.models[0]?.cost || 0) : 0;

  const candidates = [
    {
      key: 'graph',
      score: (missionGraph.blockedCount * 12)
        + (missionGraph.heldCount * 6)
        + (graphContractPressure.releaseChainCount * 9)
        + (graphContractPressure.guardedSerializedCount * 7)
        + (graphContractPressure.safeParallelCount * 2),
      title: graphContractPressure.available ? graphContractPressure.title : missionGraph.available ? missionGraph.title : 'Mission graph pressure is still forming',
      detail: graphContractPressure.available
        ? `${graphContractPressure.detail}${missionGraph.available ? ` ${missionGraph.detail}` : ''}`
        : missionGraph.available
          ? missionGraph.detail
          : 'Commander still needs more graph state before dependency pressure can be ranked cleanly.',
      action: graphContractPressure.available
        ? graphContractPressure.nextMove
        : missionGraph.blockedCount > 0
          ? 'Clear the blocked branch first so downstream work can release.'
          : missionGraph.heldCount > 0
            ? 'Finish the upstream lane or approval gate that is holding the graph.'
            : 'Keep the released branches moving while the graph is still clean.',
      tone: graphContractPressure.available ? graphContractPressure.tone : missionGraph.blockedCount > 0 ? 'rose' : missionGraph.heldCount > 0 ? 'amber' : 'teal',
    },
    {
      key: 'approvals',
      score: pendingApprovals * 10,
      title: pendingApprovals > 0 ? `${pendingApprovals} approvals are the main choke point` : 'Approval drag is contained',
      detail: pendingApprovals > 0
        ? 'Human decisions are the first thing slowing throughput right now.'
        : 'No meaningful human approval queue is visible.',
      action: 'Clear or bundle low-risk approvals first.',
      tone: pendingApprovals > 0 ? 'amber' : 'teal',
    },
    {
      key: 'recovery',
      score: (failedTasks * 9) + (stalledAgents * 8),
      title: failedTasks + stalledAgents > 0 ? 'Recovery work is stealing throughput' : 'Recovery pressure is low',
      detail: failedTasks + stalledAgents > 0
        ? `${failedTasks} failed tasks and ${stalledAgents} stalled agents are forcing recovery before scale.`
        : 'No major failure or stalled-agent cluster is visible.',
      action: 'Stabilize the weak branches before adding more volume.',
      tone: failedTasks + stalledAgents > 0 ? 'rose' : 'teal',
    },
    {
      key: 'intervention',
      score: (reroutePressure * 5) + (rescuePressure * 7) + (guardrailPressure * 4),
      title: reroutePressure + rescuePressure + guardrailPressure > 0 ? 'Human rescue pressure is still high' : 'Intervention pressure is light',
      detail: reroutePressure + rescuePressure + guardrailPressure > 0
        ? `${reroutePressure} reroutes, ${rescuePressure} rescue events, and ${guardrailPressure} guardrails are still shaping results.`
        : 'The recent mission set is holding without much human rescue.',
      action: 'Demote brittle lanes and tighten recurring posture.',
      tone: reroutePressure + rescuePressure + guardrailPressure > 0 ? 'blue' : 'teal',
    },
    {
      key: 'automation',
      score: (lateSchedules * 8) + (recurringBriefFit.driftingCount * 9) + (recurringBriefFit.watchCount * 4),
      title: recurringBriefFit.driftingCount > 0
        ? 'Recurring brief-fit drift is weakening automation trust'
        : lateSchedules > 0
          ? 'Automation timing drift is visible'
          : 'Automation timing is healthy',
      detail: recurringBriefFit.driftingCount > 0
        ? recurringBriefFit.detail
        : lateSchedules > 0
          ? `${lateSchedules} recurring flows are behind schedule, which weakens trust in self-driving execution.`
          : 'Recurring flows are not visibly behind schedule.',
      action: recurringBriefFit.driftingCount > 0
        ? 'Tighten recurring verification and cadence before scaling automation.'
        : 'Reset schedule drift before launching more automation.',
      tone: recurringBriefFit.driftingCount > 0 || lateSchedules > 0 ? 'amber' : 'teal',
    },
    {
      key: 'connectors',
      score: launchReadinessPressure.score,
      title: launchReadinessPressure.available ? launchReadinessPressure.title : 'Connector readiness pressure is low',
      detail: launchReadinessPressure.detail,
      action: 'Reconnect missing systems or reroute work away from degraded connector lanes before scaling.',
      tone: launchReadinessPressure.tone,
    },
    {
      key: 'spend',
      score: topSpend >= 10 ? Math.round(topSpend) : 0,
      title: topSpend >= 10 ? 'One expensive lane is dominating spend' : 'Spend concentration is manageable',
      detail: topSpend >= 10
        ? `The hottest model lane is burning $${topSpend.toFixed(2)}, so economics need attention.`
        : 'No single lane is dominating AI spend yet.',
      action: 'Route routine work down-stack and keep premium lanes for ambiguity.',
      tone: topSpend >= 10 ? 'violet' : 'teal',
    },
  ];

  return candidates.sort((left, right) => right.score - left.score)[0];
}

export function getCommanderNextMove({ tasks = [], reviews = [], schedules = [], agents = [], interventions = [], logs = [], approvalAudit = [], costData = null, learningMemory = null } = {}) {
  const normalizedInterventions = normalizeInterventionEvents(interventions, logs);
  const hybridApproval = getHybridApprovalSummary({ tasks, reviews, interventions: normalizedInterventions, approvalAudit });
  const failureTriage = getFailureTriageSummary({ tasks, interventions: normalizedInterventions, logs });
  const executionAudit = getExecutionAuditReadback({ tasks, interventions: normalizedInterventions, approvalAudit, logs, limit: 3 });
  const missionDispatch = getMissionDispatchPressureSummary(tasks);
  const graphContractPressure = getGraphContractPressureSummary(tasks, normalizedInterventions);
  const groupedConnectorBlockers = getGroupedConnectorBlockers(tasks, normalizedInterventions);
  const branchConnectorPressure = getBranchConnectorPressureSummary(tasks, normalizedInterventions);
  const primaryBottleneck = getPrimaryBottleneck({ tasks, reviews, schedules, agents, interventions: normalizedInterventions, logs, costData });
  const approvalDoctrine = learningMemory?.doctrineById?.['hybrid-approval-memory'] || null;
  const failureDoctrine = learningMemory?.doctrineById?.['failure-triage-memory'] || null;
  const auditDoctrine = learningMemory?.doctrineById?.['execution-audit-memory'] || null;

  const candidates = [];

  if (failureTriage.available && failureTriage.failedCount > 0) {
    candidates.push({
      key: 'failure',
      priority: 100,
      title: failureTriage.title,
      detail: `${failureTriage.detail} Verdict: ${failureTriage.verdict}.`,
      nextMove: failureTriage.nextMove,
      tone: 'rose',
      source: 'failure_triage',
      actionLabel: 'Run top triage order',
      opsPrompt: failureDoctrine
        ? `Stabilize the highest-pressure failed branch first. Follow the current triage doctrine and decide whether to retry, reroute, or hold for approval. Context: ${failureDoctrine.detail}`
        : `Stabilize the highest-pressure failed branch first. Decide whether to retry, reroute, or hold for approval. Context: ${failureTriage.detail}`,
    });
  }

  if (groupedConnectorBlockers.topGroup?.affectedCount > 1) {
    const groupedFix = groupedConnectorBlockers.topGroup;
    candidates.push({
      key: 'connectors',
      priority: groupedFix.tone === 'rose' ? 92 : 82,
      title: groupedFix.title,
      detail: groupedFix.detail,
      nextMove: groupedFix.order,
      tone: groupedFix.tone,
      source: 'grouped_connector_blocker',
      actionLabel: 'Stage grouped connector fix',
      connectorActionBrief: buildConnectorActionDraft(groupedFix.correctiveAction, {
        title: groupedFix.title,
        connectorLabel: groupedFix.connectorLabel,
        affectedBranches: groupedFix.affectedBranches.map((branch) => branch.title),
      })?.connectorActionBrief || null,
      opsPrompt: groupedFix.opsPrompt,
    });
  } else if (branchConnectorPressure.available && branchConnectorPressure.score > 0 && branchConnectorPressure.topCorrectiveAction?.detail) {
    candidates.push({
      key: 'connectors',
      priority: branchConnectorPressure.tone === 'rose' ? 88 : 76,
      title: branchConnectorPressure.title,
      detail: branchConnectorPressure.detail,
      nextMove: branchConnectorPressure.topCorrectiveAction.detail,
      tone: branchConnectorPressure.tone,
      source: 'connector_branch_pressure',
      actionLabel: branchConnectorPressure.topCorrectiveAction.label || 'Stage connector fix',
      opsPrompt: branchConnectorPressure.topCorrectiveAction.opsPrompt || null,
    });
  }

  if (graphContractPressure.available) {
    const graphDispatchDraft = buildDispatchActionDraft({
      available: graphContractPressure.available,
      title: graphContractPressure.title,
      detail: graphContractPressure.detail,
      nextMove: graphContractPressure.nextMove,
      tone: graphContractPressure.tone,
      topTask: graphContractPressure.topEntry,
      safeParallelCount: graphContractPressure.safeParallelCount,
      serializedCount: graphContractPressure.serializedCount,
      heldUpstreamCount: graphContractPressure.releaseChainCount,
    });
    candidates.push({
      key: 'graph_contract',
      priority: graphContractPressure.orderMode === 'clear_release_chain'
        ? 86
        : graphContractPressure.orderMode === 'keep_guarded_lane_serialized'
          ? 74
          : graphContractPressure.orderMode === 'widen_safe_parallel'
            ? 58
            : 54,
      title: graphContractPressure.title,
      detail: graphContractPressure.detail,
      nextMove: graphContractPressure.nextMove,
      tone: graphContractPressure.tone,
      source: 'graph_contract',
      actionLabel: 'Follow graph contract',
      dispatchActionBrief: graphDispatchDraft?.dispatchActionBrief || null,
      opsPrompt: `Use the persisted mission graph contract to follow the safest runtime order. ${graphContractPressure.detail} Next move: ${graphContractPressure.nextMove}.`,
    });
  }

  if (missionDispatch.available && (missionDispatch.heldUpstreamCount > 0 || missionDispatch.serializedCount > 0)) {
    candidates.push({
      key: 'dispatch',
      priority: missionDispatch.heldUpstreamCount > 0 ? 84 : 72,
      title: missionDispatch.title,
      detail: missionDispatch.detail,
      nextMove: missionDispatch.nextMove,
      tone: missionDispatch.tone,
      source: 'dispatch_pressure',
      actionLabel: 'Follow dispatch order',
      dispatchActionBrief: buildDispatchActionDraft(missionDispatch)?.dispatchActionBrief || null,
      opsPrompt: `Use the live mission graph to follow the safest dispatch order. ${missionDispatch.detail} Next move: ${missionDispatch.nextMove}`,
    });
  }

  if (hybridApproval.available && hybridApproval.totalQueue > 0) {
    candidates.push({
      key: 'approvals',
      priority: hybridApproval.totalQueue > 2 ? 80 : 68,
      title: hybridApproval.title,
      detail: hybridApproval.detail,
      nextMove: 'clear_or_bundle_low_risk_approvals',
      tone: 'amber',
      source: 'hybrid_approval',
      actionLabel: 'Clear low-risk approvals',
      opsPrompt: approvalDoctrine
        ? `Review the approval queue and clear or bundle the lightest gates first. Use this control context: ${approvalDoctrine.detail}`
        : `Review the live approval queue and clear or bundle the lightest gates first. Context: ${hybridApproval.detail}`,
    });
  }

  if (executionAudit.available && executionAudit.entries[0]?.nextMove) {
    candidates.push({
      key: 'audit',
      priority: 60,
      title: executionAudit.title,
      detail: executionAudit.entries[0].detail || executionAudit.detail,
      nextMove: executionAudit.entries[0].nextMove,
      tone: executionAudit.entries[0].tone || 'blue',
      source: 'execution_audit',
      actionLabel: 'Follow audit order',
      opsPrompt: auditDoctrine?.metrics?.latestNextMove
        ? `Follow the latest execution-control order: ${String(auditDoctrine.metrics.latestNextMove).replaceAll('_', ' ')}. Use the current audit trail to decide the shortest safe next move. Context: ${auditDoctrine.detail}`
        : `Review the latest execution-control trail and follow the shortest safe next move. Context: ${executionAudit.entries[0].detail || executionAudit.detail}`,
    });
  }

  const top = candidates.sort((left, right) => right.priority - left.priority)[0] || null;
  if (!top) {
    return {
      available: false,
      title: primaryBottleneck?.title || 'No dominant next move',
      detail: primaryBottleneck?.detail || 'Commander does not see a single dominant action right now.',
      nextMove: primaryBottleneck?.action || 'keep_flowing',
      tone: primaryBottleneck?.tone || 'teal',
      source: primaryBottleneck?.key || 'steady_state',
      actionLabel: null,
      opsPrompt: null,
      dispatchActionBrief: null,
      connectorActionBrief: null,
    };
  }

  return {
    available: true,
    title: top.title,
    detail: top.detail,
    nextMove: humanizeUnderscoreValue(top.nextMove),
    tone: top.tone,
    source: top.source,
    actionLabel: top.actionLabel,
    opsPrompt: top.opsPrompt || null,
    dispatchActionBrief: top.dispatchActionBrief || null,
    connectorActionBrief: top.connectorActionBrief || null,
  };
}
