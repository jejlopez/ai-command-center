import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icons from 'lucide-react';
import { commandItems } from '../utils/mockData';
import { cn } from '../utils/cn';

export function CommandPalette({ isOpen, onClose }) {
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
  }, [isOpen, query]);

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
        if (filteredItems[selectedIndex]) {
          console.log('Executed:', filteredItems[selectedIndex].label);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

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
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search commands, agents, or memory..."
                  className="w-full bg-transparent border-none outline-none text-base placeholder-text-muted"
                />
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {filteredItems.length === 0 ? (
                  <div className="p-4 text-center text-text-muted text-sm">No results found</div>
                ) : (
                  filteredItems.map((item, idx) => {
                    const Icon = Icons[item.icon] || Icons.Command;
                    const isSelected = idx === selectedIndex;
                    return (
                      <div
                        key={item.id}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors",
                          isSelected ? "bg-white/[0.06] text-aurora-teal" : "text-text-primary hover:bg-white/[0.03]"
                        )}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="ml-auto text-[10px] text-text-muted uppercase tracking-wider">{item.group}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
