import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getBatchCommandSignals } from './commanderAnalytics';

function formatOutputLabel(value) {
  return (value || 'summary').replaceAll('_', ' ');
}

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

function buildDoctrineItem({ id, owner, tone, title, detail, confidence, evidence, metrics }) {
  const snapshotHash = stableJson({ owner, tone, title, detail, confidence, evidence, metrics });
  return {
    id,
    owner,
    tone,
    title,
    detail,
    confidence,
    evidence,
    metrics,
    snapshotHash,
  };
}

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01'
    || message.includes('relation')
    || message.includes('does not exist')
    || message.includes('learning_memory');
}

function buildHistorySummary(history = []) {
  if (history.length < 2) return 'First recorded snapshot for this doctrine.';
  const latest = history[0];
  const previous = history[1];
  const delta = Number(latest.confidence || 0) - Number(previous.confidence || 0);
  if (delta > 0) return `Confidence up ${delta} from the previous snapshot.`;
  if (delta < 0) return `Confidence down ${Math.abs(delta)} from the previous snapshot.`;
  if (latest.title !== previous.title || latest.detail !== previous.detail) return 'Narrative changed while confidence held steady.';
  return 'Confidence is holding steady against the previous snapshot.';
}

function getMissionPatternSummary(tasks = []) {
  const grouped = tasks.reduce((acc, task) => {
    const key = `${task.domain || 'general'}::${task.intentType || 'general'}::${task.executionStrategy || 'sequential'}::${task.approvalLevel || 'risk_weighted'}`;
    if (!acc[key]) {
      acc[key] = {
        key,
        domain: task.domain || 'general',
        intentType: task.intentType || 'general',
        executionStrategy: task.executionStrategy || 'sequential',
        approvalLevel: task.approvalLevel || 'risk_weighted',
        runs: 0,
        completed: 0,
        cost: 0,
      };
    }
    acc[key].runs += 1;
    acc[key].cost += Number(task.costUsd || 0);
    if (['completed', 'done'].includes(task.status)) acc[key].completed += 1;
    return acc;
  }, {});

  const ranked = Object.values(grouped)
    .map((entry) => ({
      ...entry,
      completionRate: entry.runs ? entry.completed / entry.runs : 0,
      avgCost: entry.runs ? entry.cost / entry.runs : 0,
    }))
    .sort((left, right) => {
      if (right.completionRate !== left.completionRate) return right.completionRate - left.completionRate;
      if (right.runs !== left.runs) return right.runs - left.runs;
      return left.avgCost - right.avgCost;
    });

  return {
    winner: ranked[0] || null,
    ranked,
  };
}

function getRescueLoadSummary(tasks = [], logs = []) {
  const rescueLogs = logs.filter((log) => {
    const message = String(log.message || '');
    return (
      message.includes('[intervention-stop]')
      || message.includes('[intervention-cancel]')
      || message.includes('[intervention-retry]')
      || message.includes('[branch-routing]')
      || message.includes('[branch-dependency]')
    );
  });
  const rescueCount = rescueLogs.length;
  const rescueHours = rescueCount * 0.12;
  const rescueTouchedRoots = new Set();
  rescueLogs.forEach((entry) => {
    const match = String(entry.message || '').match(/root ([a-z0-9-]+)/i);
    if (match?.[1]) rescueTouchedRoots.add(match[1]);
  });
  const missionCount = Math.max(new Set(tasks.map((task) => task.rootMissionId || task.id).filter(Boolean)).size, 1);

  return {
    rescueCount,
    rescueHours,
    rescueTouchedRoots: rescueTouchedRoots.size,
    rescueRate: Math.round((rescueTouchedRoots.size / missionCount) * 100),
  };
}

async function fetchRecentOutcomeRows(userId) {
  const { data, error } = await supabase
    .from('task_outcomes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    if (isMissingTableError(error)) return { available: false, rows: [] };
    throw error;
  }

  return { available: true, rows: data || [] };
}

async function fetchRecentInterventionRows(userId) {
  const { data, error } = await supabase
    .from('task_interventions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) {
    if (isMissingTableError(error)) return { available: false, rows: [] };
    throw error;
  }

  return {
    available: true,
    rows: (data || []).map((row) => ({
      id: row.id,
      taskId: row.task_id || null,
      rootMissionId: row.root_mission_id || null,
      agentId: row.agent_id || null,
      eventType: row.event_type || 'override',
      eventSource: row.event_source || 'runtime',
      tone: row.tone || 'blue',
      message: row.message || '',
      domain: row.domain || 'general',
      intentType: row.intent_type || 'general',
      provider: row.provider || null,
      model: row.model || null,
      scheduleType: row.schedule_type || 'once',
      metadata: row.metadata || {},
      createdAt: row.created_at,
    })),
  };
}

async function fetchRecentBatchAuditLogs(userId) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id,message,timestamp,type')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(160);

  if (error) {
    if (isMissingTableError(error)) return { available: false, rows: [] };
    throw error;
  }

  return {
    available: true,
    rows: (data || [])
      .filter((row) => String(row.message || '').includes('[batch-intervention-]'))
      .map((row) => ({
        id: row.id,
        message: row.message || '',
        timestamp: row.timestamp || null,
        type: row.type || 'SYS',
      })),
  };
}

async function syncOutcomeDoctrineArtifacts(userId) {
  const outcomeResponse = await fetchRecentOutcomeRows(userId);
  if (!outcomeResponse.available) return { available: false };
  const interventionResponse = await fetchRecentInterventionRows(userId);
  if (!interventionResponse.available) return { available: false };
  const batchAuditResponse = await fetchRecentBatchAuditLogs(userId);
  if (!batchAuditResponse.available) return { available: false };

  const outcomes = outcomeResponse.rows;
  const interventions = interventionResponse.rows;
  const batchAuditLogs = batchAuditResponse.rows;
  if (!outcomes.length) return { available: true };

  const averageScore = Math.round(outcomes.reduce((sum, row) => sum + Number(row.score || 0), 0) / outcomes.length);
  const lowTrustCount = outcomes.filter((row) => String(row.trust || '') === 'low').length;
  const providerCounts = outcomes.reduce((acc, row) => {
    const key = row.provider || 'Adaptive';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const leadingProvider = Object.entries(providerCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || 'Adaptive';
  const doctrineFeedbackRows = outcomes
    .map((row) => String(row.doctrine_feedback || '').trim())
    .filter(Boolean);
  const doctrineFeedbackCounts = doctrineFeedbackRows.reduce((acc, feedback) => {
    acc[feedback] = (acc[feedback] || 0) + 1;
    return acc;
  }, {});
  const dominantFeedback = Object.entries(doctrineFeedbackCounts)
    .sort((left, right) => right[1] - left[1])[0] || null;
  const interventionCounts = interventions.reduce((acc, row) => {
    const key = row.eventType || 'other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const interventionLoad = Object.values(interventionCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  const reroutePressure = Number(interventionCounts.reroute || 0) + Number(interventionCounts.dependency || 0);
  const outcomePatterns = outcomes.reduce((acc, row) => {
    const key = `${row.domain || 'general'}::${row.intent_type || 'general'}::${row.execution_strategy || 'sequential'}::${row.approval_level || 'risk_weighted'}`;
    if (!acc[key]) {
      acc[key] = {
        key,
        domain: row.domain || 'general',
        intentType: row.intent_type || 'general',
        executionStrategy: row.execution_strategy || 'sequential',
        approvalLevel: row.approval_level || 'risk_weighted',
        runs: 0,
        totalScore: 0,
        totalCost: 0,
      };
    }
    acc[key].runs += 1;
    acc[key].totalScore += Number(row.score || 0);
    acc[key].totalCost += Number(row.cost_usd || 0);
    return acc;
  }, {});
  const winningPattern = Object.values(outcomePatterns)
    .map((entry) => ({
      ...entry,
      avgScore: entry.runs ? Math.round(entry.totalScore / entry.runs) : 0,
      avgCost: entry.runs ? entry.totalCost / entry.runs : 0,
    }))
    .sort((left, right) => {
      if (right.avgScore !== left.avgScore) return right.avgScore - left.avgScore;
      if (right.runs !== left.runs) return right.runs - left.runs;
      return left.avgCost - right.avgCost;
    })[0] || null;
  const rescueWeightedCost = interventionLoad > 0
    ? Number((outcomes.reduce((sum, row) => sum + Number(row.cost_usd || 0), 0) / Math.max(interventionLoad, 1)).toFixed(2))
    : 0;
  const batchSignals = getBatchCommandSignals(batchAuditLogs);
  const batchPressure = batchSignals.totalActions;
  const batchRetryPressure = Number(batchSignals.actionCounts.retry || 0);
  const batchRedirectPressure = Number(batchSignals.actionCounts.redirect || 0);
  const batchApprovePressure = Number(batchSignals.actionCounts.approve || 0);

  const doctrine = [
    buildDoctrineItem({
      id: 'outcome-memory',
      owner: 'Outcome Memory',
      tone: averageScore >= 70 ? 'teal' : 'rose',
      title: averageScore >= 70 ? 'Structured outcome memory is reinforcing the stack' : 'Outcome memory is signaling quality drift',
      detail: averageScore >= 70
        ? `Average outcome score is ${averageScore}, with ${lowTrustCount} low-trust branches still worth watching.`
        : `Average outcome score is ${averageScore}, which means doctrine should focus on weak branches before scaling further.`,
      confidence: averageScore,
      evidence: [
        `${outcomes.length} structured task outcomes are now stored in first-class memory.`,
        `${lowTrustCount} of those are marked low trust.`,
        `Current average score is ${averageScore}.`,
      ],
      metrics: {
        averageScore,
        totalOutcomes: outcomes.length,
        lowTrustCount,
      },
    }),
    buildDoctrineItem({
      id: 'provider-pressure',
      owner: 'Routing Memory',
      tone: 'blue',
      title: `${leadingProvider} is currently the dominant provider lane`,
      detail: `Structured outcomes show the heaviest successful traffic landing on ${leadingProvider}. That should shape escalation explanations and routing defaults.`,
      confidence: Math.min(92, 55 + outcomes.length),
      evidence: [
        `${leadingProvider} appears most often in structured outcome memory.`,
        'This signal now comes from first-class outcome records instead of log parsing.',
      ],
      metrics: {
        leadingProvider,
        providerCounts,
      },
    }),
    buildDoctrineItem({
      id: 'doctrine-feedback-memory',
      owner: 'Doctrine Memory',
      tone: dominantFeedback ? (averageScore >= 70 ? 'teal' : 'amber') : 'blue',
      title: dominantFeedback ? 'Outcome feedback is converging into repeatable doctrine' : 'Commander is still waiting for stronger doctrine feedback patterns',
      detail: dominantFeedback
        ? `The most repeated doctrine signal is "${dominantFeedback[0]}" and it has surfaced ${dominantFeedback[1]} times in structured outcome memory.`
        : 'Structured outcomes are landing, but the qualitative doctrine layer is still too thin to harden a stronger recommendation.',
      confidence: dominantFeedback ? Math.min(94, 58 + (dominantFeedback[1] * 6)) : 48,
      evidence: [
        doctrineFeedbackRows.length
          ? `${doctrineFeedbackRows.length} structured doctrine-feedback messages are now persisted with task outcomes.`
          : 'No structured doctrine-feedback messages have been written yet.',
        dominantFeedback
          ? `The current top doctrine message has repeated ${dominantFeedback[1]} times.`
          : 'Commander needs a few more completed runs before the feedback pattern becomes stable.',
      ],
      metrics: {
        doctrineFeedbackCount: doctrineFeedbackRows.length,
        dominantFeedback: dominantFeedback?.[0] || null,
        dominantFeedbackCount: dominantFeedback?.[1] || 0,
      },
    }),
    buildDoctrineItem({
      id: 'intervention-memory',
      owner: 'Intervention Memory',
      tone: interventionLoad <= 4 ? 'teal' : interventionLoad <= 10 ? 'amber' : 'rose',
      title: interventionLoad <= 4 ? 'Branches are holding without much human intervention' : 'Human interventions are shaping route quality',
      detail: interventionLoad <= 4
        ? `Only ${interventionLoad} intervention events were recorded recently, so current routing is holding steady without much manual rescue.`
        : `${interventionLoad} intervention events were recorded recently, including ${reroutePressure} reroutes or dependency changes. Commander should treat those overrides as route-quality signals, not noise.`,
      confidence: interventionLoad <= 4 ? 72 : Math.min(94, 58 + interventionLoad),
      evidence: [
        `${interventionLoad} intervention events are persisted in first-class intervention memory.`,
        `${reroutePressure} of those were branch reroutes or dependency edits.`,
        'This is now part of doctrine persistence so override-heavy routes get penalized earlier.',
      ],
      metrics: {
        interventionLoad,
        reroutePressure,
        interventionCounts,
      },
    }),
    buildDoctrineItem({
      id: 'mission-pattern-memory',
      owner: 'Pattern Memory',
      tone: winningPattern && winningPattern.avgScore >= 70 ? 'teal' : 'amber',
      title: winningPattern
        ? `${winningPattern.domain} / ${winningPattern.intentType} is becoming a repeatable mission shape`
        : 'Commander still needs stronger mission-shape repetition',
      detail: winningPattern
        ? `${winningPattern.executionStrategy} with ${winningPattern.approvalLevel} approval is the strongest repeating pattern at score ${winningPattern.avgScore} across ${winningPattern.runs} runs.`
        : 'Structured outcomes are landing, but there is not yet enough repeated shape data to harden mission defaults.',
      confidence: winningPattern ? Math.min(94, 54 + (winningPattern.runs * 6)) : 46,
      evidence: [
        winningPattern
          ? `${winningPattern.runs} outcome rows match the strongest repeating mission shape.`
          : 'No repeated mission-shape winner has separated yet.',
        winningPattern
          ? `Average score for that pattern is ${winningPattern.avgScore} at $${winningPattern.avgCost.toFixed(2)} average cost.`
          : 'Commander needs more repeated domain/intent pairs before it should lean on a pattern.',
      ],
      metrics: {
        winningPattern,
      },
    }),
    buildDoctrineItem({
      id: 'rescue-cost-memory',
      owner: 'Rescue Memory',
      tone: interventionLoad <= 4 ? 'teal' : interventionLoad <= 10 ? 'amber' : 'rose',
      title: interventionLoad <= 4 ? 'Human rescue cost is still contained' : 'Human rescue is becoming an economic drag',
      detail: interventionLoad <= 4
        ? 'Manual rescue pressure is low enough that it is not yet distorting the economics of the stack.'
        : `Each cluster of rescue pressure is now carrying about $${rescueWeightedCost.toFixed(2)} of outcome-linked spend, so intervention-heavy routes should fall in rank faster.`,
      confidence: interventionLoad <= 4 ? 70 : Math.min(92, 55 + interventionLoad),
      evidence: [
        `${interventionLoad} structured intervention events are tied to recent outcome memory.`,
        interventionLoad > 0
          ? `Outcome-linked spend per intervention is about $${rescueWeightedCost.toFixed(2)}.`
          : 'No outcome-linked rescue cost has accumulated yet.',
      ],
      metrics: {
        interventionLoad,
        rescueWeightedCost,
      },
    }),
    buildDoctrineItem({
      id: 'batch-command-memory',
      owner: 'Batch Command Memory',
      tone: batchPressure === 0
        ? 'blue'
        : batchRetryPressure + batchRedirectPressure > batchApprovePressure
          ? 'amber'
          : 'teal',
      title: batchPressure === 0
        ? 'Grouped bridge actions have not formed a doctrine signal yet'
        : batchRetryPressure + batchRedirectPressure > batchApprovePressure
          ? 'Grouped interventions are still correcting fragile clusters'
          : 'Grouped approvals are beginning to validate safer branch clusters',
      detail: batchPressure === 0
        ? 'Commander has bridge batch controls, but not enough grouped-command history has accumulated yet to harden doctrine around it.'
        : batchRetryPressure + batchRedirectPressure > batchApprovePressure
          ? `${batchPressure} grouped bridge actions were recorded recently, with ${batchRetryPressure} retries and ${batchRedirectPressure} redirects. That means grouped intervention behavior should demote brittle lane clusters faster.`
          : `${batchApprovePressure} grouped approvals across ${batchSignals.totalBranches} branches are starting to validate safer clustered execution, which can support lighter approval posture on low-risk repeats.`,
      confidence: batchPressure === 0 ? 42 : Math.min(93, 52 + (batchPressure * 7)),
      evidence: [
        batchPressure > 0
          ? `${batchPressure} grouped bridge command events are now available for doctrine feedback.`
          : 'No grouped bridge command events have been written yet.',
        batchPressure > 0
          ? `${batchSignals.totalBranches} branches were touched by recent grouped actions.`
          : 'Commander needs grouped execution history before it can learn from cluster behavior.',
        batchPressure > 0
          ? `Approvals: ${batchApprovePressure}, retries: ${batchRetryPressure}, redirects: ${batchRedirectPressure}.`
          : 'Bridge actions will start affecting doctrine once operators use batch controls in live work.',
      ],
      metrics: {
        batchPressure,
        batchSignals,
      },
    }),
  ];

  await syncLearningMemoryRows(userId, doctrine);

  await supabase
    .from('system_recommendations')
    .upsert([
      {
        id: 'outcome-memory-quality',
        user_id: userId,
        rec_type: 'doctrine',
        title: averageScore >= 70 ? 'Lean harder into the current outcome-winning routes' : 'Stabilize low-scoring routes before scaling',
        description: averageScore >= 70
          ? `Average structured outcome score is ${averageScore}, so current routing is healthy enough to keep compounding.`
          : `Average structured outcome score is ${averageScore}, so Commander should prioritize route quality and verification before adding more load.`,
        impact: averageScore >= 70 ? 'high' : 'critical',
        savings_label: averageScore >= 70 ? `${averageScore} quality` : `${lowTrustCount} low-trust`,
      },
      {
        id: 'provider-escalation-pressure',
        user_id: userId,
        rec_type: 'routing',
        title: `Explain why ${leadingProvider} is winning`,
        description: `Outcome memory shows ${leadingProvider} is the dominant successful provider lane. Surface that readback wherever Commander escalates or stays cheap.`,
        impact: 'medium',
        savings_label: `${outcomes.length} outcomes`,
      },
      {
        id: 'doctrine-feedback-memory',
        user_id: userId,
        rec_type: 'doctrine',
        title: dominantFeedback ? 'Harden the most repeated doctrine feedback into defaults' : 'Collect more qualitative outcome feedback before changing defaults',
        description: dominantFeedback
          ? `The most repeated doctrine signal is "${dominantFeedback[0]}". Use that as the next default route, approval, or verification adjustment.`
          : 'Commander has structured outcomes now, but still needs more repeated doctrine-feedback messages before it should rewrite policy confidently.',
        impact: dominantFeedback ? 'high' : 'medium',
        savings_label: dominantFeedback ? `${dominantFeedback[1]} repeats` : `${doctrineFeedbackRows.length} signals`,
      },
      {
        id: 'intervention-memory-pressure',
        user_id: userId,
        rec_type: 'optimization',
        title: interventionLoad > 4 ? 'Intervention-heavy routes need to be penalized in routing doctrine' : 'Intervention pressure is light enough to keep scaling',
        description: interventionLoad > 4
          ? `${interventionLoad} recent intervention events are telling Commander which routes still need manual rescue. Use those reroutes, retries, and cancels to demote fragile lanes.`
          : `Only ${interventionLoad} recent intervention events were recorded, so current routing posture is stable enough to keep expanding carefully.`,
        impact: interventionLoad > 10 ? 'critical' : interventionLoad > 4 ? 'high' : 'medium',
        savings_label: `${interventionLoad} interventions`,
      },
      {
        id: 'mission-pattern-memory',
        user_id: userId,
        rec_type: 'doctrine',
        title: winningPattern ? 'Promote the strongest mission shape into defaults' : 'Collect more repeated mission shapes before changing defaults',
        description: winningPattern
          ? `${winningPattern.domain} / ${winningPattern.intentType} using ${winningPattern.executionStrategy} with ${winningPattern.approvalLevel} approval is the strongest repeating pattern so far.`
          : 'Commander needs more repeated domain and intent combinations before it should start hardening mission-shape defaults.',
        impact: winningPattern && winningPattern.avgScore >= 75 ? 'high' : 'medium',
        savings_label: winningPattern ? `${winningPattern.runs} pattern runs` : `${outcomes.length} outcomes`,
      },
      {
        id: 'rescue-cost-memory',
        user_id: userId,
        rec_type: 'optimization',
        title: interventionLoad > 4 ? 'Rescue-heavy lanes should lose recommendation rank faster' : 'Rescue cost is low enough to keep current ranking stable',
        description: interventionLoad > 4
          ? 'Recent intervention pressure is now expensive enough that Commander should demote routes needing repeated rescue, even when raw completion looks acceptable.'
          : 'Human rescue cost is currently contained, so Commander can keep current recommendation ranking relatively stable.',
        impact: interventionLoad > 10 ? 'critical' : interventionLoad > 4 ? 'high' : 'medium',
        savings_label: interventionLoad > 0 ? `$${rescueWeightedCost.toFixed(2)} per rescue cluster` : 'low rescue load',
      },
      {
        id: 'batch-command-memory',
        user_id: userId,
        rec_type: 'optimization',
        title: batchRetryPressure + batchRedirectPressure > batchApprovePressure
          ? 'Use grouped bridge interventions to demote brittle lane clusters faster'
          : 'Grouped approvals are evidence for lighter low-risk approval posture',
        description: batchPressure === 0
          ? 'Grouped bridge actions are available, but Commander still needs more history before batch behavior should change defaults.'
          : batchRetryPressure + batchRedirectPressure > batchApprovePressure
            ? `Recent grouped bridge commands show ${batchRetryPressure} retries and ${batchRedirectPressure} redirects across ${batchSignals.totalBranches} branches. Treat that as evidence that clustered fragile work still needs routing and rescue changes.`
            : `Recent grouped bridge approvals now cover ${batchSignals.totalBranches} branches with ${batchApprovePressure} grouped approvals. Use that as evidence when loosening approval posture for low-risk repeated patterns.`,
        impact: batchRetryPressure + batchRedirectPressure > batchApprovePressure
          ? (batchPressure >= 4 ? 'high' : 'medium')
          : batchApprovePressure >= 3
            ? 'medium'
            : 'low',
        savings_label: batchPressure > 0 ? `${batchPressure} batch actions` : 'awaiting history',
      },
    ], { onConflict: 'id' });

  return { available: true };
}

export function deriveLearningMemory({ tasks = [], approvals = [], logs = [], costData = null, humanHourlyRate = 42 }) {
  const completed = tasks.filter((task) => ['completed', 'done'].includes(task.status));
  const failed = tasks.filter((task) => ['failed', 'error', 'blocked', 'cancelled'].includes(task.status));
  const running = tasks.filter((task) => ['running', 'queued', 'pending'].includes(task.status));
  const approvalCount = approvals.length + tasks.filter((task) => task.status === 'needs_approval').length;
  const totalCost = costData?.total ?? tasks.reduce((sum, task) => sum + Number(task.costUsd || 0), 0);
  const totalDurationHours = tasks.reduce((sum, task) => sum + Number(task.durationMs || 0), 0) / (1000 * 60 * 60);
  const humanEquivalent = totalDurationHours * humanHourlyRate;
  const completionRate = tasks.length ? completed.length / tasks.length : 1;

  const byAgent = tasks.reduce((acc, task) => {
    const key = task.agentName || 'Unassigned';
    if (!acc[key]) acc[key] = { name: key, count: 0, completed: 0, cost: 0 };
    acc[key].count += 1;
    acc[key].cost += Number(task.costUsd || 0);
    if (['completed', 'done'].includes(task.status)) acc[key].completed += 1;
    return acc;
  }, {});
  const topAgent = Object.values(byAgent).sort((a, b) => b.count - a.count)[0] || null;

  const byOutput = tasks.reduce((acc, task) => {
    const key = task.outputType || 'summary';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const dominantOutput = Object.entries(byOutput).sort((a, b) => b[1] - a[1])[0]?.[0] || 'summary';

  const byModel = (costData?.models || []).slice().sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0));
  const spendLeader = byModel[0] || null;
  const recentErrors = logs.filter((log) => log.type === 'ERR').length;
  const missionPatternSummary = getMissionPatternSummary(tasks);
  const rescueLoad = getRescueLoadSummary(tasks, logs);

  const doctrine = [
    buildDoctrineItem({
      id: 'doctrine-output',
      owner: 'Tony',
      tone: approvalCount > 0 ? 'amber' : 'teal',
      title: `${formatOutputLabel(dominantOutput)} is becoming the default artifact`,
      detail: approvalCount > 0
        ? `That default should be tightened until approval friction drops. Right now ${approvalCount} items are still waiting on human judgment.`
        : 'The default artifact is landing cleanly enough that the system can keep leaning into it.',
      confidence: approvalCount > 0 ? 74 : 82,
      evidence: [
        `${byOutput[dominantOutput] || 0} recent missions asked for ${formatOutputLabel(dominantOutput)}.`,
        approvalCount > 0 ? `${approvalCount} approval gates are still slowing delivery.` : 'Approval drag is currently light.',
        'This signal is used to steer default output recommendations in mission creation.',
      ],
      metrics: {
        dominantOutput,
        dominantOutputCount: byOutput[dominantOutput] || 0,
        approvalCount,
      },
    }),
    buildDoctrineItem({
      id: 'doctrine-agent',
      owner: 'Tony',
      tone: 'blue',
      title: topAgent ? `${topAgent.name} is acting as the dominant execution branch` : 'No dominant execution branch yet',
      detail: topAgent
        ? `${topAgent.count} missions have been routed through ${topAgent.name}, with ${topAgent.completed} landing successfully.`
        : 'Mission traffic is still too spread out to form a stable doctrine around one branch.',
      confidence: topAgent ? 76 : 42,
      evidence: [
        topAgent ? `${topAgent.name} has handled ${topAgent.count} missions.` : 'Traffic is too evenly distributed right now.',
        topAgent ? `${topAgent.completed} of those have completed successfully.` : 'No branch has enough volume to establish a pattern.',
        'This signal helps bias suggested agents when mission intent is broad.',
      ],
      metrics: {
        topAgentName: topAgent?.name || null,
        topAgentMissionCount: topAgent?.count || 0,
        topAgentCompletedCount: topAgent?.completed || 0,
      },
    }),
    buildDoctrineItem({
      id: 'doctrine-cost',
      owner: 'Buffett',
      tone: humanEquivalent > totalCost ? 'amber' : 'rose',
      title: humanEquivalent > totalCost ? 'Automation is beating the human-cost baseline' : 'Automation is not yet winning on economics',
      detail: `Human-equivalent labor is about $${humanEquivalent.toFixed(2)} versus $${totalCost.toFixed(2)} in agent spend at the current baseline of $${humanHourlyRate}/hour.`,
      confidence: humanEquivalent > totalCost ? 79 : 66,
      evidence: [
        `${totalDurationHours.toFixed(2)} hours of logged execution time have been observed.`,
        `Human baseline is set to $${humanHourlyRate}/hour.`,
        `Tracked agent spend is $${totalCost.toFixed(2)} for the same mission set.`,
      ],
      metrics: {
        humanEquivalent,
        totalCost,
        humanHourlyRate,
        savings: humanEquivalent - totalCost,
      },
    }),
    buildDoctrineItem({
      id: 'doctrine-quality',
      owner: 'Buffett',
      tone: completionRate >= 0.8 ? 'teal' : 'rose',
      title: completionRate >= 0.8 ? 'Reliability is strong enough to compound' : 'Reliability is still the limiter',
      detail: `Completion rate is ${(completionRate * 100).toFixed(0)}%. Durable automation quality matters more than flashy throughput spikes.`,
      confidence: completionRate >= 0.8 ? 77 : 68,
      evidence: [
        `${completed.length} completed missions out of ${tasks.length || 0} total tracked missions.`,
        `${failed.length} missions are currently failed, blocked, or cancelled.`,
        'This signal shapes whether the system recommends scaling or stabilizing first.',
      ],
      metrics: {
        completionRate,
        completedCount: completed.length,
        failedCount: failed.length,
      },
    }),
    buildDoctrineItem({
      id: 'doctrine-speed',
      owner: 'Elon',
      tone: approvalCount > 0 ? 'rose' : 'teal',
      title: approvalCount > 0 ? 'Human pauses are still killing cycle time' : 'The deck is ready for more aggressive parallelism',
      detail: approvalCount > 0
        ? `The system still has ${approvalCount} approval gates interrupting flow.`
        : `${running.length} missions are active without heavy approval drag, which means the stack can push harder.`,
      confidence: approvalCount > 0 ? 84 : 73,
      evidence: [
        approvalCount > 0 ? `${approvalCount} approval-dependent items are in the system.` : 'Approval load is currently low.',
        `${running.length} missions are active or queued right now.`,
        'This signal shapes whether the system prefers safer artifacts or faster launch behavior.',
      ],
      metrics: {
        approvalCount,
        runningCount: running.length,
      },
    }),
    buildDoctrineItem({
      id: 'doctrine-routing',
      owner: 'Elon',
      tone: spendLeader ? 'amber' : 'blue',
      title: spendLeader ? `${spendLeader.name} is the current cost concentration point` : 'No dominant spend lane yet',
      detail: spendLeader
        ? `That branch is responsible for $${Number(spendLeader.cost || 0).toFixed(2)} of tracked spend, so routing discipline should focus there first.`
        : 'Routing policy can still be shaped before the expensive habits harden.',
      confidence: spendLeader ? 71 : 44,
      evidence: [
        spendLeader ? `${spendLeader.name} is the top spend model family in the current ledger.` : 'No single model family dominates tracked spend yet.',
        spendLeader ? `Tracked spend on that branch is $${Number(spendLeader.cost || 0).toFixed(2)}.` : 'Costs are currently dispersed enough to keep routing flexible.',
        'This signal shapes whether the system leans toward efficient or premium defaults.',
      ],
      metrics: {
        spendLeaderName: spendLeader?.name || null,
        spendLeaderCost: Number(spendLeader?.cost || 0),
      },
    }),
    buildDoctrineItem({
      id: 'doctrine-risk',
      owner: 'Tony',
      tone: failed.length + recentErrors > 0 ? 'rose' : 'teal',
      title: failed.length + recentErrors > 0 ? 'Failure signatures need tighter instrumentation' : 'Failure pressure is currently contained',
      detail: failed.length + recentErrors > 0
        ? `${failed.length} failed missions and ${recentErrors} recent error logs suggest the deck still needs better fault-level readback.`
        : 'Now is the right time to turn current healthy patterns into default doctrine.',
      confidence: failed.length + recentErrors > 0 ? 82 : 70,
      evidence: [
        `${failed.length} mission failures are currently visible in the task ledger.`,
        `${recentErrors} recent ERR events were seen in the activity log.`,
        'This signal shapes whether the next step should be stabilization or acceleration.',
      ],
      metrics: {
        failedCount: failed.length,
        recentErrors,
      },
    }),
    buildDoctrineItem({
      id: 'doctrine-mission-patterns',
      owner: 'Tony',
      tone: missionPatternSummary.winner && missionPatternSummary.winner.completionRate >= 0.75 ? 'teal' : 'amber',
      title: missionPatternSummary.winner
        ? `${missionPatternSummary.winner.domain} / ${missionPatternSummary.winner.intentType} is the cleanest reusable mission pattern`
        : 'Commander still needs repeated mission shapes before it can lean on pattern memory',
      detail: missionPatternSummary.winner
        ? `${missionPatternSummary.winner.executionStrategy} with ${missionPatternSummary.winner.approvalLevel} approval is closing ${(missionPatternSummary.winner.completionRate * 100).toFixed(0)}% of its ${missionPatternSummary.winner.runs} runs.`
        : 'Mission traffic is still too diffuse to harden one reusable mission shape into doctrine.',
      confidence: missionPatternSummary.winner ? Math.min(92, 52 + (missionPatternSummary.winner.runs * 5)) : 45,
      evidence: [
        missionPatternSummary.winner
          ? `${missionPatternSummary.winner.runs} tasks fit the top repeated mission pattern.`
          : 'No mission pattern has enough repeated volume yet.',
        missionPatternSummary.winner
          ? `Average cost for that shape is $${missionPatternSummary.winner.avgCost.toFixed(2)}.`
          : 'Commander needs more repeated shapes before it should bias defaults around them.',
      ],
      metrics: {
        winningPattern: missionPatternSummary.winner,
      },
    }),
    buildDoctrineItem({
      id: 'doctrine-rescue-learning',
      owner: 'Elon',
      tone: rescueLoad.rescueRate <= 15 ? 'teal' : rescueLoad.rescueRate <= 35 ? 'amber' : 'rose',
      title: rescueLoad.rescueRate <= 15 ? 'Human rescue cost is still low enough to scale' : 'Human rescue is expensive enough to change route confidence',
      detail: rescueLoad.rescueRate <= 15
        ? `${rescueLoad.rescueTouchedRoots} mission roots needed rescue, which is still low enough to keep scaling current routes.`
        : `${rescueLoad.rescueTouchedRoots} mission roots needed rescue, costing roughly ${rescueLoad.rescueHours.toFixed(1)} human hours in operator attention.`,
      confidence: rescueLoad.rescueRate <= 15 ? 76 : Math.min(92, 54 + rescueLoad.rescueRate),
      evidence: [
        `${rescueLoad.rescueCount} rescue-class interventions are visible in the activity log.`,
        `${rescueLoad.rescueTouchedRoots} mission roots were touched by rescue pressure.`,
        `Estimated operator rescue load is ${rescueLoad.rescueHours.toFixed(1)} hours.`,
      ],
      metrics: rescueLoad,
    }),
  ];

  const doctrineById = doctrine.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  return {
    doctrine,
    doctrineById,
    topThree: doctrine.slice(0, 3),
    executiveThree: [doctrine[2], doctrine[3], doctrine[5], doctrine[8]].filter(Boolean).slice(0, 3),
    missionThree: [doctrine[0], doctrine[1], doctrine[4], doctrine[7]].filter(Boolean).slice(0, 3),
  };
}

function mapMemoryRow(row) {
  return {
    id: row.id,
    doctrineKey: row.doctrine_key,
    owner: row.owner,
    tone: row.tone,
    title: row.title,
    detail: row.detail,
    confidence: row.confidence,
    evidence: row.evidence || [],
    metrics: row.metrics || {},
    snapshotHash: row.snapshot_hash || '',
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at,
  };
}

function mapHistoryRow(row) {
  return {
    id: row.id,
    doctrineKey: row.doctrine_key,
    title: row.title,
    detail: row.detail,
    confidence: row.confidence,
    evidence: row.evidence || [],
    metrics: row.metrics || {},
    snapshotHash: row.snapshot_hash || '',
    observedAt: row.observed_at,
  };
}

async function syncLearningMemoryRows(userId, doctrine) {
  const { data: currentRows, error: currentError } = await supabase
    .from('learning_memory')
    .select('*')
    .eq('user_id', userId);

  if (currentError) {
    if (isMissingTableError(currentError)) return { available: false };
    throw currentError;
  }

  const currentByKey = new Map((currentRows || []).map((row) => [row.doctrine_key, row]));

  for (const item of doctrine) {
    const current = currentByKey.get(item.id);
    const now = new Date().toISOString();
    const payload = {
      user_id: userId,
      doctrine_key: item.id,
      owner: item.owner,
      tone: item.tone,
      title: item.title,
      detail: item.detail,
      confidence: item.confidence,
      evidence: item.evidence,
      metrics: item.metrics,
      snapshot_hash: item.snapshotHash,
      last_seen_at: now,
      first_seen_at: current?.first_seen_at || now,
    };

    if (current?.snapshot_hash === item.snapshotHash) {
      const { error: heartbeatError } = await supabase
        .from('learning_memory')
        .update({ last_seen_at: now })
        .eq('id', current.id);

      if (heartbeatError && !isMissingTableError(heartbeatError)) throw heartbeatError;
      continue;
    }

    const { data: upserted, error: upsertError } = await supabase
      .from('learning_memory')
      .upsert(payload, { onConflict: 'user_id,doctrine_key' })
      .select('*')
      .single();

    if (upsertError) {
      if (isMissingTableError(upsertError)) return { available: false };
      throw upsertError;
    }

    const { error: historyError } = await supabase
      .from('learning_memory_history')
      .upsert({
        learning_memory_id: upserted.id,
        user_id: userId,
        doctrine_key: item.id,
        title: item.title,
        detail: item.detail,
        confidence: item.confidence,
        evidence: item.evidence,
        metrics: item.metrics,
        snapshot_hash: item.snapshotHash,
      }, { onConflict: 'learning_memory_id,snapshot_hash' });

    if (historyError && !isMissingTableError(historyError)) throw historyError;
  }

  return { available: true };
}

async function fetchPersistedLearningMemory(userId) {
  const [currentResponse, historyResponse] = await Promise.all([
    supabase
      .from('learning_memory')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('learning_memory_history')
      .select('*')
      .eq('user_id', userId)
      .order('observed_at', { ascending: false })
      .limit(140),
  ]);

  if (currentResponse.error) {
    if (isMissingTableError(currentResponse.error)) {
      return { available: false, current: [], history: [] };
    }
    throw currentResponse.error;
  }
  if (historyResponse.error) {
    if (isMissingTableError(historyResponse.error)) {
      return { available: false, current: [], history: [] };
    }
    throw historyResponse.error;
  }

  return {
    available: true,
    current: (currentResponse.data || []).map(mapMemoryRow),
    history: (historyResponse.data || []).map(mapHistoryRow),
  };
}

function mergeDoctrineWithPersistence(derived, currentRows, historyRows, persistenceEnabled) {
  const currentByKey = new Map((currentRows || []).map((row) => [row.doctrineKey, row]));
  const historyByKey = (historyRows || []).reduce((acc, row) => {
    if (!acc[row.doctrineKey]) acc[row.doctrineKey] = [];
    acc[row.doctrineKey].push(row);
    return acc;
  }, {});

  const doctrine = derived.doctrine.map((item) => {
    const persisted = currentByKey.get(item.id);
    const history = historyByKey[item.id] || [];
    const latest = history[0] || null;
    return {
      ...item,
      persistedId: persisted?.id || null,
      firstSeenAt: persisted?.firstSeenAt || null,
      lastSeenAt: persisted?.lastSeenAt || null,
      history,
      latestSnapshotAt: latest?.observedAt || persisted?.updatedAt || null,
      changeSummary: buildHistorySummary(history),
      whyItBelievesThis: item.evidence || [],
      persistenceEnabled,
    };
  });

  const doctrineById = doctrine.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  (currentRows || []).forEach((row) => {
    if (doctrineById[row.doctrineKey]) return;
    const history = historyByKey[row.doctrineKey] || [];
    const extra = {
      id: row.doctrineKey,
      owner: row.owner,
      tone: row.tone,
      title: row.title,
      detail: row.detail,
      confidence: row.confidence,
      evidence: row.evidence || [],
      metrics: row.metrics || {},
      snapshotHash: row.snapshotHash,
      persistedId: row.id,
      firstSeenAt: row.firstSeenAt || null,
      lastSeenAt: row.lastSeenAt || null,
      history,
      latestSnapshotAt: history[0]?.observedAt || row.updatedAt || null,
      changeSummary: buildHistorySummary(history),
      whyItBelievesThis: row.evidence || [],
      persistenceEnabled,
    };
    doctrine.push(extra);
    doctrineById[extra.id] = extra;
  });

  return {
    doctrine,
    doctrineById,
    topThree: derived.topThree.map((item) => doctrineById[item.id]).filter(Boolean),
    executiveThree: derived.executiveThree.map((item) => doctrineById[item.id]).filter(Boolean),
    missionThree: derived.missionThree.map((item) => doctrineById[item.id]).filter(Boolean),
    history: historyRows || [],
    persistenceEnabled,
  };
}

export function useLearningMemory(input) {
  const { user } = useAuth();
  const { tasks, approvals, logs, costData, humanHourlyRate } = input;
  const derived = useMemo(
    () => deriveLearningMemory({ tasks, approvals, logs, costData, humanHourlyRate }),
    [tasks, approvals, logs, costData, humanHourlyRate]
  );
  const [persistedCurrent, setPersistedCurrent] = useState([]);
  const [persistedHistory, setPersistedHistory] = useState([]);
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);

  const doctrineSignature = useMemo(
    () => stableJson(derived.doctrine.map((item) => ({
      id: item.id,
      snapshotHash: item.snapshotHash,
    }))),
    [derived.doctrine]
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!user?.id) {
        setPersistedCurrent([]);
        setPersistedHistory([]);
        setPersistenceEnabled(false);
        return;
      }

      try {
        const syncResult = await syncLearningMemoryRows(user.id, derived.doctrine);
        const outcomeSync = await syncOutcomeDoctrineArtifacts(user.id);
        const persisted = await fetchPersistedLearningMemory(user.id);

        if (!cancelled) {
          setPersistedCurrent(persisted.current);
          setPersistedHistory(persisted.history);
          setPersistenceEnabled(Boolean(syncResult.available && outcomeSync.available && persisted.available));
        }
      } catch (error) {
        console.error('[learning-memory]', error.message || error);
        if (!cancelled) {
          setPersistedCurrent([]);
          setPersistedHistory([]);
          setPersistenceEnabled(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [derived.doctrine, doctrineSignature, user?.id]);

  return useMemo(
    () => mergeDoctrineWithPersistence(derived, persistedCurrent, persistedHistory, persistenceEnabled),
    [derived, persistedCurrent, persistedHistory, persistenceEnabled]
  );
}
