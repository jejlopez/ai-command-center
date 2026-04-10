import { getCommanderLane, normalizeModelProvider } from './commanderPolicy';

export const DEFAULT_ROUTING_POLICY_NAME = 'Adaptive Commander Default';

function hasAnyNeedle(text, needles) {
  const lower = String(text || '').toLowerCase();
  return needles.some(needle => lower.includes(needle));
}

export function inferMissionDomain(payload = {}) {
  const text = `${payload.intent || ''} ${payload.targetType || ''} ${payload.outputType || ''}`;
  if (hasAnyNeedle(text, ['code', 'repo', 'bug', 'build', 'deploy', 'pr', 'test'])) return 'build';
  if (hasAnyNeedle(text, ['research', 'analyze', 'market', 'competitor', 'brief'])) return 'research';
  if (hasAnyNeedle(text, ['crm', 'pipeline', 'deal', 'lead', 'customer', 'outreach'])) return 'sell';
  if (hasAnyNeedle(text, ['ops', 'schedule', 'report', 'monitor', 'dashboard'])) return 'operate';
  if (hasAnyNeedle(text, ['finance', 'invoice', 'budget', 'cash', 'revenue'])) return 'money';
  return 'general';
}

export function inferIntentType(payload = {}) {
  const text = `${payload.intent || ''} ${payload.outputType || ''}`;
  if (hasAnyNeedle(text, ['debug', 'fix', 'repair'])) return 'debug';
  if (hasAnyNeedle(text, ['build', 'create', 'implement', 'ship'])) return 'build';
  if (hasAnyNeedle(text, ['research', 'analyze', 'investigate'])) return 'research';
  if (hasAnyNeedle(text, ['report', 'summary', 'brief'])) return 'report';
  if (payload.repeat || payload.when === 'repeat') return 'automation';
  return 'general';
}

export function inferBudgetClass(payload = {}) {
  if (payload.mode === 'efficient') return 'lean';
  if (payload.mode === 'fast') return 'premium';
  return 'balanced';
}

export function inferRiskLevel(payload = {}) {
  const text = `${payload.intent || ''} ${payload.targetType || ''}`;
  if (payload.requiresApproval) return 'high';
  if (hasAnyNeedle(text, ['delete', 'payment', 'finance', 'bank', 'customer', 'email send', 'production'])) return 'high';
  if (hasAnyNeedle(text, ['deploy', 'schema', 'migration', 'write', 'update'])) return 'medium';
  return 'low';
}

export function inferApprovalLevel(payload = {}) {
  return inferRiskLevel(payload) === 'high' ? 'human_required' : 'risk_weighted';
}

export function inferRequiredCapabilities(payload = {}) {
  const capabilities = new Set();
  const targetType = String(payload.targetType || '').toLowerCase();
  const outputType = String(payload.outputType || '').toLowerCase();
  const text = `${payload.intent || ''} ${targetType} ${outputType}`;

  if (hasAnyNeedle(text, ['repo', 'code', 'build', 'pr', 'test'])) capabilities.add('code');
  if (hasAnyNeedle(text, ['research', 'analyze', 'investigate', 'web'])) capabilities.add('research');
  if (hasAnyNeedle(text, ['crm', 'customer', 'pipeline', 'deal'])) capabilities.add('crm');
  if (hasAnyNeedle(text, ['email', 'slack', 'message', 'comms'])) capabilities.add('comms');
  if (hasAnyNeedle(text, ['report', 'dashboard', 'metrics'])) capabilities.add('reporting');
  if (hasAnyNeedle(text, ['finance', 'budget', 'revenue'])) capabilities.add('finance');

  return Array.from(capabilities);
}

export function inferContextPackIds(payload = {}) {
  const packs = new Set();
  const targetType = String(payload.targetType || '').toLowerCase();
  const outputType = String(payload.outputType || '').toLowerCase();
  const text = `${payload.intent || ''} ${targetType} ${outputType}`.toLowerCase();

  packs.add('commander-core');

  if (hasAnyNeedle(text, ['repo', 'code', 'build', 'bug', 'pr', 'test'])) packs.add('repo-workspace');
  if (hasAnyNeedle(text, ['research', 'analyze', 'investigate', 'market', 'competitor'])) packs.add('research-dossier');
  if (hasAnyNeedle(text, ['crm', 'deal', 'lead', 'pipeline', 'customer', 'pipedrive'])) packs.add('crm-accounts');
  if (hasAnyNeedle(text, ['email', 'outreach', 'reply', 'message', 'draft'])) packs.add('comms-drafts');
  if (hasAnyNeedle(text, ['ops', 'shipment', 'tracking', 'delay', 'schedule'])) packs.add('ops-telemetry');
  if (hasAnyNeedle(text, ['report', 'brief', 'summary', 'doc', 'notes'])) packs.add('briefing-memory');
  if (hasAnyNeedle(text, ['finance', 'invoice', 'budget', 'revenue', 'cash'])) packs.add('finance-ledger');

  return Array.from(packs);
}

export function inferRecommendedSkillNames(payload = {}) {
  const skills = new Set();
  const text = `${payload.intent || ''} ${payload.targetType || ''} ${payload.outputType || ''}`.toLowerCase();

  if (hasAnyNeedle(text, ['research', 'analyze', 'investigate', 'market'])) skills.add('research');
  if (hasAnyNeedle(text, ['report', 'brief', 'summary', 'notes'])) skills.add('synthesis');
  if (hasAnyNeedle(text, ['code', 'repo', 'build', 'bug', 'pr', 'test'])) skills.add('engineering');
  if (hasAnyNeedle(text, ['crm', 'pipeline', 'deal', 'lead', 'customer'])) skills.add('crm');
  if (hasAnyNeedle(text, ['email', 'outreach', 'reply', 'message'])) skills.add('outreach');
  if (hasAnyNeedle(text, ['ops', 'shipment', 'tracking', 'schedule'])) skills.add('operations');

  return Array.from(skills);
}

export function deriveRoutingDecision(payload = {}, agent = null, policy = null) {
  const commanderLane = getCommanderLane();
  const domain = inferMissionDomain(payload);
  const intentType = inferIntentType(payload);
  const budgetClass = inferBudgetClass(payload);
  const riskLevel = inferRiskLevel(payload);
  const approvalLevel = inferApprovalLevel(payload);
  const requiredCapabilities = inferRequiredCapabilities(payload);
  const contextPackIds = inferContextPackIds(payload);
  const recommendedSkillNames = inferRecommendedSkillNames(payload);

  const provider = normalizeModelProvider(
    policy?.preferredProvider || agent?.provider || commanderLane.provider
  );
  const model = policy?.preferredModel || agent?.model || commanderLane.model;
  const agentRole = policy?.preferredAgentRole || agent?.role || 'commander';

  const reasons = [
    `${domain} domain`,
    `${intentType} intent`,
    `${budgetClass} budget`,
    `${riskLevel} risk`,
    `${agentRole} lane`,
  ];

  return {
    domain,
    intentType,
    budgetClass,
    riskLevel,
    approvalLevel,
    requiredCapabilities,
    contextPackIds,
    recommendedSkillNames,
    selectedProvider: provider,
    selectedModel: model,
    selectedAgentRole: agentRole,
    routingReason: `${reasons.join(' | ')} | ${contextPackIds.join(', ')} context`,
  };
}

export function buildDefaultRoutingPolicy(userId) {
  const commanderLane = getCommanderLane();
  return {
    user_id: userId,
    name: DEFAULT_ROUTING_POLICY_NAME,
    description: 'Default adaptive routing for Commander-created missions.',
    is_default: true,
    task_domain: 'general',
    intent_type: 'general',
    risk_level: 'medium',
    budget_class: 'balanced',
    latency_class: 'balanced',
    preferred_provider: commanderLane.provider,
    preferred_model: commanderLane.model,
    preferred_agent_role: 'commander',
    fallback_order: [
      { provider: commanderLane.provider, model: commanderLane.model, role: 'commander' },
      { provider: 'OpenAI', model: 'GPT-5.4-mini', role: 'researcher' },
      { provider: 'Ollama', model: 'local-efficient', role: 'utility' },
    ],
    approval_rule: 'risk_weighted',
    context_policy: 'minimal',
    parallelization_policy: 'adaptive',
    evidence_required: false,
    active: true,
  };
}

export function mapRoutingPolicyFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description || '',
    isDefault: row.is_default ?? false,
    taskDomain: row.task_domain || 'general',
    intentType: row.intent_type || 'general',
    riskLevel: row.risk_level || 'medium',
    budgetClass: row.budget_class || 'balanced',
    latencyClass: row.latency_class || 'balanced',
    preferredProvider: normalizeModelProvider(row.preferred_provider),
    preferredModel: row.preferred_model || '',
    preferredAgentRole: row.preferred_agent_role || 'commander',
    fallbackOrder: Array.isArray(row.fallback_order) ? row.fallback_order : [],
    approvalRule: row.approval_rule || 'risk_weighted',
    contextPolicy: row.context_policy || 'minimal',
    parallelizationPolicy: row.parallelization_policy || 'adaptive',
    evidenceRequired: row.evidence_required ?? false,
    active: row.active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
