import { describeTaskTransition } from './missionLifecycle';

const READY_STATUSES = new Set(['connected', 'active', 'online', 'healthy']);
const DEGRADED_STATUSES = new Set(['degraded', 'needs_refresh', 'warning', 'stale']);
const BLOCKED_STATUSES = new Set(['error', 'disconnected', 'offline', 'failed']);
const INTERNAL_CAPABILITY_KEYS = new Set(['code', 'research', 'reporting']);
const PERMISSION_PRIORITY = {
  read: 1,
  draft: 2,
  write: 3,
  sync: 3,
  admin: 4,
};

const APPROVAL_PRIORITY = {
  auto_low_risk: 0,
  risk_weighted: 1,
  human_required: 2,
};

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function buildConnectorOpsPrompt({ connectorLabel, actionLabel, targetRole, targetApprovalPosture, detail, branchTitles = [] }) {
  const lane = targetRole || 'ops';
  const approval = String(targetApprovalPosture || 'risk_weighted').replaceAll('_', ' ');
  const branchContext = branchTitles.length ? `Affected branches: ${branchTitles.join(', ')}.` : 'Affect only the connector-dependent branches that are currently blocked.';
  return `Prepare an operator runbook to ${actionLabel.toLowerCase()} for ${connectorLabel}. ${detail} Use a ${lane} lane with ${approval} approval posture. ${branchContext} Include the fastest safe validation steps, the lowest-risk fallback path, and the exact condition that should block live write execution until the connector lane is healthy again.`;
}

export function normalizeSystemStatus(status = '') {
  const normalized = normalizeText(status);
  if (!normalized) return 'unknown';
  if (READY_STATUSES.has(normalized)) return 'connected';
  if (DEGRADED_STATUSES.has(normalized)) return 'degraded';
  if (BLOCKED_STATUSES.has(normalized)) return 'error';
  return normalized;
}

function humanize(value = '') {
  return String(value || '').replaceAll('_', ' ').trim();
}

function normalizePermissionValue(value = '') {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (normalized.includes('admin')) return 'admin';
  if (normalized.includes('write') || normalized.includes('send') || normalized.includes('post') || normalized.includes('publish')) return 'write';
  if (normalized.includes('draft')) return 'draft';
  if (normalized.includes('sync')) return 'sync';
  if (normalized.includes('read') || normalized.includes('view') || normalized.includes('search')) return 'read';
  return normalized;
}

function getBranchSearchBlob(branch = {}) {
  return normalizeText([
    branch.title,
    branch.branchLabel,
    branch.description,
    branch.agentRole,
    ...(Array.isArray(branch.recommendedSkillNames) ? branch.recommendedSkillNames : []),
  ].join(' '));
}

export function normalizePermissionScope(permissionScope = [], capabilities = []) {
  const normalized = [...permissionScope, ...capabilities]
    .map((entry) => normalizePermissionValue(entry))
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function permissionSatisfies(permissionScope = [], requiredMode = 'read') {
  const requiredPriority = PERMISSION_PRIORITY[normalizePermissionValue(requiredMode) || 'read'] ?? PERMISSION_PRIORITY.read;
  return permissionScope.some((entry) => (PERMISSION_PRIORITY[entry] ?? 0) >= requiredPriority);
}

function getSystemSearchBlob(system = {}) {
  const metadata = system.metadata && typeof system.metadata === 'object'
    ? Object.values(system.metadata).join(' ')
    : '';
  return normalizeText([
    system.integrationKey,
    system.displayName,
    system.category,
    system.identifier,
    ...(Array.isArray(system.capabilities) ? system.capabilities : []),
    ...(Array.isArray(system.permissionScope) ? system.permissionScope : []),
    system.domain,
    system.trustLevel,
    system.riskLevel,
    metadata,
  ].join(' '));
}

function countCovered(coverage = []) {
  return coverage.filter((entry) => entry.covered).length;
}

function buildRequirement({ key, label, reason, aliases = [] }) {
  return { key, label, reason, aliases };
}

function inferRequirementEntries({ payload = {}, routingDecision = {} }) {
  const intent = normalizeText(payload.intent);
  const targetType = normalizeText(payload.targetType);
  const outputType = normalizeText(payload.outputType);
  const contextPackIds = Array.isArray(routingDecision.contextPackIds) ? routingDecision.contextPackIds : [];
  const requiredCapabilities = Array.isArray(routingDecision.requiredCapabilities) ? routingDecision.requiredCapabilities : [];
  const requirements = [];

  if (requiredCapabilities.includes('crm') || targetType.includes('pipedrive') || targetType.includes('crm')) {
    requirements.push(buildRequirement({
      key: 'crm',
      label: 'CRM lane',
      reason: 'Mission needs a live CRM write or sync path.',
      aliases: ['pipedrive', 'hubspot', 'salesforce', 'crm', 'deal', 'person'],
    }));
  }

  if (requiredCapabilities.includes('finance') || /(finance|invoice|budget|revenue|cash|billing)/.test(intent)) {
    requirements.push(buildRequirement({
      key: 'finance',
      label: 'Finance lane',
      reason: 'Mission touches finance-sensitive data or write paths.',
      aliases: ['stripe', 'quickbooks', 'xero', 'finance', 'billing', 'ledger'],
    }));
  }

  if (contextPackIds.includes('ops-telemetry') || /(shipment|tracking|delay|ops|telemetry|logistics)/.test(intent)) {
    requirements.push(buildRequirement({
      key: 'ops',
      label: 'Ops telemetry',
      reason: 'Mission needs live operations or tracking state.',
      aliases: ['ops', 'telemetry', 'tracking', 'shipment', 'shipstation', 'logistics'],
    }));
  }

  const needsExternalComms = /(send|post|publish|notify|slack|gmail|outlook|mailchimp|webhook)/.test(intent)
    || targetType.includes('slack')
    || targetType.includes('email')
    || outputType === 'slack_alerts';
  if (requiredCapabilities.includes('comms') && needsExternalComms) {
    requirements.push(buildRequirement({
      key: 'comms',
      label: 'Comms lane',
      reason: 'Mission needs a connected outbound communications path.',
      aliases: ['slack', 'gmail', 'outlook', 'mail', 'email', 'webhook', 'twilio'],
    }));
  }

  return requirements.filter((entry, index, array) => array.findIndex((candidate) => candidate.key === entry.key) === index);
}

function getRequiredPermissionMode({ capability, requirementKey, payload = {} }) {
  const intent = normalizeText(payload.intent);
  const outputType = normalizeText(payload.outputType);
  const targetType = normalizeText(payload.targetType);
  const combined = [intent, outputType, targetType].join(' ');

  if (capability === 'comms' || requirementKey === 'comms') {
    if (outputType.includes('draft') || /\bdraft\b/.test(combined)) return 'draft';
    if (/(send|post|publish|notify|alert|reply|outreach|message|email|slack|webhook)/.test(combined)) return 'write';
    return 'read';
  }

  if (capability === 'crm' || requirementKey === 'crm') {
    if (/(update|create|log|sync|write|push|note|enrich)/.test(combined)) return 'write';
    return 'read';
  }

  if (capability === 'finance' || requirementKey === 'finance') {
    if (/(invoice|refund|charge|payout|billing|update|write)/.test(combined)) return 'write';
    return 'read';
  }

  if (capability === 'ops' || requirementKey === 'ops') {
    return 'read';
  }

  return 'read';
}

function resolveCapabilityCoverage(requiredCapabilities = [], payload = {}) {
  return requiredCapabilities.map((capability) => {
    const key = normalizeText(capability);
    const internal = INTERNAL_CAPABILITY_KEYS.has(key);
    return {
      capability: key,
      covered: internal,
      source: internal ? 'internal_lane' : 'external_lane',
      requiredPermissionMode: internal ? 'read' : getRequiredPermissionMode({ capability: key, payload }),
    };
  });
}

export function buildConnectedSystemCapabilityGraph(connectedSystems = []) {
  const systems = connectedSystems.map((system) => {
    const permissionScope = normalizePermissionScope(system.permissionScope, system.capabilities);
    const capabilityTokens = Array.from(new Set([
      normalizeText(system.integrationKey),
      normalizeText(system.displayName),
      normalizeText(system.category),
      normalizeText(system.domain),
      ...((Array.isArray(system.capabilities) ? system.capabilities : []).map((entry) => normalizeText(entry))),
    ].filter(Boolean)));

    return {
      ...system,
      normalizedStatus: normalizeSystemStatus(system.status),
      permissionScope,
      capabilityTokens,
      domain: system.domain || 'general',
      trustLevel: system.trustLevel || 'standard',
      riskLevel: system.riskLevel || 'medium',
      searchBlob: getSystemSearchBlob({
        ...system,
        permissionScope,
        domain: system.domain || 'general',
        trustLevel: system.trustLevel || 'standard',
        riskLevel: system.riskLevel || 'medium',
      }),
    };
  });

  const writeCapableCount = systems.filter((system) => permissionSatisfies(system.permissionScope, 'write')).length;
  const draftCapableCount = systems.filter((system) => permissionSatisfies(system.permissionScope, 'draft')).length;
  const readOnlyCount = systems.filter((system) => permissionSatisfies(system.permissionScope, 'read') && !permissionSatisfies(system.permissionScope, 'draft')).length;

  return {
    systems,
    summary: {
      total: systems.length,
      writeCapableCount,
      draftCapableCount,
      readOnlyCount,
    },
  };
}

export function deriveBranchExecutionPosture({ branch = {}, branchIndex = 0, branchCount = 1, launchReadiness = null } = {}) {
  const requiredSystems = Array.isArray(launchReadiness?.requiredSystems) ? launchReadiness.requiredSystems : [];
  const localFirstEligible = Boolean(launchReadiness?.localFirstEligible);
  const fallbackStrategy = launchReadiness?.fallbackStrategy || null;
  const branchBlob = getBranchSearchBlob(branch);
  const branchLooksWriteAction = /(send|post|publish|notify|deliver|dispatch|create|update|sync|push|reply|outreach|email|slack|crm)/.test(branchBlob);
  const branchLooksReviewAction = /(verify|review|check|audit|approve|qa|validate|guard)/.test(branchBlob);

  const matchedSystems = requiredSystems.filter((system) => {
    const matchTokens = [
      system.key,
      system.label,
      ...(Array.isArray(system.matches) ? system.matches.flatMap((entry) => [entry.integrationKey, entry.displayName, entry.domain]) : []),
    ]
      .map((entry) => normalizeText(entry))
      .filter(Boolean);

    return matchTokens.some((token) => branchBlob.includes(token));
  });

  const effectiveSystems = matchedSystems.length
    ? matchedSystems
    : requiredSystems.length === 1 && (branchLooksWriteAction || branchLooksReviewAction)
      ? requiredSystems
      : [];

  if (!effectiveSystems.length) {
    const localFirstFallback = fallbackStrategy === 'local_first' || localFirstEligible;
    return {
      available: localFirstFallback,
      tone: localFirstFallback ? 'teal' : 'blue',
      title: localFirstFallback ? 'Local-first fallback branch' : 'Neutral branch posture',
      detail: localFirstFallback
        ? 'This branch can stay on internal lanes first because launch readiness is not waiting on an external connector.'
        : 'Commander is not applying a connector-specific control posture to this branch yet.',
      preferredRole: localFirstFallback ? 'researcher' : null,
      recommendedApprovalLevel: localFirstFallback ? 'auto_low_risk' : null,
      requiresHumanGate: false,
      deferUntilSafeLane: false,
      executionStrategy: localFirstFallback ? 'parallel' : null,
      skillHints: [],
      systems: [],
      modes: [],
      fallbackStrategy: localFirstFallback ? 'local_first' : null,
    };
  }

  const pressuredSystems = effectiveSystems.filter((system) => ['missing', 'error', 'degraded', 'limited'].includes(system.status));
  const writeSensitive = effectiveSystems.some((system) => system.requiredPermissionMode === 'write');
  const draftSensitive = effectiveSystems.some((system) => system.requiredPermissionMode === 'draft');
  const readOnly = effectiveSystems.every((system) => system.requiredPermissionMode === 'read');
  const readOnlyFallback = pressuredSystems.length > 0 && readOnly && fallbackStrategy === 'read_only_reroute';
  const needsHumanGate = writeSensitive || draftSensitive || (pressuredSystems.length > 0 && !readOnlyFallback);
  const deferUntilSafeLane = pressuredSystems.length > 0 && !readOnlyFallback && branchIndex > 0;
  const preferredRole = readOnlyFallback
    ? (branchLooksReviewAction ? 'ops' : 'researcher')
    : needsHumanGate
    ? (branchLooksReviewAction || branchIndex === branchCount - 1 ? 'verifier' : 'ops')
    : readOnly
      ? (branchLooksReviewAction ? 'ops' : 'researcher')
      : draftSensitive
        ? 'ops'
        : null;
  const recommendedApprovalLevel = readOnlyFallback
    ? 'auto_low_risk'
    : needsHumanGate
    ? 'human_required'
    : draftSensitive || !readOnly
      ? 'risk_weighted'
      : null;
  const tone = readOnlyFallback ? 'teal' : needsHumanGate ? 'rose' : draftSensitive ? 'amber' : 'teal';
  const title = readOnlyFallback
    ? 'Read-only reroute branch'
    : needsHumanGate
    ? 'Human-aware connector branch'
    : draftSensitive
      ? 'Draft-capable connector branch'
      : 'Read-only connector branch';
  const detail = readOnlyFallback
    ? `${effectiveSystems.map((system) => system.label).join(', ')} is under connector pressure, so Commander should reroute this branch toward internal read-only or research work instead of waiting on live connector recovery.`
    : needsHumanGate
    ? `${effectiveSystems.map((system) => `${system.label} (${system.requiredPermissionMode})`).join(', ')} should stay on guarded lanes before it reaches live connector execution.`
    : draftSensitive
      ? `${effectiveSystems.map((system) => system.label).join(', ')} supports drafting, so Commander can prepare work here but should still keep review close.`
      : `${effectiveSystems.map((system) => system.label).join(', ')} is read-only for this branch, so Commander can safely lean on research or ops lanes first.`;

  return {
    available: true,
    tone,
    title,
    detail,
    preferredRole,
    recommendedApprovalLevel,
    requiresHumanGate: needsHumanGate,
    deferUntilSafeLane,
    executionStrategy: readOnlyFallback ? 'parallel' : needsHumanGate || draftSensitive ? 'sequential' : null,
    skillHints: Array.from(new Set(effectiveSystems.flatMap((system) => [system.key, ...(Array.isArray(system.matches) ? system.matches.map((entry) => entry.integrationKey).filter(Boolean) : [])]))),
    systems: effectiveSystems,
    modes: Array.from(new Set(effectiveSystems.map((system) => system.requiredPermissionMode).filter(Boolean))),
    fallbackStrategy: readOnlyFallback ? 'read_only_reroute' : fallbackStrategy,
  };
}

function computeBranchOrderingScore({
  branch = {},
  posture = null,
  originalIndex = 0,
  totalBranches = 1,
  controlPressure = 'stable',
}) {
  const role = normalizeText(branch.agentRole);
  const dependencyCount = Array.isArray(branch.dependsOn) ? branch.dependsOn.length : 0;
  const fallbackStrategy = posture?.fallbackStrategy || null;
  const humanGate = Boolean(posture?.requiresHumanGate);
  const deferUntilSafeLane = Boolean(posture?.deferUntilSafeLane);
  const draftSensitive = Array.isArray(posture?.modes) && posture.modes.includes('draft');
  const readOnly = Array.isArray(posture?.modes) && posture.modes.length > 0 && posture.modes.every((mode) => mode === 'read');

  let score = 0;
  const reasons = [];

  if (role === 'planner' || normalizeText(branch.branchLabel) === 'command') {
    score += 1000;
    reasons.push('command branch stays first');
  }

  if (fallbackStrategy === 'local_first') {
    score += 240;
    reasons.push('local-first fallback can keep throughput moving');
  } else if (fallbackStrategy === 'read_only_reroute') {
    score += 170;
    reasons.push('read-only reroute is safer than guarded external work');
  } else if (fallbackStrategy === 'guarded_external') {
    score -= 190;
    reasons.push('guarded external work should start later unless it is the only root');
  }

  if (readOnly) {
    score += 80;
    reasons.push('read-only connector posture is parallel-safe');
  }
  if (draftSensitive) {
    score -= 45;
    reasons.push('draft-capable branch still needs closer review');
  }
  if (humanGate) {
    score -= 120;
    reasons.push('human-gated branch should not lead the graph');
  }
  if (deferUntilSafeLane) {
    score -= 140;
    reasons.push('branch should wait for a safer lane');
  }

  score -= dependencyCount * 75;
  if (dependencyCount > 0) {
    reasons.push(`depends on ${dependencyCount} earlier branch${dependencyCount === 1 ? '' : 'es'}`);
  }

  if (role === 'verifier') {
    score -= 65;
    reasons.push('verifier branch should usually land after execution branches');
  } else if (role === 'researcher' || role === 'ops') {
    score += 18;
  }

  if (controlPressure === 'high' && (humanGate || fallbackStrategy === 'guarded_external')) {
    score -= 50;
    reasons.push('recent recovery pressure favors safer branches first');
  } else if (controlPressure === 'high' && (fallbackStrategy === 'local_first' || readOnly)) {
    score += 30;
    reasons.push('recent recovery pressure favors safer throughput lanes');
  }

  score -= originalIndex * 2;
  if (originalIndex === totalBranches - 1 && role === 'verifier') {
    score += 10;
  }

  return {
    score,
    reasons,
  };
}

export function prioritizeMissionBranches({ branches = [], launchReadiness = null, controlPressure = 'stable' } = {}) {
  if (!Array.isArray(branches) || branches.length <= 1) {
    return Array.isArray(branches) ? branches : [];
  }

  const enriched = branches.map((branch, index) => {
    const posture = deriveBranchExecutionPosture({
      branch,
      branchIndex: index,
      branchCount: branches.length,
      launchReadiness,
    });
    const ordering = computeBranchOrderingScore({
      branch,
      posture,
      originalIndex: index,
      totalBranches: branches.length,
      controlPressure,
    });
    return {
      branch,
      posture,
      originalIndex: index,
      ordering,
    };
  });

  const commandBranches = enriched.filter((entry) => normalizeText(entry.branch.agentRole) === 'planner' || normalizeText(entry.branch.branchLabel) === 'command');
  const remaining = enriched.filter((entry) => !commandBranches.includes(entry));
  const roots = remaining.filter((entry) => !Array.isArray(entry.branch.dependsOn) || entry.branch.dependsOn.length === 0);
  const gated = remaining.filter((entry) => Array.isArray(entry.branch.dependsOn) && entry.branch.dependsOn.length > 0);

  const sortByScore = (left, right) => {
    if (right.ordering.score !== left.ordering.score) return right.ordering.score - left.ordering.score;
    return left.originalIndex - right.originalIndex;
  };

  return [
    ...commandBranches.sort(sortByScore),
    ...roots.sort(sortByScore),
    ...gated.sort(sortByScore),
  ].map((entry, orderedIndex) => ({
    ...entry.branch,
    planningPriority: entry.ordering.score,
    planningOrder: orderedIndex + 1,
    planningReason: entry.ordering.reasons[0] || 'kept original order',
  }));
}

export function getTaskPlanningReason(task = {}) {
  const routingReason = String(task.routingReason || '');
  const match = routingReason.match(/\|\sorder\s([^|]+)/i);
  return match?.[1]?.trim() || null;
}

function parseTaskRoutingReasonField(task = {}, key = '') {
  const routingReason = String(task.routingReason || '');
  if (!routingReason || !key) return null;
  const match = routingReason.match(new RegExp(`\\|\\s${key}\\s([^|]+)`, 'i'));
  return match?.[1]?.trim() || null;
}

function normalizeDispatchContract(value = '') {
  return String(value || '').trim().toLowerCase().replaceAll(' ', '_');
}

export function formatDispatchContractLabel(contract = '') {
  if (contract === 'release_on_upstream_completion') return 'Release on upstream';
  if (contract === 'safe_parallel_fanout') return 'Safe parallel';
  if (contract === 'serialized_mission_order') return 'Serialized order';
  return 'Graph contract';
}

export function formatReleaseTriggerLabel(trigger = '') {
  if (trigger === 'upstream_completion') return 'Upstream completion';
  return 'Graph release';
}

function inferDispatchContract({ dependencies = [], executionStrategy = '', fallbackStrategy = '', connectorPosture = '' }) {
  if (dependencies.length > 0) return 'release_on_upstream_completion';
  if (fallbackStrategy === 'local_first' || fallbackStrategy === 'read_only_reroute' || executionStrategy === 'parallel') {
    return 'safe_parallel_fanout';
  }
  if (connectorPosture.includes('human-aware') || fallbackStrategy === 'guarded_external') {
    return 'serialized_mission_order';
  }
  return 'serialized_mission_order';
}

export function getTaskDispatchContract(task = {}, interventions = []) {
  const persistedContract = normalizeDispatchContract(parseTaskRoutingReasonField(task, 'dispatch contract'));
  if (persistedContract) return persistedContract;

  const releaseEvent = interventions.find((entry) => entry.taskId === task.id && entry.metadata?.dispatchContract);
  if (releaseEvent?.metadata?.dispatchContract) return normalizeDispatchContract(releaseEvent.metadata.dispatchContract);

  const dependencies = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  const fallbackStrategy = normalizeText(parseTaskRoutingReasonField(task, 'fallback')).replaceAll(' ', '_');
  const connectorPosture = normalizeText(parseTaskRoutingReasonField(task, 'connector posture'));
  const executionStrategy = normalizeText(task.executionStrategy || 'sequential');
  return inferDispatchContract({ dependencies, executionStrategy, fallbackStrategy, connectorPosture });
}

export function getTaskReleaseTrigger(task = {}, interventions = []) {
  const persistedTrigger = normalizeDispatchContract(parseTaskRoutingReasonField(task, 'release trigger'));
  if (persistedTrigger) return persistedTrigger;

  const releaseEvent = interventions.find((entry) => entry.taskId === task.id && entry.metadata?.releaseTrigger);
  if (releaseEvent?.metadata?.releaseTrigger) return normalizeDispatchContract(releaseEvent.metadata.releaseTrigger);

  const dependencies = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  return dependencies.length > 0 ? 'upstream_completion' : null;
}

export function getTaskGraphContractReadback(task = {}, tasks = [], interventions = []) {
  const contract = getTaskDispatchContract(task, interventions);
  const releaseTrigger = getTaskReleaseTrigger(task, interventions);
  const dependencies = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  const dependencyTitles = dependencies
    .map((dependencyId) => tasks.find((candidate) => candidate.id === dependencyId))
    .filter(Boolean)
    .map((candidate) => candidate.branchLabel || candidate.name || candidate.title || 'upstream branch');

  if (contract === 'release_on_upstream_completion') {
    return {
      available: true,
      tone: 'amber',
      label: formatDispatchContractLabel(contract),
      title: 'Branch starts only after the release chain clears',
      detail: dependencyTitles.length
        ? `Commander will hold this branch until ${dependencyTitles.join(', ')} completes, then release it into runnable execution.`
        : 'Commander will hold this branch until upstream work completes, then release it into runnable execution.',
      nextMove: 'Finish the upstream branch first, then let the release chain clear naturally.',
      releaseTrigger,
      dispatchContract: contract,
    };
  }

  if (contract === 'safe_parallel_fanout') {
    return {
      available: true,
      tone: 'teal',
      label: formatDispatchContractLabel(contract),
      title: 'Branch can widen throughput safely',
      detail: 'Commander marked this branch safe to fan out with other independent work instead of forcing serialized mission order.',
      nextMove: 'Keep this branch moving alongside other clean independent lanes.',
      releaseTrigger,
      dispatchContract: contract,
    };
  }

  return {
    available: true,
    tone: 'blue',
    label: formatDispatchContractLabel(contract),
    title: 'Branch stays in serialized mission order',
    detail: 'Commander is intentionally keeping this branch in tighter sequence instead of widening fan-out early.',
    nextMove: 'Let earlier or safer branches run first before widening this lane.',
    releaseTrigger,
    dispatchContract: contract,
  };
}

export function getBranchGraphContractReadback(branch = {}, branches = [], launchReadiness = null) {
  const dependencies = Array.isArray(branch.dependsOn) ? branch.dependsOn : [];
  const posture = deriveBranchExecutionPosture({
    branch,
    branchIndex: Math.max(0, branches.findIndex((candidate) => candidate.title === branch.title)),
    branchCount: Math.max(branches.length, 1),
    launchReadiness,
  });
  const contract = inferDispatchContract({
    dependencies,
    executionStrategy: normalizeText(branch.executionStrategy || 'sequential'),
    fallbackStrategy: posture?.fallbackStrategy || null,
    connectorPosture: normalizeText(posture?.title || ''),
  });
  const dependencyLabels = dependencies.map((dependencyTitle) => {
    const matched = branches.find((candidate) => candidate.title === dependencyTitle);
    return matched?.branchLabel || matched?.title || dependencyTitle;
  });

  if (contract === 'release_on_upstream_completion') {
    return {
      available: true,
      tone: 'amber',
      label: formatDispatchContractLabel(contract),
      title: 'This branch waits for upstream completion',
      detail: dependencyLabels.length
        ? `Commander will release this branch after ${dependencyLabels.join(', ')} completes.`
        : 'Commander will release this branch after upstream completion.',
      releaseTrigger: 'upstream_completion',
      dispatchContract: contract,
    };
  }

  if (contract === 'safe_parallel_fanout') {
    return {
      available: true,
      tone: 'teal',
      label: formatDispatchContractLabel(contract),
      title: 'This branch can fan out safely',
      detail: 'Commander can start this branch alongside other independent work without waiting for serialized mission order.',
      releaseTrigger: null,
      dispatchContract: contract,
    };
  }

  return {
    available: true,
    tone: 'blue',
    label: formatDispatchContractLabel(contract),
    title: 'This branch stays in mission order',
    detail: 'Commander will keep this branch serialized behind earlier work unless runtime pressure changes the graph.',
    releaseTrigger: null,
    dispatchContract: contract,
  };
}

export function getTaskDispatchSafety(task = {}) {
  const dependencies = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  const fallbackField = parseTaskRoutingReasonField(task, 'fallback');
  const connectorField = parseTaskRoutingReasonField(task, 'connector posture');
  const fallbackStrategy = fallbackField ? normalizeText(fallbackField).replaceAll(' ', '_') : null;
  const connectorPosture = normalizeText(connectorField);
  const executionStrategy = normalizeText(task.executionStrategy || 'sequential');
  const requiresHumanGate = Boolean(task.requiresApproval)
    || normalizeText(task.approvalLevel) === 'human_required'
    || connectorPosture.includes('human-aware')
    || fallbackStrategy === 'guarded_external';
  const draftSensitive = connectorPosture.includes('draft-capable') || connectorPosture.includes('(draft');
  const readOnlySafe = fallbackStrategy === 'read_only_reroute' || connectorPosture.includes('read-only');
  const localFirstSafe = fallbackStrategy === 'local_first';
  const dependencyBound = dependencies.length > 0;
  const parallelDeclared = executionStrategy === 'parallel';
  const parallelSafe = !dependencyBound && !requiresHumanGate && (localFirstSafe || readOnlySafe || parallelDeclared);

  const dispatchClass = localFirstSafe
    ? 'local_first'
    : readOnlySafe
      ? 'read_only'
      : requiresHumanGate
        ? 'guarded_external'
        : draftSensitive
          ? 'draft_sensitive'
          : parallelDeclared
            ? 'parallel'
            : 'serialized';

  const priorityBoost = localFirstSafe
    ? 40
    : readOnlySafe
      ? 25
      : requiresHumanGate
        ? -40
        : draftSensitive
          ? -15
          : parallelDeclared
            ? 10
            : 0;

  const reason = dependencyBound
    ? 'Branch still depends on upstream work and should not dispatch in parallel.'
    : localFirstSafe
      ? 'Local-first fallback is safe to dispatch alongside other independent work.'
      : readOnlySafe
        ? 'Read-only reroute is safe to dispatch alongside other independent work.'
        : requiresHumanGate
          ? 'Guarded external posture should stay serialized within the mission.'
          : draftSensitive
            ? 'Draft-sensitive connector work should stay closer to review.'
            : parallelDeclared
              ? 'Branch is explicitly marked parallel and has no active dependency pressure.'
              : 'Branch should dispatch in serialized mission order.';

  return {
    dependencyBound,
    fallbackStrategy,
    connectorPosture,
    requiresHumanGate,
    draftSensitive,
    localFirstSafe,
    readOnlySafe,
    parallelDeclared,
    parallelSafe,
    dispatchClass,
    priorityBoost,
    reason,
  };
}

export function formatDispatchClassLabel(dispatchClass = '') {
  if (dispatchClass === 'local_first') return 'Safe parallel';
  if (dispatchClass === 'read_only') return 'Read-only parallel';
  if (dispatchClass === 'parallel') return 'Parallel safe';
  if (dispatchClass === 'guarded_external') return 'Serialized guard';
  if (dispatchClass === 'draft_sensitive') return 'Serialized review';
  if (dispatchClass === 'serialized') return 'Serialized lane';
  return 'Dispatch posture';
}

export function getTaskDispatchReadback(task = {}, tasks = []) {
  const safety = getTaskDispatchSafety(task);
  const transition = describeTaskTransition(task, tasks);

  if (safety.dependencyBound) {
    return {
      available: true,
      tone: 'amber',
      label: 'Held upstream',
      title: 'Branch is waiting on release chain',
      detail: transition.detail || safety.reason,
      nextMove: 'Finish the upstream branch before trying to fan this work out.',
      dispatchClass: safety.dispatchClass,
      parallelSafe: false,
    };
  }

  if (safety.requiresHumanGate) {
    return {
      available: true,
      tone: 'rose',
      label: formatDispatchClassLabel(safety.dispatchClass),
      title: 'Branch is intentionally serialized behind a guard',
      detail: safety.reason,
      nextMove: 'Keep this branch serialized until the guarded lane or approval gate clears.',
      dispatchClass: safety.dispatchClass,
      parallelSafe: false,
    };
  }

  if (safety.draftSensitive) {
    return {
      available: true,
      tone: 'amber',
      label: formatDispatchClassLabel(safety.dispatchClass),
      title: 'Branch stays close to review',
      detail: safety.reason,
      nextMove: 'Let cleaner execution branches move first, then release this closer to review.',
      dispatchClass: safety.dispatchClass,
      parallelSafe: false,
    };
  }

  if (safety.parallelSafe) {
    return {
      available: true,
      tone: 'teal',
      label: formatDispatchClassLabel(safety.dispatchClass),
      title: 'Branch is safe to fan out',
      detail: safety.reason,
      nextMove: 'This is a good branch to keep moving alongside other independent work.',
      dispatchClass: safety.dispatchClass,
      parallelSafe: true,
    };
  }

  return {
    available: true,
    tone: 'blue',
    label: formatDispatchClassLabel(safety.dispatchClass),
    title: 'Branch stays in serialized mission order',
    detail: safety.reason,
    nextMove: 'Run this after the current sibling branch instead of fanning it out early.',
    dispatchClass: safety.dispatchClass,
    parallelSafe: false,
  };
}

export function getMissionDispatchPressureSummary(tasks = []) {
  const activeTasks = tasks.filter((task) => !['done', 'completed', 'cancelled', 'failed', 'error'].includes(String(task.status || '').toLowerCase()));
  const entries = activeTasks.map((task) => ({
    task,
    safety: getTaskDispatchSafety(task),
    readback: getTaskDispatchReadback(task, tasks),
  }));

  if (!entries.length) {
    return {
      available: false,
      title: 'Dispatch posture is still forming',
      detail: 'Commander needs more live graph state before dispatch posture should affect operator guidance.',
      tone: 'teal',
      safeParallelCount: 0,
      serializedCount: 0,
      heldUpstreamCount: 0,
      topTask: null,
      nextMove: null,
    };
  }

  const safeParallel = entries.filter((entry) => entry.safety.parallelSafe);
  const heldUpstream = entries.filter((entry) => entry.safety.dependencyBound);
  const serialized = entries.filter((entry) => !entry.safety.parallelSafe && !entry.safety.dependencyBound);
  const topTask = heldUpstream[0] || serialized[0] || safeParallel[0] || null;

  if (heldUpstream.length > 0) {
    return {
      available: true,
      title: `${heldUpstream.length} branch${heldUpstream.length === 1 ? ' is' : 'es are'} waiting on release`,
      detail: `${heldUpstream.length} branch${heldUpstream.length === 1 ? '' : 'es'} are still held on upstream completion, so the fastest next move is to clear the dependency chain before widening the mission graph.`,
      tone: 'amber',
      safeParallelCount: safeParallel.length,
      serializedCount: serialized.length,
      heldUpstreamCount: heldUpstream.length,
      topTask,
      nextMove: 'Clear the upstream branch that is holding the release chain first.',
    };
  }

  if (serialized.length > 0) {
    return {
      available: true,
      title: `${serialized.length} branch${serialized.length === 1 ? ' is' : 'es are'} intentionally serialized`,
      detail: `${serialized.length} active branch${serialized.length === 1 ? '' : 'es'} are staying serialized because guard, draft, or mission-order posture is safer than fan-out right now.`,
      tone: 'rose',
      safeParallelCount: safeParallel.length,
      serializedCount: serialized.length,
      heldUpstreamCount: 0,
      topTask,
      nextMove: 'Keep the guarded lane serialized and use safe-parallel branches for extra throughput.',
    };
  }

  return {
    available: true,
    title: 'Parallel-safe branches are carrying throughput',
    detail: `${safeParallel.length} branch${safeParallel.length === 1 ? ' is' : 'es are'} currently safe to fan out, so Commander can widen throughput without adding much graph risk.`,
    tone: 'teal',
    safeParallelCount: safeParallel.length,
    serializedCount: 0,
    heldUpstreamCount: 0,
    topTask,
    nextMove: 'Keep the safe-parallel branches moving while the graph is clean.',
  };
}

export function buildDispatchActionDraft(dispatchSummary = {}) {
  if (!dispatchSummary?.available || !dispatchSummary?.nextMove) return null;

  const quickstartPrompt = `Follow the live dispatch order for the current mission graph. ${dispatchSummary.detail} Next move: ${dispatchSummary.nextMove} Keep safe-parallel branches moving, keep intentionally serialized branches in order, and clear the release chain before widening blocked work.`;

  return {
    tab: 'create',
    quickstartPrompt,
    notice: `Commander staged the dispatch-order move: ${dispatchSummary.title}.`,
    dispatchActionBrief: {
      title: dispatchSummary.title,
      actionLabel: 'Follow dispatch order',
      dispatchTone: dispatchSummary.tone,
      expectedImprovement: dispatchSummary.tone === 'teal'
        ? 'Increase throughput without adding graph risk.'
        : dispatchSummary.tone === 'amber'
          ? 'Release more of the graph by clearing the upstream hold first.'
          : 'Reduce avoidable concurrency risk by keeping guarded work serialized.',
      verificationTarget: dispatchSummary.tone === 'amber'
        ? 'Held-upstream branches should move into released or queued state after the upstream branch completes.'
        : dispatchSummary.tone === 'rose'
          ? 'Guarded or review-sensitive branches should remain serialized while safe-parallel branches continue moving.'
          : 'Safe-parallel branches should continue running without creating new guarded or blocked pressure.',
      successCriteria: dispatchSummary.tone === 'amber'
        ? 'The release chain clears and downstream branches become runnable.'
        : dispatchSummary.tone === 'rose'
          ? 'No guarded sibling launches early, and safe branches continue without added command drag.'
          : 'Parallel-safe branches keep throughput high while the graph stays stable.',
      rollbackCriteria: 'If the graph becomes noisier, guarded siblings start too early, or downstream pressure increases, revert to tighter serialized dispatch.',
      nextMove: dispatchSummary.nextMove,
      topTaskTitle: dispatchSummary.topTask?.task?.name || dispatchSummary.topTask?.task?.title || dispatchSummary.topTask?.title || null,
      safeParallelCount: dispatchSummary.safeParallelCount || 0,
      serializedCount: dispatchSummary.serializedCount || 0,
      heldUpstreamCount: dispatchSummary.heldUpstreamCount || 0,
    },
  };
}

export function getTaskExecutionHoldReason(task = {}, tasks = [], interventions = []) {
  const dependencies = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  const dependencyTitles = dependencies
    .map((dependencyId) => tasks.find((candidate) => candidate.id === dependencyId))
    .filter(Boolean)
    .map((candidate) => candidate.branchLabel || candidate.name || candidate.title || 'upstream branch');
  const branchPosture = getTaskBranchExecutionPosture(task, interventions);

  if (dependencies.length > 0 && ['pending', 'blocked', 'queued'].includes(String(task.status || '').toLowerCase())) {
    return dependencyTitles.length
      ? `Waiting on ${dependencyTitles.join(', ')} before this branch can run safely.`
      : 'Waiting on upstream branch dependencies before this branch can run safely.';
  }

  if (task.requiresApproval || String(task.status || '').toLowerCase() === 'needs_approval') {
    return 'Held for human approval before this branch can continue.';
  }

  if (branchPosture?.deferUntilSafeLane) {
    return 'Held on a safer lane because connector pressure or write posture is still too risky.';
  }

  if (branchPosture?.fallbackStrategy === 'guarded_external') {
    return 'Running behind a guarded external fallback, so Commander is keeping tighter control over when it starts.';
  }

  if (branchPosture?.fallbackStrategy === 'read_only_reroute') {
    return 'Rerouted into a read-only fallback so safer throughput can continue without live writes.';
  }

  if (branchPosture?.fallbackStrategy === 'local_first') {
    return 'Using local-first fallback so this branch can keep moving without waiting on external systems.';
  }

  return null;
}

export function getTaskExecutionReleaseReason(task = {}, tasks = []) {
  const dependencies = Array.isArray(task.dependsOn) ? task.dependsOn : [];
  if (!dependencies.length) return null;

  const status = String(task.status || '').toLowerCase();
  if (!['queued', 'running', 'completed', 'done'].includes(status)) return null;

  const dependencyTitles = dependencies
    .map((dependencyId) => tasks.find((candidate) => candidate.id === dependencyId))
    .filter(Boolean)
    .map((candidate) => candidate.branchLabel || candidate.name || candidate.title || 'upstream branch');

  return dependencyTitles.length
    ? `Released after ${dependencyTitles.join(', ')} completed.`
    : 'Released after upstream dependencies completed.';
}

export function getTaskGraphReasoning(task = {}, tasks = [], interventions = []) {
  const dispatchReadback = getTaskDispatchReadback(task, tasks);
  const planningReason = getTaskPlanningReason(task);
  const holdReason = getTaskExecutionHoldReason(task, tasks, interventions);
  const releaseReason = getTaskExecutionReleaseReason(task, tasks);

  if (holdReason) {
    return {
      available: true,
      tone: dispatchReadback?.tone || 'amber',
      title: dispatchReadback?.title || 'Branch is held in the mission graph',
      detail: holdReason,
      nextMove: dispatchReadback?.nextMove || 'Clear the upstream hold or review gate before widening this branch.',
      state: 'held',
    };
  }

  if (releaseReason) {
    return {
      available: true,
      tone: 'teal',
      title: 'Branch was released by the mission graph',
      detail: releaseReason,
      nextMove: dispatchReadback?.nextMove || 'Keep this released branch moving while the graph is clean.',
      state: 'released',
    };
  }

  if (dispatchReadback?.available) {
    return {
      available: true,
      tone: dispatchReadback.tone || 'blue',
      title: dispatchReadback.title || 'Branch is following mission dispatch posture',
      detail: planningReason ? `${dispatchReadback.detail} Planned as: ${planningReason}` : dispatchReadback.detail,
      nextMove: dispatchReadback.nextMove || 'Follow the current dispatch posture for this branch.',
      state: dispatchReadback.parallelSafe ? 'parallel_safe' : 'serialized',
    };
  }

  if (planningReason) {
    return {
      available: true,
      tone: 'blue',
      title: 'Branch order was planned deliberately',
      detail: planningReason,
      nextMove: 'Keep the planned mission order unless a stronger runtime blocker changes the graph.',
      state: 'planned',
    };
  }

  return {
    available: false,
    tone: 'blue',
    title: 'Graph reasoning is still forming',
    detail: 'Commander needs more branch state before graph reasoning should influence operator guidance.',
    nextMove: null,
    state: 'forming',
  };
}

export function getGraphReasoningSummary(tasks = [], interventions = []) {
  const activeTasks = tasks.filter((task) => !['done', 'completed', 'cancelled'].includes(String(task.status || '').toLowerCase()));
  const entries = activeTasks
    .map((task) => ({
      task,
      reasoning: getTaskGraphReasoning(task, tasks, interventions),
    }))
    .filter((entry) => entry.reasoning.available);

  if (!entries.length) {
    return {
      available: false,
      tone: 'blue',
      title: 'Graph reasoning is still forming',
      detail: 'Commander needs more live branch state before graph reasoning should become a top operator signal.',
      nextMove: null,
      topTask: null,
      branches: [],
    };
  }

  const topEntry = entries.find((entry) => entry.reasoning.state === 'held')
    || entries.find((entry) => entry.reasoning.state === 'released')
    || entries.find((entry) => entry.reasoning.state === 'serialized')
    || entries[0];

  return {
    available: true,
    tone: topEntry.reasoning.tone || 'blue',
    title: topEntry.reasoning.title,
    detail: topEntry.reasoning.detail,
    nextMove: topEntry.reasoning.nextMove,
    topReasoning: topEntry.reasoning,
    topTask: {
      id: topEntry.task.id,
      title: topEntry.task.name || topEntry.task.title || 'Branch',
      state: topEntry.reasoning.state,
    },
    branches: entries.slice(0, 3).map((entry) => ({
      id: entry.task.id,
      title: entry.task.name || entry.task.title || 'Branch',
      state: entry.reasoning.state,
      tone: entry.reasoning.tone,
    })),
  };
}

export function getGraphContractPressureSummary(tasks = [], interventions = []) {
  const activeTasks = tasks.filter((task) => !['done', 'completed', 'cancelled', 'failed', 'error'].includes(String(task.status || '').toLowerCase()));
  const entries = activeTasks
    .map((task) => ({
      task,
      contract: getTaskGraphContractReadback(task, tasks, interventions),
      safety: getTaskDispatchSafety(task),
    }))
    .filter((entry) => entry.contract?.available);

  if (!entries.length) {
    return {
      available: false,
      title: 'Graph contract pressure is still forming',
      detail: 'Commander needs more branch state before graph-contract pressure should drive the top operator order.',
      nextMove: null,
      tone: 'blue',
      orderMode: null,
      releaseChainCount: 0,
      guardedSerializedCount: 0,
      serializedCount: 0,
      safeParallelCount: 0,
      topEntry: null,
    };
  }

  const releaseChain = entries.filter((entry) => entry.contract.dispatchContract === 'release_on_upstream_completion');
  const guardedSerialized = entries.filter((entry) => entry.contract.dispatchContract === 'serialized_mission_order' && (entry.safety.requiresHumanGate || entry.safety.draftSensitive));
  const serialized = entries.filter((entry) => entry.contract.dispatchContract === 'serialized_mission_order');
  const safeParallel = entries.filter((entry) => entry.contract.dispatchContract === 'safe_parallel_fanout');

  if (releaseChain.length > 0) {
    return {
      available: true,
      title: `${releaseChain.length} branch${releaseChain.length === 1 ? ' is' : 'es are'} still waiting on release chain`,
      detail: `${releaseChain.length} branch${releaseChain.length === 1 ? '' : 'es'} cannot start until upstream completion clears the release trigger, so Commander should clear the release chain before widening the graph.`,
      nextMove: 'clear the release chain before widening other lanes',
      tone: 'amber',
      orderMode: 'clear_release_chain',
      releaseChainCount: releaseChain.length,
      guardedSerializedCount: guardedSerialized.length,
      serializedCount: serialized.length,
      safeParallelCount: safeParallel.length,
      topEntry: releaseChain[0],
    };
  }

  if (guardedSerialized.length > 0) {
    return {
      available: true,
      title: `${guardedSerialized.length} branch${guardedSerialized.length === 1 ? ' is' : 'es are'} intentionally serialized behind a guarded lane`,
      detail: `${guardedSerialized.length} branch${guardedSerialized.length === 1 ? '' : 'es'} are using a guarded serialized contract, so Commander should keep that lane tight while letting safer work move elsewhere.`,
      nextMove: 'keep the guarded lane serialized while safer branches keep moving',
      tone: 'rose',
      orderMode: 'keep_guarded_lane_serialized',
      releaseChainCount: releaseChain.length,
      guardedSerializedCount: guardedSerialized.length,
      serializedCount: serialized.length,
      safeParallelCount: safeParallel.length,
      topEntry: guardedSerialized[0],
    };
  }

  if (safeParallel.length > 0) {
    return {
      available: true,
      title: 'Safe-parallel graph contract can widen throughput',
      detail: `${safeParallel.length} branch${safeParallel.length === 1 ? ' is' : 'es are'} carrying a safe-parallel contract, so Commander can widen clean throughput instead of forcing extra serialization.`,
      nextMove: 'widen safe parallel branches while the graph remains clean',
      tone: 'teal',
      orderMode: 'widen_safe_parallel',
      releaseChainCount: releaseChain.length,
      guardedSerializedCount: guardedSerialized.length,
      serializedCount: serialized.length,
      safeParallelCount: safeParallel.length,
      topEntry: safeParallel[0],
    };
  }

  return {
    available: true,
    title: 'Serialized mission order is still the safest graph contract',
    detail: 'Commander is keeping the mission graph in tighter sequence right now, so the safest next move is to respect ordering instead of widening fan-out early.',
    nextMove: 'keep the current serialized order until graph pressure changes',
    tone: 'blue',
    orderMode: 'keep_serialized_order',
    releaseChainCount: releaseChain.length,
    guardedSerializedCount: guardedSerialized.length,
    serializedCount: serialized.length,
    safeParallelCount: safeParallel.length,
    topEntry: serialized[0] || entries[0],
  };
}

export function getTaskBranchExecutionPosture(task = {}, interventions = []) {
  const missionLaunchReadiness = getMissionLaunchReadiness(interventions, task);
  return deriveBranchExecutionPosture({
    branch: {
      title: task.name || task.title || '',
      branchLabel: task.branchLabel || task.name || task.title || '',
      description: task.description || task.summary || '',
      agentRole: task.agentRole || 'executor',
      recommendedSkillNames: Array.isArray(task.requiredCapabilities) ? task.requiredCapabilities : [],
    },
    branchIndex: 0,
    branchCount: 1,
    launchReadiness: missionLaunchReadiness,
  });
}

export function getBranchConnectorPressureSummary(tasks = [], interventions = []) {
  const activeTasks = tasks.filter((task) => !['done', 'completed'].includes(String(task.status || '').toLowerCase()));
  const branchPostures = activeTasks
    .map((task) => ({
      task,
      posture: getTaskBranchExecutionPosture(task, interventions),
    }))
    .filter((entry) => entry.posture?.available);

  if (!branchPostures.length) {
    return {
      available: false,
      score: 0,
      tone: 'teal',
      title: 'Branch connector posture is still forming',
      detail: 'Commander needs more launch-readiness-backed branch history before connector branch pressure should influence intervention priority.',
      guardedCount: 0,
      readOnlyCount: 0,
      draftCount: 0,
      localFirstFallbackCount: 0,
      readOnlyRerouteCount: 0,
      guardedExternalCount: 0,
      topBranches: [],
      topCorrectiveAction: null,
    };
  }

  const guardedBranches = branchPostures.filter((entry) => entry.posture.requiresHumanGate);
  const draftBranches = branchPostures.filter((entry) => !entry.posture.requiresHumanGate && entry.posture.modes.includes('draft'));
  const readOnlyBranches = branchPostures.filter((entry) => !entry.posture.requiresHumanGate && entry.posture.modes.every((mode) => mode === 'read'));
  const localFirstFallbackCount = branchPostures.filter((entry) => entry.posture.fallbackStrategy === 'local_first').length;
  const readOnlyRerouteCount = branchPostures.filter((entry) => entry.posture.fallbackStrategy === 'read_only_reroute').length;
  const guardedExternalCount = branchPostures.filter((entry) => entry.posture.fallbackStrategy === 'guarded_external').length;
  const topBranches = [...guardedBranches, ...draftBranches]
    .slice(0, 3)
    .map((entry) => ({
      id: entry.task.id,
      title: entry.task.name || entry.task.title || 'Branch',
      postureTitle: entry.posture.title,
      tone: entry.posture.tone,
      fallbackStrategy: entry.posture.fallbackStrategy || null,
    }));
  const topCorrectiveAction = guardedBranches[0]
    ? getBranchConnectorCorrectiveAction(guardedBranches[0].posture)
    : draftBranches[0]
      ? getBranchConnectorCorrectiveAction(draftBranches[0].posture)
      : null;

  if (!guardedBranches.length && !draftBranches.length) {
    return {
      available: true,
      score: 0,
      tone: 'teal',
      title: 'Connector branch posture is clean',
      detail: 'Active connector-backed branches are mostly read-only or local-first, so intervention pressure can stay focused elsewhere.',
      guardedCount: 0,
      readOnlyCount: readOnlyBranches.length,
      draftCount: 0,
      localFirstFallbackCount,
      readOnlyRerouteCount,
      guardedExternalCount,
      topBranches,
      topCorrectiveAction,
    };
  }

  const tone = guardedBranches.length > 0 ? 'rose' : 'amber';
  const title = guardedBranches.length > 0
    ? 'Write-guarded branches are setting execution pace'
    : 'Draft-capable branches still need close review';
  const detail = guardedBranches.length > 0
    ? `${guardedBranches.length} live branch${guardedBranches.length === 1 ? '' : 'es'} are leaning on human-aware connector posture, so approval and intervention priority should stay close to those lanes first.`
    : `${draftBranches.length} branch${draftBranches.length === 1 ? '' : 'es'} can prepare connector work but still deserve close review before scaling.`;

  return {
    available: true,
    score: (guardedBranches.length * 10) + (draftBranches.length * 5),
    tone,
    title,
    detail,
    guardedCount: guardedBranches.length,
    readOnlyCount: readOnlyBranches.length,
    draftCount: draftBranches.length,
    localFirstFallbackCount,
    readOnlyRerouteCount,
    guardedExternalCount,
    topBranches,
    topCorrectiveAction,
  };
}

export function getGroupedConnectorBlockers(tasks = [], interventions = []) {
  const activeTasks = tasks.filter((task) => !['done', 'completed'].includes(String(task.status || '').toLowerCase()));
  const grouped = new Map();

  activeTasks.forEach((task) => {
    const posture = getTaskBranchExecutionPosture(task, interventions);
    if (!posture?.available || (!posture.requiresHumanGate && !posture.modes.includes('draft'))) return;

    const correctiveAction = getBranchConnectorCorrectiveAction(posture);
    if (!correctiveAction) return;

    const primarySystem = posture.systems?.[0] || null;
    const connectorLabel = primarySystem?.label || 'connector lane';
    const connectorStatus = primarySystem?.status || (posture.requiresHumanGate ? 'guarded' : 'draft');
    const connectorMode = primarySystem?.requiredPermissionMode || posture.modes?.[0] || 'read';
    const key = [
      connectorLabel,
      connectorStatus,
      connectorMode,
      correctiveAction.actionLabel,
      correctiveAction.targetRole || '',
      correctiveAction.targetApprovalPosture || '',
    ].join('|');

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        connectorLabel,
        connectorStatus,
        connectorMode,
        correctiveAction,
        tasks: [],
        guardedCount: 0,
        draftCount: 0,
      });
    }

    const group = grouped.get(key);
    group.tasks.push({
      id: task.id,
      title: task.name || task.title || 'Branch',
      status: task.status,
    });
    if (posture.requiresHumanGate) group.guardedCount += 1;
    if (!posture.requiresHumanGate && posture.modes.includes('draft')) group.draftCount += 1;
  });

  const rankedGroups = Array.from(grouped.values())
    .map((group) => {
      const affectedCount = group.tasks.length;
      const tone = group.guardedCount > 0 ? 'rose' : 'amber';
      const title = affectedCount > 1
        ? `${group.connectorLabel} is blocking ${affectedCount} branches`
        : `${group.connectorLabel} is blocking 1 branch`;
      const detail = `${affectedCount} branch${affectedCount === 1 ? '' : 'es'} are stacking behind ${group.connectorLabel} in ${group.connectorMode} mode. ${group.correctiveAction.detail}`;
      const resolutionMode = group.correctiveAction.resolutionMode || 'guard';
      const order = resolutionMode === 'recover'
        ? `Recover ${group.connectorLabel} before scaling anything stacked behind it.`
        : resolutionMode === 'reroute'
          ? `Reroute affected work away from ${group.connectorLabel} until the safer lane is clear.`
          : `Keep ${group.connectorLabel} on a guarded approval lane until execution pressure settles.`;

      return {
        available: true,
        key: group.key,
        connectorLabel: group.connectorLabel,
        connectorStatus: group.connectorStatus,
        connectorMode: group.connectorMode,
        guardedCount: group.guardedCount,
        draftCount: group.draftCount,
        affectedCount,
        affectedBranches: group.tasks.slice(0, 4),
        tone,
        title,
        detail,
        order,
        resolutionMode,
        correctiveAction: group.correctiveAction,
        opsPrompt: buildConnectorOpsPrompt({
          connectorLabel: group.connectorLabel,
          actionLabel: group.correctiveAction.actionLabel || group.correctiveAction.label || 'stabilize connector',
          targetRole: group.correctiveAction.targetRole,
          targetApprovalPosture: group.correctiveAction.targetApprovalPosture,
          detail,
          branchTitles: group.tasks.slice(0, 4).map((task) => task.title),
        }),
      };
    })
    .sort((a, b) => {
      if (b.affectedCount !== a.affectedCount) return b.affectedCount - a.affectedCount;
      if (b.guardedCount !== a.guardedCount) return b.guardedCount - a.guardedCount;
      return b.draftCount - a.draftCount;
    });

  if (!rankedGroups.length) {
    return {
      available: false,
      tone: 'teal',
      title: 'No shared connector blocker',
      detail: 'Connector-backed branches are not currently clustering behind the same connector lane.',
      groups: [],
      topGroup: null,
    };
  }

  return {
    available: true,
    tone: rankedGroups[0].tone,
    title: rankedGroups[0].title,
    detail: rankedGroups[0].detail,
    groups: rankedGroups,
    topGroup: rankedGroups[0],
  };
}

export function formatBranchConnectorBlocker(posture = null) {
  if (!posture?.available) return null;
  const systems = Array.isArray(posture.systems) ? posture.systems : [];
  if (!systems.length) {
    return posture.detail || null;
  }
  const labels = systems.map((system) => `${system.label} (${system.requiredPermissionMode})`);
  if (posture.requiresHumanGate) {
    return `Guarded by ${labels.join(', ')}. Keep this branch close to approval or verification before live execution.`;
  }
  if (posture.modes.includes('draft')) {
    return `Draft-capable through ${labels.join(', ')}. Prepare work here, but keep review close before scale.`;
  }
  return `Read-only through ${labels.join(', ')}. Safe to lean on research or ops lanes first.`;
}

export function getBranchConnectorCorrectiveAction(posture = null) {
  if (!posture?.available) return null;
  const systems = Array.isArray(posture.systems) ? posture.systems : [];
  const primarySystem = systems[0] || null;
  const label = primarySystem?.label || 'connector lane';

  if (systems.some((system) => ['missing', 'error'].includes(system.status))) {
    return {
      label: `Reconnect ${label}`,
      detail: `${label} is missing or offline for the required branch posture. Restore the connector before trying to scale live execution.`,
      actionLabel: 'Reconnect connector',
      resolutionMode: 'recover',
      targetRole: posture.preferredRole || 'ops',
      targetApprovalPosture: posture.recommendedApprovalLevel || 'human_required',
      opsPrompt: buildConnectorOpsPrompt({
        connectorLabel: label,
        actionLabel: 'Reconnect connector',
        targetRole: posture.preferredRole || 'ops',
        targetApprovalPosture: posture.recommendedApprovalLevel || 'human_required',
        detail: `${label} is missing or offline for the required branch posture. Restore the connector before trying to scale live execution.`,
      }),
    };
  }

  if (systems.some((system) => system.status === 'degraded')) {
    return {
      label: `Hold ${label} on approval`,
      detail: `${label} is degraded, so keep this branch on a human-aware lane until connector health recovers.`,
      actionLabel: 'Hold for approval',
      resolutionMode: 'guard',
      targetRole: posture.preferredRole || 'verifier',
      targetApprovalPosture: posture.recommendedApprovalLevel || 'human_required',
      opsPrompt: buildConnectorOpsPrompt({
        connectorLabel: label,
        actionLabel: 'Hold for approval',
        targetRole: posture.preferredRole || 'verifier',
        targetApprovalPosture: posture.recommendedApprovalLevel || 'human_required',
        detail: `${label} is degraded, so keep this branch on a human-aware lane until connector health recovers.`,
      }),
    };
  }

  if (systems.some((system) => system.status === 'limited')) {
    const wantsWrite = systems.some((system) => system.requiredPermissionMode === 'write');
    return {
      label: wantsWrite ? `Downgrade ${label} to draft or reconnect write access` : `Reroute ${label} to read-only work`,
      detail: wantsWrite
        ? `${label} does not currently expose the required write path. Either reconnect broader permission scope or keep this branch in draft mode.`
        : `${label} is only safe for lighter access right now, so reroute the branch toward read-only or research work.`,
      actionLabel: wantsWrite ? 'Downgrade to draft' : 'Reroute read-only',
      resolutionMode: wantsWrite ? 'guard' : 'reroute',
      targetRole: posture.preferredRole || (wantsWrite ? 'ops' : 'researcher'),
      targetApprovalPosture: posture.recommendedApprovalLevel || (wantsWrite ? 'risk_weighted' : 'auto_low_risk'),
      opsPrompt: buildConnectorOpsPrompt({
        connectorLabel: label,
        actionLabel: wantsWrite ? 'Downgrade to draft' : 'Reroute read-only',
        targetRole: posture.preferredRole || (wantsWrite ? 'ops' : 'researcher'),
        targetApprovalPosture: posture.recommendedApprovalLevel || (wantsWrite ? 'risk_weighted' : 'auto_low_risk'),
        detail: wantsWrite
          ? `${label} does not currently expose the required write path. Either reconnect broader permission scope or keep this branch in draft mode.`
          : `${label} is only safe for lighter access right now, so reroute the branch toward read-only or research work.`,
      }),
    };
  }

  if (posture.requiresHumanGate) {
    return {
      label: `Keep ${label} close to approval`,
      detail: `${label} is live-write sensitive, so keep this branch on a guarded lane and verify before release.`,
      actionLabel: 'Hold for approval',
      resolutionMode: 'guard',
      targetRole: posture.preferredRole || 'verifier',
      targetApprovalPosture: posture.recommendedApprovalLevel || 'human_required',
      opsPrompt: buildConnectorOpsPrompt({
        connectorLabel: label,
        actionLabel: 'Hold for approval',
        targetRole: posture.preferredRole || 'verifier',
        targetApprovalPosture: posture.recommendedApprovalLevel || 'human_required',
        detail: `${label} is live-write sensitive, so keep this branch on a guarded lane and verify before release.`,
      }),
    };
  }

  if (posture.modes.includes('draft')) {
    return {
      label: `Keep ${label} in draft posture`,
      detail: `${label} can prepare the work safely, but the branch should still stop before a live send or write step.`,
      actionLabel: 'Keep draft posture',
      resolutionMode: 'guard',
      targetRole: posture.preferredRole || 'ops',
      targetApprovalPosture: posture.recommendedApprovalLevel || 'risk_weighted',
      opsPrompt: buildConnectorOpsPrompt({
        connectorLabel: label,
        actionLabel: 'Keep draft posture',
        targetRole: posture.preferredRole || 'ops',
        targetApprovalPosture: posture.recommendedApprovalLevel || 'risk_weighted',
        detail: `${label} can prepare the work safely, but the branch should still stop before a live send or write step.`,
      }),
    };
  }

  return {
    label: `Reroute ${label} to read-only`,
    detail: `${label} is safe for read-only work, so use research or ops lanes first and keep heavier write lanes free for higher-risk branches.`,
    actionLabel: 'Reroute read-only',
    resolutionMode: 'reroute',
    targetRole: posture.preferredRole || 'researcher',
    targetApprovalPosture: posture.recommendedApprovalLevel || 'auto_low_risk',
    opsPrompt: buildConnectorOpsPrompt({
      connectorLabel: label,
      actionLabel: 'Reroute read-only',
      targetRole: posture.preferredRole || 'researcher',
      targetApprovalPosture: posture.recommendedApprovalLevel || 'auto_low_risk',
      detail: `${label} is safe for read-only work, so use research or ops lanes first and keep heavier write lanes free for higher-risk branches.`,
    }),
  };
}

export function buildConnectorActionDraft(correctiveAction = null, options = {}) {
  if (!correctiveAction?.label) return null;
  const affectedBranches = Array.isArray(options.affectedBranches) ? options.affectedBranches.filter(Boolean) : [];
  return {
    quickstartPrompt: correctiveAction.opsPrompt || buildConnectorOpsPrompt({
      connectorLabel: options.connectorLabel || 'connector lane',
      actionLabel: correctiveAction.actionLabel || correctiveAction.label,
      targetRole: correctiveAction.targetRole,
      targetApprovalPosture: correctiveAction.targetApprovalPosture,
      detail: correctiveAction.detail || '',
      branchTitles: affectedBranches,
    }),
    notice: options.notice || `Staged connector recovery draft: ${correctiveAction.actionLabel || correctiveAction.label}.`,
    connectorActionBrief: {
      title: options.title || correctiveAction.label,
      actionLabel: correctiveAction.actionLabel || 'Stage connector fix',
      connectorLabel: options.connectorLabel || 'connector lane',
      targetRole: correctiveAction.targetRole || 'ops',
      targetApprovalPosture: correctiveAction.targetApprovalPosture || 'risk_weighted',
      affectedBranches,
      expectedImprovement: options.expectedImprovement || correctiveAction.detail,
      verificationTarget: options.verificationTarget || 'Verify connector health, permission posture, and safe lane routing before resuming live execution.',
      successCriteria: options.successCriteria || 'The blocked connector branches move back onto stable lanes without forcing surprise approval or write failures.',
      rollbackCriteria: options.rollbackCriteria || 'If the connector remains degraded, permission-limited, or still forces guarded write failures, keep the lane hardened and back out the attempted recovery path.',
    },
  };
}

export function hardenApprovalLevel(current = 'risk_weighted', recommended = 'risk_weighted') {
  const currentPriority = APPROVAL_PRIORITY[current] ?? APPROVAL_PRIORITY.risk_weighted;
  const recommendedPriority = APPROVAL_PRIORITY[recommended] ?? APPROVAL_PRIORITY.risk_weighted;
  return currentPriority >= recommendedPriority ? current : recommended;
}

export function buildExecutionReadiness({ payload = {}, routingDecision = {}, connectedSystems = [] } = {}) {
  const requiredCapabilities = Array.isArray(routingDecision.requiredCapabilities) ? routingDecision.requiredCapabilities : [];
  const baseCoverage = resolveCapabilityCoverage(requiredCapabilities, payload);
  const requirementEntries = inferRequirementEntries({ payload, routingDecision });
  const capabilityGraph = buildConnectedSystemCapabilityGraph(connectedSystems);
  const normalizedSystems = capabilityGraph.systems;

  const requiredSystems = requirementEntries.map((requirement) => {
    const requiredPermissionMode = getRequiredPermissionMode({ requirementKey: requirement.key, payload });
    const matches = normalizedSystems.filter((system) => requirement.aliases.some((alias) => system.searchBlob.includes(alias) || system.capabilityTokens.includes(alias)));
    const permissionEligibleMatches = matches.filter((system) => permissionSatisfies(system.permissionScope, requiredPermissionMode));
    const connectedMatch = permissionEligibleMatches.find((system) => system.normalizedStatus === 'connected') || null;
    const degradedMatches = matches.filter((system) => system.normalizedStatus === 'degraded');
    const degradedEligibleMatches = degradedMatches.filter((system) => permissionSatisfies(system.permissionScope, requiredPermissionMode));
    const blockedMatches = matches.filter((system) => system.normalizedStatus === 'error');
    const limitedMatches = matches.filter((system) => {
      if (['error', 'offline', 'disconnected', 'failed'].includes(system.normalizedStatus)) return false;
      return !permissionSatisfies(system.permissionScope, requiredPermissionMode);
    });
    const status = connectedMatch
      ? 'connected'
      : degradedEligibleMatches.length
        ? 'degraded'
        : limitedMatches.length
          ? 'limited'
        : matches.length
          ? 'error'
          : 'missing';

    return {
      key: requirement.key,
      label: requirement.label,
      reason: requirement.reason,
      status,
      covered: status === 'connected',
      degraded: status === 'degraded',
      limited: status === 'limited',
      requiredPermissionMode,
      matches: matches.map((system) => ({
        id: system.id || null,
        integrationKey: system.integrationKey || '',
        displayName: system.displayName || system.integrationKey || requirement.label,
        status: system.normalizedStatus,
        permissionScope: system.permissionScope || [],
        domain: system.domain || 'general',
      })),
      degradedCount: degradedEligibleMatches.length,
      blockedCount: blockedMatches.length,
      limitedCount: limitedMatches.length,
      permissionCovered: status === 'connected' || status === 'degraded',
      availablePermissionScopes: Array.from(new Set(limitedMatches.flatMap((system) => system.permissionScope || []))),
    };
  });

  const externalCapabilityCoverage = requiredSystems.map((system) => ({
    capability: system.key,
    covered: system.covered,
    source: system.covered ? system.label : 'missing_system',
    requiredPermissionMode: system.requiredPermissionMode,
  }));

  const capabilityCoverage = [...baseCoverage, ...externalCapabilityCoverage]
    .reduce((acc, entry) => {
      const existingIndex = acc.findIndex((candidate) => candidate.capability === entry.capability);
      if (existingIndex === -1) {
        acc.push(entry);
        return acc;
      }
      if (!acc[existingIndex].covered && entry.covered) {
        acc[existingIndex] = entry;
      }
      return acc;
    }, []);

  const missingCapabilities = capabilityCoverage.filter((entry) => !entry.covered).map((entry) => entry.capability);
  const missingSystems = requiredSystems.filter((system) => system.status === 'missing' || system.status === 'error');
  const degradedSystems = requiredSystems.filter((system) => system.status === 'degraded');
  const limitedSystems = requiredSystems.filter((system) => system.status === 'limited');
  const coveredCount = countCovered(capabilityCoverage);
  const totalCount = Math.max(capabilityCoverage.length, 1);
  const coveragePercent = Math.round((coveredCount / totalCount) * 100);
  const draftOnlyComms = requiredCapabilities.includes('comms') && !requiredSystems.some((system) => system.key === 'comms');
  const writeSensitive = requiredSystems.some((system) => ['draft', 'write'].includes(system.requiredPermissionMode));
  const readOnlySensitive = requiredSystems.length > 0 && requiredSystems.every((system) => system.requiredPermissionMode === 'read');
  const localFirstEligible = requiredSystems.length === 0 && requiredCapabilities.every((capability) => INTERNAL_CAPABILITY_KEYS.has(normalizeText(capability)));
  const fallbackStrategy = localFirstEligible
    ? 'local_first'
    : (missingSystems.length > 0 || degradedSystems.length > 0 || limitedSystems.length > 0) && readOnlySensitive && !writeSensitive
      ? 'read_only_reroute'
      : 'guarded_external';

  let readiness = 'ready';
  let tone = 'teal';
  let title = 'Execution lane is launch-ready';
  let detail = 'Required capability coverage is in place, so Commander can route and launch without adding a new connector gate.';
  let recommendedApprovalLevel = routingDecision.approvalLevel || 'risk_weighted';
  let requiresHumanGate = false;

  if (missingSystems.length > 0 || missingCapabilities.length > 0 || limitedSystems.length > 0) {
    readiness = 'blocked';
    tone = 'rose';
    title = limitedSystems.length > 0 && missingSystems.length === 0 && missingCapabilities.length === 0
      ? 'Execution lane is permission-limited'
      : 'Execution lane is missing required system coverage';
    const limitedDetail = limitedSystems.map((system) => `${system.label} only has ${system.availablePermissionScopes.length ? system.availablePermissionScopes.join('/') : 'limited'} access but this mission needs ${system.requiredPermissionMode}.`);
    detail = `Commander is missing ${[...missingSystems.map((system) => system.label), ...missingCapabilities.map((capability) => humanize(capability))].join(', ')}${limitedDetail.length ? `${missingSystems.length || missingCapabilities.length ? '. ' : ''}${limitedDetail.join(' ')}` : ''} for this mission, so execution should stop at a human gate before it scales.`;
    recommendedApprovalLevel = 'human_required';
    requiresHumanGate = true;
  } else if (degradedSystems.length > 0) {
    readiness = 'watch';
    tone = 'amber';
    title = 'Execution lane needs a guarded launch';
    detail = `${degradedSystems.map((system) => system.label).join(', ')} is connected but degraded, so Commander should keep this mission human-aware until the system health improves.`;
    recommendedApprovalLevel = hardenApprovalLevel(routingDecision.approvalLevel || 'risk_weighted', 'risk_weighted');
    requiresHumanGate = true;
  }

  if (draftOnlyComms && readiness === 'ready') {
    detail = 'Draft-only communications can run on the internal lane without requiring an external send path.';
  }

  if (localFirstEligible && readiness === 'ready') {
    detail = 'This mission can stay on internal lanes, so Commander can favor local-first execution without waiting on external connector posture.';
  } else if (fallbackStrategy === 'read_only_reroute' && readiness !== 'ready') {
    detail = `${detail} Because the blocked connector work is read-only, Commander should prefer internal research or read-only reroute instead of holding the whole mission for live connector recovery.`;
  } else if (writeSensitive && readiness === 'ready') {
    detail = `${detail} This mission depends on external ${requiredSystems.map((system) => system.requiredPermissionMode).filter((mode) => ['draft', 'write'].includes(mode)).join('/')} permissions, so local-first execution should stop at a human gate before live send paths are used.`;
  }

  const guardrails = [
    ...missingSystems.map((system) => `${system.label} is missing, so Commander should not auto-scale external execution yet.`),
    ...degradedSystems.map((system) => `${system.label} is degraded, so Commander should keep a human gate until connector health stabilizes.`),
    ...limitedSystems.map((system) => `${system.label} only exposes ${system.availablePermissionScopes.length ? system.availablePermissionScopes.join('/') : 'limited'} access, so Commander should not treat it as a ${system.requiredPermissionMode} path yet.`),
    ...(writeSensitive ? ['External write-capable execution should stay human-aware until connector permissions are explicit and healthy.'] : []),
    ...(localFirstEligible ? ['Mission can stay local-first because no external connector write path is required.'] : []),
    ...(fallbackStrategy === 'read_only_reroute' ? ['Read-only connector work should reroute toward internal research or safer ops lanes until connector health or access improves.'] : []),
  ];

  return {
    readiness,
    tone,
    title,
    detail,
    coveragePercent,
    coveredCount,
    totalCount,
    requiredCapabilities,
    capabilityCoverage,
    missingCapabilities,
    requiredSystems,
    missingSystems,
    degradedSystems,
    limitedSystems,
    recommendedApprovalLevel,
    requiresHumanGate,
    guardrails,
    localFirstEligible,
    fallbackStrategy,
    capabilityGraphSummary: capabilityGraph.summary,
    summary: `${readiness} • ${coveragePercent}% capability coverage${requiredSystems.length ? ` • ${requiredSystems.filter((system) => system.covered).length}/${requiredSystems.length} external systems ready` : ' • internal lanes only'}`,
  };
}

export function getMissionLaunchReadiness(interventions = [], mission = null) {
  const missionId = mission?.rootMissionId || mission?.id || null;
  const matching = interventions
    .filter((entry) => entry?.eventType === 'mission_create')
    .filter((entry) => {
      if (!missionId) return true;
      return entry.rootMissionId === missionId || entry.taskId === missionId;
    })
    .sort((left, right) => new Date(right.timestamp || right.createdAt || 0).getTime() - new Date(left.timestamp || left.createdAt || 0).getTime());

  const metadata = matching[0]?.metadata?.launchReadiness;
  if (!metadata || typeof metadata !== 'object') return null;

  return {
    ...metadata,
    coveragePercent: Number(metadata.coveragePercent || 0),
    coveredCount: Number(metadata.coveredCount || 0),
    totalCount: Number(metadata.totalCount || 0),
    title: metadata.title || 'Execution readiness',
    detail: metadata.detail || 'Commander did not persist a launch readiness explanation for this mission.',
    summary: metadata.summary || null,
    fallbackStrategy: metadata.fallbackStrategy || null,
    requiredSystems: Array.isArray(metadata.requiredSystems) ? metadata.requiredSystems : [],
    missingCapabilities: Array.isArray(metadata.missingCapabilities) ? metadata.missingCapabilities : [],
    guardrails: Array.isArray(metadata.guardrails) ? metadata.guardrails : [],
  };
}

export function formatFallbackStrategyLabel(strategy = null) {
  if (strategy === 'local_first') return 'Local-first fallback';
  if (strategy === 'read_only_reroute') return 'Read-only reroute';
  if (strategy === 'guarded_external') return 'Guarded external';
  return 'No fallback plan';
}

export function getFallbackStrategyDetail(strategy = null) {
  if (strategy === 'local_first') {
    return 'Commander is preferring internal lanes first so connector pressure does not slow clean execution.';
  }
  if (strategy === 'read_only_reroute') {
    return 'Commander is rerouting read-only work toward safer internal or research lanes instead of waiting on connector recovery.';
  }
  if (strategy === 'guarded_external') {
    return 'Commander is keeping this work on a guarded external lane because connector recovery or approval posture still needs to stay close.';
  }
  return 'Commander has not persisted a fallback strategy for this mission yet.';
}

export function getLaunchReadinessPressure(interventions = []) {
  const missionCreateEntries = interventions
    .filter((entry) => entry?.eventType === 'mission_create')
    .map((entry) => entry?.metadata?.launchReadiness)
    .filter((entry) => entry && typeof entry === 'object');

  if (!missionCreateEntries.length) {
    return {
      available: false,
      score: 0,
      tone: 'teal',
      title: 'Connector readiness pressure is still forming',
      detail: 'Commander needs more persisted launch-readiness history before connector pressure should influence routing and bottleneck priority.',
    affectedMissionCount: 0,
    missingCount: 0,
    degradedCount: 0,
    limitedCount: 0,
    topSystems: [],
  };
  }

  const counts = new Map();
  let affectedMissionCount = 0;
  let missingCount = 0;
  let degradedCount = 0;
  let limitedCount = 0;

  missionCreateEntries.forEach((entry) => {
    const requiredSystems = Array.isArray(entry.requiredSystems) ? entry.requiredSystems : [];
    const pressuredSystems = requiredSystems.filter((system) => ['missing', 'error', 'degraded', 'limited'].includes(system.status));
    if (pressuredSystems.length > 0) {
      affectedMissionCount += 1;
    }
    pressuredSystems.forEach((system) => {
      const key = `${system.key || system.label}::${system.status}`;
      counts.set(key, {
        key: system.key || system.label,
        label: system.label || humanize(system.key),
        status: system.status,
        count: (counts.get(key)?.count || 0) + 1,
      });
      if (system.status === 'degraded') degradedCount += 1;
      else if (system.status === 'limited') limitedCount += 1;
      else missingCount += 1;
    });
  });

  const topSystems = Array.from(counts.values()).sort((left, right) => right.count - left.count).slice(0, 3);
  if (!topSystems.length) {
    return {
      available: true,
      score: 0,
      tone: 'teal',
      title: 'Connector readiness pressure is low',
      detail: 'Recent launches are not hitting missing or degraded external system gates.',
      affectedMissionCount: 0,
      missingCount: 0,
      degradedCount: 0,
      limitedCount: 0,
      topSystems: [],
    };
  }

  const tone = missingCount > 0 || limitedCount > 0 ? 'rose' : 'amber';
  const title = missingCount > 0
    ? 'Missing connector coverage is slowing execution'
    : limitedCount > 0
      ? 'Connector permissions are too narrow for live execution'
    : 'Degraded connectors are forcing guarded launches';
  const detail = missingCount > 0
    ? `${missingCount} missing-system gate${missingCount === 1 ? '' : 's'} across ${affectedMissionCount} recent mission${affectedMissionCount === 1 ? '' : 's'} are pushing work into safer approval posture.`
    : limitedCount > 0
      ? `${limitedCount} permission-limited connector gate${limitedCount === 1 ? '' : 's'} across ${affectedMissionCount} recent mission${affectedMissionCount === 1 ? '' : 's'} are blocking live write paths and forcing safer execution posture.`
    : `${degradedCount} degraded-system gate${degradedCount === 1 ? '' : 's'} across ${affectedMissionCount} recent mission${affectedMissionCount === 1 ? '' : 's'} are forcing Commander into more guarded launch posture.`;

  return {
    available: true,
    score: (missingCount * 10) + (limitedCount * 8) + (degradedCount * 6),
    tone,
    title,
    detail,
    affectedMissionCount,
    missingCount,
    degradedCount,
    limitedCount,
    topSystems,
  };
}
