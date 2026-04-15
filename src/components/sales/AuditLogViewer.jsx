import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const ACTOR_STYLES = {
  jarvis: 'bg-purple-900/60 text-purple-300 border border-purple-700',
  user:   'bg-blue-900/60 text-blue-300 border border-blue-700',
  system: 'bg-gray-800/60 text-gray-400 border border-gray-600',
};

const ACTION_LABELS = {
  approval_decided:   'Approval decided',
  approval_requested: 'Approval requested',
  score_changed:      'Score changed',
  status_changed:     'Status changed',
  lead_created:       'Lead created',
  deal_created:       'Deal created',
  note_added:         'Note added',
  email_sent:         'Email sent',
  task_completed:     'Task completed',
  field_updated:      'Field updated',
};

function humanAction(action) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function MiniDiff({ before, after }) {
  if (!before || !after) return null;
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const changed = keys.filter(k => before[k] !== after[k]);
  if (!changed.length) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {changed.map(k => (
        <div key={k} className="text-xs font-mono text-gray-400">
          <span className="text-gray-500">{k}:</span>{' '}
          <span className="text-red-400">{String(before[k] ?? '—')}</span>
          <span className="text-gray-500"> → </span>
          <span className="text-green-400">{String(after[k] ?? '—')}</span>
        </div>
      ))}
    </div>
  );
}

export default function AuditLogViewer({ leadId, dealId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, actor, action, entity_type, entity_id, before_state, after_state, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (cancelled) return;
      if (error) { setLoading(false); return; }

      // Client-side filter: keep entries that mention this lead or deal
      const filtered = (data || []).filter(entry => {
        if (leadId && entry.entity_id === leadId) return true;
        if (dealId && entry.entity_id === dealId) return true;
        const blob = JSON.stringify([entry.before_state, entry.after_state]);
        if (leadId && blob.includes(leadId)) return true;
        if (dealId && blob.includes(dealId)) return true;
        // If neither id provided, show all
        if (!leadId && !dealId) return true;
        return false;
      });

      setEntries(filtered);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [leadId, dealId]);

  if (loading) {
    return <p className="text-xs text-gray-500 py-4 text-center">Loading audit log…</p>;
  }

  if (!entries.length) {
    return <p className="text-xs text-gray-500 py-4 text-center">No audit entries yet.</p>;
  }

  return (
    <ol className="relative border-l border-jarvis-border ml-2 space-y-0">
      {entries.map((entry, i) => (
        <li key={entry.id} className="ml-4 pb-4">
          {/* Timeline dot */}
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-jarvis-border border border-jarvis-bg" />

          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            {/* Actor badge */}
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${ACTOR_STYLES[entry.actor] ?? ACTOR_STYLES.system}`}>
              {entry.actor}
            </span>

            {/* Action */}
            <span className="text-xs text-gray-200 font-medium">{humanAction(entry.action)}</span>

            {/* Entity type */}
            {entry.entity_type && (
              <span className="text-[10px] text-gray-500">({entry.entity_type})</span>
            )}

            {/* Timestamp */}
            <span className="text-[10px] text-gray-600 ml-auto">
              {timeAgo(entry.created_at)}
            </span>
          </div>

          {/* Diff */}
          <MiniDiff before={entry.before_state} after={entry.after_state} />

          {/* Reason */}
          {entry.reason && (
            <p className="mt-1 text-[11px] text-gray-400 italic">"{entry.reason}"</p>
          )}
        </li>
      ))}
    </ol>
  );
}
