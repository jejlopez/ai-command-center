import { ExternalLink } from 'lucide-react';

function formatTime(date) {
  if (!date) return '';
  try {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export function ElonNotes({ notes }) {
  if (!notes || notes.length === 0) {
    return (
      <div className="py-6 text-center text-text-disabled text-[11px]">No founder notes yet.</div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[9px] uppercase tracking-[0.15em] text-text-disabled font-bold mb-2">Founder Notes</div>
      {notes.map(note => (
        <div
          key={note.id}
          className="p-3 ui-well rounded-lg border border-hairline hover:border-aurora-violet/20 transition-colors"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-text-disabled">{formatTime(note.timestamp)}</span>
            {note.taskId && (
              <button className="flex items-center gap-1 text-[9px] text-aurora-violet hover:text-aurora-violet/80 transition-colors">
                <ExternalLink className="w-2.5 h-2.5" /> View task
              </button>
            )}
          </div>
          <p className="text-[11px] text-text-body leading-relaxed">{note.text}</p>
        </div>
      ))}
    </div>
  );
}
