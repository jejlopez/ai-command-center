import { useState } from 'react';
import { FileText } from 'lucide-react';

// TODO: Wire to scratchpad_notes table keyed by date when it exists.
// Currently local state only — lost on refresh.

export function ScratchpadStrip() {
  const [text, setText] = useState('');

  return (
    <div className="shrink-0 mt-4 border-t border-border pt-3 pb-1">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-3.5 h-3.5 text-text-disabled" />
        <span className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold">Scratchpad</span>
        <span className="text-[9px] text-text-disabled font-mono ml-auto">Local only — TODO: auto-save to Supabase</span>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Quick thoughts that haven't been turned into tasks yet..."
        rows={2}
        className="w-full bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2 text-[11px] font-mono text-text-primary resize-none focus:border-aurora-teal/30 outline-none transition-colors leading-relaxed placeholder:text-text-disabled"
      />
    </div>
  );
}
