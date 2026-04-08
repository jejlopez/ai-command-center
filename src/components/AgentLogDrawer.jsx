import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Terminal } from 'lucide-react';
// TODO: Replace with Supabase activity_log query scoped to specific agent
import { AGENT_LOGS } from '../utils/mockData';

export function AgentLogDrawer({ agentName, onClose }) {
  const scrollRef = useRef(null);
  
  const logs = AGENT_LOGS[agentName] || [
    '[SYS] Core initialized...',
    '[OK] Stream active.',
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agentName]);

  return (
    <AnimatePresence>
      {agentName && (
        <>
          {/* Spatial Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-modern-bg/60 z-40 backdrop-blur-md"
          />

          {/* Minimalist Drawer */}
          <motion.div 
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="fixed top-2 right-2 bottom-2 w-[450px] spatial-panel rounded-2xl z-50 flex flex-col overflow-hidden border border-modern-border/30 shadow-2xl"
          >
            {/* Header */}
            <div className="p-5 border-b border-modern-border/50 flex justify-between items-center bg-modern-panel">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-modern-accent" />
                <h3 className="font-sans text-sm font-medium text-white">
                  {agentName}
                </h3>
              </div>
              <button onClick={onClose} className="p-1.5 text-modern-muted hover:text-white bg-modern-bg rounded-lg transition-colors border border-modern-border">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Log Output Area */}
            <div 
               ref={scrollRef}
               className="flex-1 overflow-y-auto p-6 font-mono text-[12px] leading-relaxed text-modern-muted space-y-3 bg-modern-bg/50"
            >
              {logs.map((log, i) => {
                const isError = log.includes('[ERR]') || log.includes('OOM');
                const isWarn = log.includes('[WARN]');
                const color = isError ? 'text-modern-alert' : isWarn ? 'text-modern-warning' : 'text-modern-accent';
                return (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`break-words ${color}`}
                  >
                    {log}
                  </motion.div>
                );
              })}
              
              <motion.div 
                animate={{ opacity: [1, 0, 1] }} 
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-2 h-4 bg-white mt-2"
              />
            </div>
            
            {/* Input Bar */}
            <div className="p-4 border-t border-modern-border/50 bg-modern-panel flex items-center gap-3">
              <span className="text-modern-muted font-mono">{'>'}</span>
              <input 
                type="text" 
                readOnly 
                placeholder="Terminal streaming..." 
                className="bg-transparent border-none focus:outline-none text-xs font-mono text-modern-accent w-full" 
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
