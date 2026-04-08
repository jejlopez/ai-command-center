import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { supabase } from '../../lib/supabaseClient';

export function DispatchComposer({ agent, onBack, onSuccess }) {
  const [taskDescription, setTaskDescription] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);

  const canSubmit = taskDescription.trim().length >= 10 && status !== 'loading';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus('loading');
    setErrorMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ agent_id: agent.id, task_description: taskDescription }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);
      setStatus('success');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to dispatch task');
      setStatus('error');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-teal">Dispatch Mode</div>
          <h3 className="mt-1 text-lg font-semibold text-text-primary">Send a new task to {agent.name}</h3>
        </div>
        <button
          onClick={onBack}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-text-muted transition-colors hover:text-text-primary"
        >
          Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto no-scrollbar p-6">
        {status === 'success' ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="m-auto flex max-w-sm flex-col items-center rounded-3xl border border-aurora-teal/20 bg-aurora-teal/5 px-8 py-10 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-aurora-teal/20 bg-aurora-teal/10">
              <CheckCircle2 className="h-8 w-8 text-aurora-teal" />
            </div>
            <h4 className="mt-5 text-lg font-semibold text-text-primary">Task dispatched</h4>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              {agent.name} is queued up. Stay in context and jump straight into the live execution stream.
            </p>
            <div className="mt-6 flex w-full gap-3">
              <button
                type="button"
                onClick={() => onSuccess('logs')}
                className="flex-1 rounded-xl bg-aurora-teal px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#12e8da]"
              >
                View Logs
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus('idle');
                  setTaskDescription('');
                  setErrorMessage(null);
                }}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-text-primary"
              >
                Dispatch Again
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                <Sparkles className="h-3.5 w-3.5 text-aurora-teal" />
                Compose Mission
              </div>
              <textarea
                value={taskDescription}
                onChange={(e) => {
                  setTaskDescription(e.target.value);
                  if (status === 'error') {
                    setStatus('idle');
                    setErrorMessage(null);
                  }
                }}
                placeholder={`Describe what you want ${agent.name} to do, what done looks like, and any constraints or quality bar.`}
                rows={10}
                disabled={status === 'loading'}
                className={cn(
                  'w-full resize-none rounded-2xl border bg-black/20 px-4 py-4 text-sm leading-relaxed text-text-primary placeholder:text-text-disabled focus:outline-none transition-colors',
                  status === 'loading'
                    ? 'cursor-not-allowed border-white/[0.05] opacity-50'
                    : 'border-white/[0.08] focus:border-aurora-teal/50'
                )}
              />
              <div className="mt-3 flex items-center justify-between text-[11px] text-text-disabled">
                <span>Be explicit about deliverable, urgency, and constraints.</span>
                <span className="font-mono">{taskDescription.trim().length} chars</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-disabled">Suggested framing</div>
                <p className="mt-3 text-sm text-text-muted">
                  Start with the outcome, then list the exact artifacts you want back, plus any source or tone constraints.
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-disabled">Current agent state</div>
                <p className="mt-3 text-sm text-text-muted">
                  {agent.status === 'processing'
                    ? 'This agent is already active, so your task will join a live context.'
                    : agent.status === 'error'
                      ? 'This agent is in recovery state; dispatch may fail until the error is cleared.'
                      : 'This agent is idle and ready to take a new assignment.'}
                </p>
              </div>
            </div>

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-aurora-rose/20 bg-aurora-rose/10 px-4 py-3 text-sm text-aurora-rose"
              >
                {errorMessage}
              </motion.div>
            )}

            <div className="mt-auto flex items-center gap-3 border-t border-white/[0.06] pt-5">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  'flex-1 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] transition-all',
                  canSubmit
                    ? 'bg-aurora-teal text-black shadow-[0_0_22px_rgba(0,217,200,0.22)] hover:bg-[#12e8da]'
                    : 'cursor-not-allowed bg-white/[0.05] text-text-disabled'
                )}
              >
                {status === 'loading' ? 'Dispatching…' : 'Dispatch task'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
