import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Terminal, Activity, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

export function OverviewView({ context, onAgentClick }) {
  const agents = context.agents || [];
  const triage = context.triage || [];
  const tasks = context.tasks || [];

  return (
    <div className="flex flex-col gap-6 h-full pb-8">
      
      {/* Conversational Top Bar */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="spatial-panel rounded-2xl p-6 flex flex-col gap-4"
      >
        <div className="flex items-center gap-3 text-modern-muted">
          <Sparkles className="w-5 h-5 text-modern-accent" />
          <h2 className="font-sans text-lg font-medium text-white">Ask your workspace</h2>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="e.g. Generate a report on the Q3 financials using Agent-D1..."
            className="w-full bg-modern-bg/50 border border-modern-border/60 rounded-xl px-4 py-4 text-base font-sans text-white focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all placeholder:text-modern-muted"
          />
          <button className="absolute right-3 top-1/2 -translate-y-1/2 bg-white text-black p-2 rounded-lg hover:bg-modern-accent transition-colors">
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-6 flex-1 min-h-[400px]">
        
        {/* Intelligence Summary Bento (Large Left) */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          className="col-span-8 spatial-panel rounded-3xl p-8 flex flex-col justify-between"
        >
          <div className="flex justify-between items-start mb-8">
            <h3 className="text-xl font-medium text-white">Active Intelligence</h3>
            <span className="spatial-pill px-3 py-1 text-xs font-mono text-modern-muted uppercase tracking-wider flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-modern-success"></span>
               {agents.length} Agents Running
            </span>
          </div>
          
          <div className="space-y-6">
            <h4 className="text-2xl font-light text-modern-accent leading-relaxed">
              Workflow <span className="text-white font-medium">Q3 Analysis</span> is operating nominally. 
              Agent-D1 has completed scraping competitor data. <span className="text-white font-medium break-words">Total cost across {context.intel?.activeTasks || 0} tasks is ${context.intel?.cost || 0}.</span>
            </h4>
            
            <div className="flex gap-4 mt-8">
               <button className="spatial-button px-5 py-2.5 text-sm">View Full Logs</button>
               <button className="spatial-button px-5 py-2.5 text-sm bg-white/10 text-white">Halt Operations</button>
            </div>
          </div>
        </motion.div>

        {/* Triage & Issues Bento (Top Right) */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="col-span-4 spatial-panel rounded-3xl p-6 flex flex-col"
        >
          <div className="flex items-center gap-2 mb-4">
             <AlertTriangle className="w-4 h-4 text-modern-muted" />
             <h3 className="font-medium text-white">Triage Alerts</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3">
            {triage.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-modern-muted gap-2">
                 <CheckCircle className="w-8 h-8 opacity-20" />
                 <span className="text-sm">No issues detected</span>
               </div>
            ) : (
               triage.map(issue => (
                 <div key={issue.id} className="p-3 rounded-xl bg-modern-bg/50 border border-modern-border/50 flex flex-col gap-1 cursor-pointer hover:bg-modern-panel transition-colors" onClick={() => onAgentClick(issue.agent)}>
                   <span className="text-xs font-mono text-modern-alert uppercase">{issue.severity}</span>
                   <span className="text-sm text-modern-accent line-clamp-2">{issue.msg}</span>
                   <span className="text-xs text-modern-muted font-mono mt-2">{issue.agent}</span>
                 </div>
               ))
            )}
          </div>
        </motion.div>

        {/* Fleet Graph Preview Bento (Bottom Left) */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="col-span-5 spatial-panel rounded-3xl p-6 flex flex-col relative overflow-hidden"
        >
          <h3 className="font-medium text-white mb-4 z-10 relative">Fleet Graph Topology</h3>
          <div className="absolute inset-0 right-0 top-10 flex items-center justify-center pointer-events-none opacity-40">
             <svg width="200" height="200" className="text-modern-border overflow-visible">
               <circle cx="50" cy="100" r="4" fill="currentColor" />
               <circle cx="150" cy="50" r="4" fill="currentColor" />
               <circle cx="150" cy="150" r="4" fill="currentColor" />
               <path d="M 50 100 C 100 100, 100 50, 150 50" stroke="currentColor" fill="none" strokeDasharray="4 4" />
               <path d="M 50 100 C 100 100, 100 150, 150 150" stroke="currentColor" fill="none" strokeDasharray="4 4" />
             </svg>
          </div>
          
          <div className="mt-auto z-10 relative flex gap-2 overflow-x-auto pb-2">
            {agents.map(a => (
              <div key={a.id} onClick={() => onAgentClick(a.name)} className="px-3 py-1.5 rounded-lg bg-modern-bg/80 border border-modern-border/80 text-xs font-mono text-modern-accent whitespace-nowrap cursor-pointer hover:border-white/20 transition-colors flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'processing' ? 'bg-modern-success' : a.status === 'offline' ? 'bg-modern-alert' : 'bg-modern-muted'}`}></div>
                {a.name}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Tasks Bento (Bottom Right) */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
          className="col-span-7 spatial-panel rounded-3xl p-6 flex flex-col"
        >
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-medium text-white">Pipeline Execution</h3>
             <button className="text-xs text-modern-muted hover:text-white transition-colors">View All &rarr;</button>
          </div>
          <div className="flex-1 space-y-3">
             {tasks.map(t => (
               <div key={t.id} className="flex flex-col gap-2 p-3 rounded-xl border border-modern-border/30 hover:bg-modern-bg/30 transition-colors">
                 <div className="flex justify-between text-sm">
                   <span className="text-modern-accent font-medium">{t.text}</span>
                   <span className="text-modern-muted font-mono">{t.progress}%</span>
                 </div>
                 <div className="w-full h-1 bg-modern-bg rounded-full overflow-hidden">
                   <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${t.progress}%` }}></div>
                 </div>
               </div>
             ))}
             {tasks.length === 0 && <span className="text-sm text-modern-muted pt-4">No active pipeline tasks in this workspace.</span>}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
