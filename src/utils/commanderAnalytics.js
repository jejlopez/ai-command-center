function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

export function getObservedModelBenchmarks(tasks = [], agents = []) {
  const grouped = new Map();

  tasks
    .filter((task) => task.routingReason)
    .forEach((task) => {
      const agent = agents.find((candidate) => candidate.id === task.agentId);
      const model = agent?.model || task.modelOverride || 'Adaptive lane';
      const provider = inferAgentProvider(agent || task);
      const key = `${provider}::${model}`;
      const quality = scoreTaskOutcome(task);
      const current = grouped.get(key) || {
        key,
        model,
        provider,
        runs: 0,
        completedRuns: 0,
        totalCost: 0,
        totalDurationMs: 0,
        totalQuality: 0,
      };

      current.runs += 1;
      current.completedRuns += isTaskClosed(task) ? 1 : 0;
      current.totalCost += Number(task.costUsd || 0);
      current.totalDurationMs += Number(task.durationMs || 0);
      current.totalQuality += quality.score;
      grouped.set(key, current);
    });

  return Array.from(grouped.values())
    .map((entry) => {
      const avgQuality = entry.runs ? entry.totalQuality / entry.runs : 0;
      const successRate = entry.runs ? (entry.completedRuns / entry.runs) * 100 : 0;
      const avgCost = entry.runs ? entry.totalCost / entry.runs : 0;
      const avgDurationMs = entry.runs ? entry.totalDurationMs / entry.runs : 0;
      const speedScore = avgDurationMs > 0 ? clamp(Math.round(100 - Math.min(80, avgDurationMs / 15000)), 20, 100) : 60;
      const costScore = avgCost > 0 ? clamp(Math.round(100 - Math.min(75, avgCost * 16)), 20, 100) : 95;
      const benchmarkScore = Math.round((avgQuality * 0.45) + (successRate * 0.3) + (speedScore * 0.15) + (costScore * 0.1));

      return {
        ...entry,
        avgQuality: Math.round(avgQuality),
        successRate: Math.round(successRate),
        avgCost,
        avgDurationMs,
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

export function getAutomationCandidates(tasks = [], humanHourlyRate = 150) {
  const grouped = new Map();

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
    };
    current.runs += 1;
    current.totalCost += Number(task.costUsd || 0);
    current.totalDurationMs += Number(task.durationMs || 0);
    if (task.intentType === 'automation' || task.scheduleType === 'recurring') current.automatedRuns += 1;
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .filter((entry) => entry.runs >= 2)
    .map((entry) => {
      const avgCost = entry.totalCost / entry.runs;
      const estimatedHours = entry.totalDurationMs > 0 ? entry.totalDurationMs / 3_600_000 : entry.runs * 0.25;
      const humanEquivalent = estimatedHours * humanHourlyRate;
      const roi = avgCost > 0 ? humanEquivalent / Math.max(entry.totalCost, 0.01) : humanEquivalent;
      const repetitionScore = entry.runs * 12;
      const automationScore = Math.round(clamp(repetitionScore + Math.min(35, roi * 8) + (entry.automatedRuns === 0 ? 10 : 0), 0, 100));
      return {
        ...entry,
        avgCost,
        estimatedHours,
        humanEquivalent,
        roi,
        automationScore,
      };
    })
    .sort((left, right) => {
      if (right.automationScore !== left.automationScore) return right.automationScore - left.automationScore;
      return right.runs - left.runs;
    })
    .slice(0, 6);
}
