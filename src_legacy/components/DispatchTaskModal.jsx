import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../utils/cn';

export function DispatchTaskModal({ isOpen, agent, onClose }) {
  const [taskDescription, setTaskDescription] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);

  // Auto-close and reset after success
  useEffect(() => {
    if (status !== 'success') return;
    const timer = setTimeout(() => {
      onClose();
      setStatus('idle');
      setTaskDescription('');
      setErrorMessage(null);
    }, 2000);
    return () => clearTimeout(timer);
  }, [status, onClose]);

  const canSubmit = taskDescription.trim().length >= 10 && status === 'idle';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus('loading');
    setErrorMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-task`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ agent_id: agent.id, task_description: taskDescription }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);
      setStatus('success');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to dispatch task');
      setStatus('error');
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStatus('idle');
      setTaskDescription('');
      setErrorMessage(null);
    }, 300);
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Panel — slides from right */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[440px] bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-white/[0.06] z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-aurora-teal/10 flex items-center justify-center border border-aurora-teal/20">
                  <Play className="w-4 h-4 text-aurora-teal" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Dispatch Task</h2>
                  <p className="text-[11px] text-text-muted">Send a task to {agent?.name}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6 no-scrollbar">
              {status === 'success' ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center gap-4 py-12 text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-aurora-teal/10 border border-aurora-teal/20 flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-aurora-teal" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-aurora-teal">Task dispatched</p>
                    <p className="text-[11px] text-text-muted mt-1">Check Mission Control for the output</p>
                  </div>
                </motion.div>
              ) : (
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-2">
                    Task Description
                  </label>
                  <textarea
                    value={taskDescription}
                    onChange={(e) => {
                      setTaskDescription(e.target.value);
                      if (status === 'error') {
                        setStatus('idle');
                        setErrorMessage(null);
                      }
                    }}
                    placeholder={`Describe what you want ${agent?.name} to do...`}
                    rows={6}
                    disabled={status === 'loading'}
                    className={cn(
                      'w-full bg-white/[0.03] border rounded-xl px-4 py-3 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none transition-colors font-mono resize-none',
                      status === 'loading'
                        ? 'border-white/[0.05] opacity-50 cursor-not-allowed'
                        : 'border-white/[0.08] focus:border-aurora-teal/50'
                    )}
                  />

                  {status === 'error' && errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-3 bg-aurora-rose/10 border border-aurora-rose/20 rounded-xl px-4 py-3 text-xs text-aurora-rose"
                    >
                      {errorMessage}
                    </motion.div>
                  )}
                </div>
              )}
            </form>

            {/* Footer — hidden on success */}
            {status !== 'success' && (
              <div className="px-6 py-4 border-t border-white/[0.06] flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-3 rounded-xl border border-white/[0.08] text-xs text-text-muted hover:text-text-primary hover:bg-white/[0.03] transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={cn(
                    'flex-1 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2',
                    canSubmit
                      ? 'bg-aurora-teal text-black hover:bg-aurora-teal/90 active:scale-[0.98]'
                      : 'bg-white/[0.05] text-text-disabled cursor-not-allowed'
                  )}
                >
                  {status === 'loading' ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full"
                      />
                      Dispatching…
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Dispatch
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
