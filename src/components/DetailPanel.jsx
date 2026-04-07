import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Copy, Download, Activity, HelpCircle } from 'lucide-react';
import { TraceWaterfall } from './TraceWaterfall';
import { ActivityFeed } from './ActivityFeed';
import { mockSpans } from '../utils/mockData';
import { cn } from '../utils/cn';

export function DetailPanel({ agentId, onClose }) {
  const [activeTab, setActiveTab] = useState('trace');

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!agentId) return null;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'trace', label: 'Execution Trace' },
    { id: 'logs', label: 'Activity Logs' },
    { id: 'metadata', label: 'Metadata' }
  ];

  return (
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        />
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: '0%' }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 35 }}
          className="fixed top-0 right-0 bottom-0 w-[560px] bg-surface border-l border-border z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
        >
          <div className="p-6 border-b border-border flex justify-between items-start bg-canvas/30 backdrop-blur">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-semibold text-text-primary">Agent Inspection</h2>
                <div className="spatial-panel px-2 py-0.5 text-xs font-mono text-text-muted bg-white/[0.02]">
                  {agentId}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-aurora-teal font-medium">
                <div className="w-2 h-2 rounded-full bg-aurora-teal animate-pulse" />
                Processing
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-aurora-amber hover:bg-white/[0.05] rounded-lg transition-colors" title="Re-run">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button className="p-2 text-text-muted hover:text-text-primary hover:bg-white/[0.05] rounded-lg transition-colors" title="Copy ID">
                <Copy className="w-4 h-4" />
              </button>
              <button className="p-2 text-text-muted hover:text-text-primary hover:bg-white/[0.05] rounded-lg transition-colors" title="Export">
                <Download className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-border mx-1" />
              <button onClick={onClose} className="p-2 text-text-muted hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex border-b border-border px-6 mt-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors relative",
                  activeTab === tab.id
                    ? "border-aurora-teal text-aurora-teal"
                    : "border-transparent text-text-muted hover:text-text-primary"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto relative no-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute inset-0"
              >
                {activeTab === 'trace' && <TraceWaterfall spans={mockSpans} />}
                {activeTab === 'logs' && <ActivityFeed />}
                {activeTab === 'overview' && (
                  <div className="p-6 text-text-primary text-sm flex flex-col gap-6 h-full overflow-y-auto no-scrollbar">
                    <div className="spatial-panel p-5 bg-aurora-teal/5 border-aurora-teal/20 relative overflow-hidden">
                      <div className="absolute -right-4 -top-4 w-16 h-16 bg-aurora-teal/10 rounded-full blur-xl pointer-events-none" />
                      <h3 className="text-aurora-teal font-semibold mb-2 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4" /> Telemetry & Help
                      </h3>
                      <p className="text-text-muted leading-relaxed">
                        This panel provides live diagnostics for node <span className="text-text-primary font-mono">{agentId}</span>.  
                      </p>
                      <div className="mt-4 p-3 bg-canvas/50 rounded border border-white/5">
                        <strong className="text-text-primary">What does the % mean?</strong><br/>
                        <span className="text-text-muted mt-1 inline-block">The percentage ring on the dashboard measures the <strong>Task Completion Rate</strong>. It tracks how much of the agent's current queued pipeline is successfully finished before moving to idle status.</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-text-primary font-semibold mb-3 border-b border-border pb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-text-muted" /> Active Capabilities
                      </h3>
                      <ul className="text-text-muted space-y-3 list-disc pl-4">
                        <li><strong>Web Data Extraction:</strong> Configured to navigate generic DOMs and fetch HTML.</li>
                        <li><strong>LLM Parsing:</strong> Direct pipeline to LLM context windows for raw data structuring.</li>
                        <li><strong>Notification Delivery:</strong> Authorized to dispatch system-level alerts to your devices.</li>
                      </ul>
                    </div>

                    <div className="mt-auto pt-6">
                       <button className="w-full py-2.5 bg-aurora-rose/10 hover:bg-aurora-rose/20 text-aurora-rose font-bold border border-aurora-rose/20 rounded transition-colors text-xs font-mono tracking-wider">
                         REQUEST MANUAL INTERVENTION
                       </button>
                    </div>
                  </div>
                )}
                {activeTab === 'metadata' && (
                  <div className="p-6 text-text-muted text-sm flex items-center justify-center h-full">Metadata JSON</div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}
