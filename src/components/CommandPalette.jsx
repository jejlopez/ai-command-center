import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { commandItems, agents } from '../utils/mockData';
import { cn } from '../utils/cn';

const statusColors = {
  processing: 'bg-aurora-teal',
  idle: 'bg-text-muted',
  error: 'bg-aurora-rose',
};

export function CommandPalette({ isOpen, onClose, onExecute }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const filteredItems = query
    ? commandItems.filter(item => item.label.toLowerCase().includes(query.toLowerCase()))
    : commandItems;

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 10);
      setSelectedIndex(0);
    }
    if (!isOpen) setQuery('');
  }, [isOpen, query]);

  function handleExecute(item) {
    if (!item) return;
    onExecute?.(item);
    onClose();
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleExecute(filteredItems[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  // Group items for rendering
  let lastGroup = null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[101] flex items-start justify-center pt-28 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-lg spatial-panel gradient-border origin-top pointer-events-auto flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-border text-text-primary flex items-center">
                <Icons.Search className="w-4 h-4 text-text-muted mr-3 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search commands, agents, or views..."
                  className="w-full bg-transparent border-none outline-none text-base placeholder-text-muted"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-text-disabled hover:text-text-muted ml-2 shrink-0">
                    <Icons.X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2 no-scrollbar">
                {filteredItems.length === 0 ? (
                  <div className="p-4 text-center text-text-muted text-sm">No results found</div>
                ) : (
                  filteredItems.map((item, idx) => {
                    const Icon = Icons[item.icon] || Icons.Command;
                    const isSelected = idx === selectedIndex;
                    const showGroupHeader = item.group !== lastGroup;
                    lastGroup = item.group;

                    // Agent status dot for agent commands
                    const agent = item.action?.type === 'agent'
                      ? agents.find(a => a.id === item.action.agentId)
                      : null;

                    return (
                      <React.Fragment key={item.id}>
                        {showGroupHeader && (
                          <div className="px-3 pt-3 pb-1.5 text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold">
                            {item.group}
                          </div>
                        )}
                        <div
                          onMouseEnter={() => setSelectedIndex(idx)}
                          onClick={() => handleExecute(item)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                            isSelected ? "bg-white/[0.06] text-aurora-teal" : "text-text-primary hover:bg-white/[0.03]"
                          )}
                        >
                          <Icon className={cn("w-4 h-4 shrink-0", isSelected ? "text-aurora-teal" : "text-text-muted")} />
                          <span className="text-sm font-medium flex-1">{item.label}</span>
                          {agent && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className={cn("w-1.5 h-1.5 rounded-full", statusColors[agent.status] || 'bg-text-muted', agent.status === 'processing' && 'animate-pulse')} />
                              <span className="text-[10px] font-mono text-text-disabled">{agent.model.split('-').slice(0, 2).join('-')}</span>
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
              <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-text-disabled font-mono">
                <span className="flex items-center gap-1"><kbd className="bg-white/5 px-1 rounded">↑↓</kbd> navigate</span>
                <span className="flex items-center gap-1"><kbd className="bg-white/5 px-1 rounded">↵</kbd> select</span>
                <span className="flex items-center gap-1"><kbd className="bg-white/5 px-1 rounded">esc</kbd> close</span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
