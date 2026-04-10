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
