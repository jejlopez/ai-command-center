import { Maximize2, Settings2, X } from 'lucide-react';

export function WidgetActions({ onExpand, onConfigure, onRemove }) {
  return (
    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
      {onExpand && (
        <button
          onClick={(e) => { e.stopPropagation(); onExpand?.(); }}
          className="p-1.5 rounded-md text-text-dim hover:text-text-primary hover:bg-panel transition-colors"
          title="Expand"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      )}
      {onConfigure && (
        <button
          onClick={(e) => { e.stopPropagation(); onConfigure?.(); }}
          className="p-1.5 rounded-md text-text-disabled hover:text-aurora-violet hover:bg-panel-soft transition-colors"
          title="Configure"
        >
          <Settings2 className="w-3 h-3" />
        </button>
      )}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          className="p-1.5 rounded-md text-text-disabled hover:text-aurora-rose hover:bg-panel-soft transition-colors"
          title="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
