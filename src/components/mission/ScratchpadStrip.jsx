import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, WifiOff } from 'lucide-react';
import { fetchScratchpadNote, upsertScratchpadNote } from '../../lib/api';
import { useWorkspaces } from '../../context/WorkspaceContext';

export function ScratchpadStrip() {
  const { activeWorkspace } = useWorkspaces();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState('idle');
  const lastSavedText = useRef('');

  useEffect(() => {
    let cancelled = false;

    async function loadNote() {
      if (!activeWorkspace?.id) {
        setText('');
        lastSavedText.current = '';
        setLoading(false);
        return;
      }

      setLoading(true);
      const note = await fetchScratchpadNote(activeWorkspace.id);
      if (cancelled) return;

      const nextText = note?.content || '';
      setText(nextText);
      lastSavedText.current = nextText;
      setSaveState('idle');
      setLoading(false);
    }

    loadNote();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (loading || !activeWorkspace?.id) return undefined;
    if (text === lastSavedText.current) return undefined;

    setSaveState('saving');
    const timeoutId = window.setTimeout(async () => {
      try {
        await upsertScratchpadNote(activeWorkspace.id, text);
        lastSavedText.current = text;
        setSaveState('saved');
      } catch (error) {
        console.error('[ScratchpadStrip] Save failed:', error);
        setSaveState('error');
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [activeWorkspace?.id, loading, text]);

  const statusLabel = loading
    ? 'Loading notes'
    : saveState === 'saving'
      ? 'Saving...'
      : saveState === 'saved'
        ? 'Saved to Supabase'
        : saveState === 'error'
          ? 'Save failed'
          : 'Workspace synced';

  return (
    <div className="deck-panel mt-4 shrink-0 p-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-3.5 h-3.5 text-text-disabled" />
        <span className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold">Scratchpad</span>
        <span className="ml-auto flex items-center gap-1 text-[9px] text-text-disabled font-mono">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : saveState === 'error' ? <WifiOff className="h-3 w-3 text-aurora-rose" /> : <CheckCircle2 className="h-3 w-3 text-aurora-green" />}
          {statusLabel}
        </span>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Quick thoughts that haven't been turned into tasks yet..."
        rows={3}
        className="w-full rounded-xl bg-white/[0.025] px-3 py-3 text-[11px] font-mono text-text-primary resize-none outline-none ring-1 ring-white/[0.05] transition-colors leading-relaxed placeholder:text-text-disabled focus:ring-aurora-teal/25"
      />
    </div>
  );
}
