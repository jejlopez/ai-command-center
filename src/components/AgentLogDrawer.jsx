import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Terminal } from 'lucide-react';
import { useActivityLog, useAgents } from '../utils/useSupabase';

export function AgentLogDrawer({ agentName, onClose }) {
  const { agents } = useAgents();
  const agent = agents.find((entry) => entry.name === agentName);
  const { logs: activityLog } = useActivityLog(agent?.id || null);
  const scrollRef = useRef(null);
  const logs = activityLog.map((entry) => `[${entry.type}] ${entry.message}`);

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
            className="ui-drawer fixed top-2 right-2 bottom-2 w-[450px] rounded-2xl z-50 flex flex-col overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="p-5 border-b border-hairline flex justify-between items-center bg-panel-soft">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-aurora-teal" />
                <h3 className="font-sans text-sm font-medium text-text-primary">
                  {agentName}
                </h3>
              </div>
              <button onClick={onClose} className="ui-button-secondary p-1.5 text-text-muted hover:text-text-primary rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Log Output Area */}
            <div 
               ref={scrollRef}
               className="flex-1 overflow-y-auto p-6 font-mono text-[12px] leading-relaxed text-text-muted space-y-3 bg-canvas/50"
            >
              {logs.map((log, i) => {
                const isError = log.includes('[ERR]') || log.includes('OOM');
                const isWarn = log.includes('[WARN]');
                const color = isError ? 'text-aurora-rose' : isWarn ? 'text-aurora-amber' : 'text-aurora-teal';
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
              {logs.length === 0 && (
                <div className="text-text-muted">No logs recorded for this agent yet.</div>
              )}
              
              <motion.div 
                animate={{ opacity: [1, 0, 1] }} 
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-2 h-4 bg-white mt-2"
              />
            </div>
            
            {/* Input Bar */}
            <div className="p-4 border-t border-hairline bg-panel-soft flex items-center gap-3">
              <span className="text-text-muted font-mono">{'>'}</span>
              <input 
                type="text" 
                readOnly 
                placeholder="Terminal streaming..." 
                className="bg-transparent border-none focus:outline-none text-xs font-mono text-aurora-teal w-full" 
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
