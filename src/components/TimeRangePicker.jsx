import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useTimeRange } from '../utils/useTimeRange';
import { cn } from '../utils/cn';

const ranges = [
  { id: '15m', label: 'Last 15m' },
  { id: '1h', label: 'Last 1h' },
  { id: '6h', label: 'Last 6h' },
  { id: '24h', label: 'Last 24h' },
  { id: '7d', label: 'Last 7d' },
];

export function TimeRangePicker() {
  const { range, setRange } = useTimeRange();
  const [open, setOpen] = useState(false);
  
  const activeRange = ranges.find(r => r.id === range);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 spatial-panel hover:bg-white/[0.05] transition-colors text-xs font-medium text-text-primary"
      >
        <span>{activeRange?.label || 'Last 1h'}</span>
        <ChevronDown className="w-3 h-3 text-text-muted" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute top-full right-0 mt-2 w-32 spatial-panel p-1 z-50 overflow-hidden"
          >
            {ranges.map(r => (
              <button
                key={r.id}
                onClick={() => {
                  setRange(r.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors",
                  range === r.id 
                    ? "text-aurora-teal bg-aurora-teal/10" 
                    : "text-text-primary hover:bg-white/[0.04]"
                )}
              >
                {r.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
