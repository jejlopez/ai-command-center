import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

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
  ];

  const doctrineById = doctrine.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  return {
    doctrine,
    doctrineById,
    topThree: doctrine.slice(0, 3),
    executiveThree: [doctrine[2], doctrine[3], doctrine[5]].filter(Boolean),
    missionThree: [doctrine[0], doctrine[1], doctrine[4]].filter(Boolean),
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
        const persisted = await fetchPersistedLearningMemory(user.id);

        if (!cancelled) {
          setPersistedCurrent(persisted.current);
          setPersistedHistory(persisted.history);
          setPersistenceEnabled(Boolean(syncResult.available && persisted.available));
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
