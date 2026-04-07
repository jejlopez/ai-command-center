import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { activityLog } from '../utils/mockData';
import { cn } from '../utils/cn';
import { ArrowDown } from 'lucide-react';

const tagStyles = {
  OK: 'text-aurora-teal',
  ERR: 'text-aurora-rose',
  NET: 'text-aurora-blue',
  SYS: 'text-text-muted',
};

export function ActivityFeed() {
  const scrollRef = useRef(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [entries, setEntries] = useState(activityLog); // For mock simulation

  // Simulate new logs arriving
  useEffect(() => {
    const interval = setInterval(() => {
      setEntries(prev => [
        ...prev,
        {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          type: ['OK', 'SYS', 'NET'][Math.floor(Math.random() * 3)],
          message: 'Background optimization pass completed'
        }
      ]);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = scrollRef.current;
    if (scrollTop + clientHeight < scrollHeight - 20) {
      setIsUserScrolled(true);
    } else {
      setIsUserScrolled(false);
    }
  };

  useEffect(() => {
    if (!isUserScrolled && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, isUserScrolled]);

  return (
    <div className="spatial-panel h-80 relative flex flex-col pt-4">
      <div className="absolute top-0 inset-x-0 h-10 bg-gradient-to-b from-surface to-transparent z-10 pointer-events-none" />
      
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 pb-6 pt-4 space-y-2 relative no-scrollbar"
        style={{ scrollBehavior: 'smooth', style: 'scrollbar-width: none' }}
      >
        <AnimatePresence initial={false}>
          {entries.map(entry => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-xs flex items-start gap-3"
            >
              <span className="text-text-disabled shrink-0">{entry.timestamp}</span>
              <span className={cn("shrink-0 font-bold w-[4ch]", tagStyles[entry.type] || tagStyles.SYS)}>
                [{entry.type}]
              </span>
              <span className="text-text-body break-all">{entry.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isUserScrolled && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20"
          >
            <button
              onClick={() => {
                setIsUserScrolled(false);
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-aurora-teal text-[#000] text-xs font-bold rounded-full shadow-lg shadow-aurora-teal/20"
            >
              <ArrowDown className="w-3 h-3" /> Jump to latest
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
