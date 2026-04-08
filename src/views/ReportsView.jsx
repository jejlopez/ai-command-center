import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { container, item } from '../utils/variants';
import { useCostData, useTasks } from '../utils/useSupabase';

export function ReportsView() {
  const { data: costData } = useCostData();
  const { tasks } = useTasks();
  const burnData = costData.models.map((model, index) => ({ day: String(index + 1).padStart(2, '0'), cost: model.cost }));
  const completedCount = tasks.filter((task) => task.status === 'completed').length;

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar pb-10">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-1">Monthly Intelligence</h2>
          <p className="text-sm text-text-muted">Aggregated financial and operational analytics.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-aurora-violet hover:bg-aurora-violet/80 text-canvas font-bold rounded-lg transition-transform active:scale-95 shadow-glow-violet">
          <FileText className="w-4 h-4" /> Generate Intelligence
        </button>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-8">
        
        {/* Top Data Visualization Span */}
        <motion.div variants={item} className="grid grid-cols-12 gap-5 h-64">
          <div className="col-span-8 spatial-panel p-6 flex flex-col relative group">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-aurora-teal to-transparent opacity-30" />
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-sm text-text-muted uppercase tracking-widest mb-1">Compute Asset Burn Rate</h3>
                <div className="text-2xl font-mono text-text-primary">${costData.total.toFixed(2)}</div>
              </div>
              <div className="px-3 py-1 bg-aurora-teal/10 text-aurora-teal text-xs rounded border border-aurora-teal/20">30-Day Window</div>
            </div>

            <div className="flex-1 w-full -ml-4">
              {burnData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={burnData}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D9C8" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#00D9C8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: '#00D9C8', fontFamily: 'monospace' }}
                    />
                    <XAxis dataKey="day" hide />
                    <Area type="monotone" dataKey="cost" stroke="#00D9C8" fillOpacity={1} fill="url(#colorCost)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-text-muted">
                  No live cost data yet.
                </div>
              )}
            </div>
          </div>

          <div className="col-span-4 spatial-panel p-6 flex flex-col justify-between">
            <div>
               <h3 className="text-sm text-text-muted uppercase tracking-widest mb-1">Critical Exceptions</h3>
               <div className="text-4xl font-display text-aurora-rose mt-2">{tasks.filter((task) => task.status === 'error').length}</div>
               <p className="text-xs text-text-body mt-2">Live task failures recorded for this account.</p>
            </div>
            
            <div className="w-full pt-4 border-t border-border mt-auto">
               <div className="flex justify-between items-center text-xs mb-2">
                 <span className="text-text-muted">Target Fault Rate</span>
                 <span className="text-aurora-teal">0.12%</span>
               </div>
               <div className="w-full h-1 bg-surface-raised rounded-full overflow-hidden">
                 <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} transition={{ duration: 1 }} className="h-full bg-gradient-to-r from-aurora-teal to-aurora-violet" />
               </div>
            </div>
          </div>
        </motion.div>

        {/* Report File Index */}
        <motion.div variants={item}>
          <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4 border-b border-border pb-2">Compiled Archives</h3>
          <div className="spatial-panel flex items-center justify-between p-5 text-sm text-text-muted">
            <div>
              <div className="font-semibold text-text-primary">{completedCount} completed tasks</div>
              <div className="mt-1 text-xs">No archived mock reports are shipped anymore. This section will populate from real generated reports only.</div>
            </div>
            <Activity className="h-5 w-5 text-aurora-teal" />
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
