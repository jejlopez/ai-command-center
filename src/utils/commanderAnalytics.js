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
} = {}) {
  const normalizedInterventions = normalizeInterventionEvents(interventions, logs);
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
    rescueRate: Math.round((rescueTouchedRoots.size / totalMissionRoots) * 100),
    patternStrength,
    policyDemotionPressure,
    fleetPosture,
    confidenceClosure,
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
      if (signals.confidenceClosure.posture === 'drifting' && /(routing|lane|provider|model|automation|rescue|intervention|guardrail|confidence)/.test(`${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase())) {
        score += 16;
      } else if (signals.confidenceClosure.posture === 'cautious' && /(routing|automation|rescue|confidence)/.test(`${recommendation.title || ''} ${recommendation.description || ''}`.toLowerCase())) {
        score += 8;
      }
      const whyNow = keywordBoost.reasons[0]
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

export function getPatternApprovalBiasSummary({ winningPattern = null, routingDecision = null, observedWinningLane = null } = {}) {
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
  const recommendedApprovalLevel = laneApproval === 'human_required' || patternApproval === 'human_required'
    ? 'human_required'
    : canLeanOnPattern
      ? patternApproval
      : routingDecision?.approvalLevel || patternApproval;
  const tone = recommendedApprovalLevel === 'human_required'
    ? 'amber'
    : recommendedApprovalLevel === 'auto_low_risk'
      ? 'teal'
      : 'blue';

  return {
    available: true,
    label: `${winningPattern.domain} / ${winningPattern.intentType} approval default`,
    detail: `${winningPattern.executionStrategy} with ${patternApproval} approval is the strongest repeating shape across ${winningPattern.runs} runs, so Commander should bias this mission family toward ${recommendedApprovalLevel}.`,
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

  if (lowTrust || rescuePressure >= 2 || guardrailPressure >= 2 || avgOutcome < 58) {
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
  }

  const reasons = [
    rescuePressure > 0 ? `${rescuePressure} rescue intervention${rescuePressure === 1 ? '' : 's'} landed on this flow.` : null,
    guardrailPressure > 0 ? `${guardrailPressure} recurring guardrail${guardrailPressure === 1 ? '' : 's'} already triggered on this flow.` : null,
    tuningPressure > 0 ? `${tuningPressure} tuning change${tuningPressure === 1 ? '' : 's'} suggest the workflow is still settling.` : null,
    avgOutcome > 0 ? `Average runtime quality is ${avgOutcome}.` : null,
  ].filter(Boolean);

  const detail = posture === 'tighten'
    ? 'Runtime trust is drifting enough that Commander should raise the human bar and slow the automation down before it creates more cleanup.'
    : posture === 'watch'
      ? 'Economics are promising, but runtime memory still says this flow should stay in a managed planning posture for now.'
      : 'This recurring flow is holding cleanly enough that Commander can let it run with a lighter approval posture.';

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
    };
    current.runs += 1;
    current.totalCost += Number(task.costUsd || 0);
    current.totalDurationMs += Number(task.durationMs || 0);
    if (task.intentType === 'automation' || task.scheduleType === 'recurring') current.automatedRuns += 1;
    if (task.rootMissionId || task.id) current.rootMissionIds.add(task.rootMissionId || task.id);
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .filter((entry) => entry.runs >= 2)
    .map((entry) => {
      const rootMissionIds = [...entry.rootMissionIds];
      const relatedInterventions = normalizedInterventions.filter((item) => rootMissionIds.includes(item.rootMissionId || item.taskId));
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
      const trustDetail = maturityScore >= 72
        ? 'This recurring pattern is proving itself with enough clean runtime history to scale more confidently.'
        : maturityScore >= 50
          ? 'The economics are promising, but guardrails or rescue pressure still justify a tighter posture.'
          : 'Runtime memory is still noisy here, so keep cadence and approval posture conservative until the flow hardens.';
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
      score: lateSchedules * 8,
      title: lateSchedules > 0 ? 'Automation timing drift is visible' : 'Automation timing is healthy',
      detail: lateSchedules > 0
        ? `${lateSchedules} recurring flows are behind schedule, which weakens trust in self-driving execution.`
        : 'Recurring flows are not visibly behind schedule.',
      action: 'Reset schedule drift before launching more automation.',
      tone: lateSchedules > 0 ? 'amber' : 'teal',
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
