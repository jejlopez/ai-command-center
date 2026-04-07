import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Activity, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { container, item } from '../utils/variants';

const burnData = [
  { day: '01', cost: 120 }, { day: '05', cost: 180 }, { day: '10', cost: 150 }, 
  { day: '15', cost: 240 }, { day: '20', cost: 210 }, { day: '25', cost: 290 }, 
  { day: '30', cost: 250 }
];

const mockReports = [
  { id: 1, title: 'October Burn Analysis', date: 'Oct 31, 2026', type: 'Financial', desc: 'Detailed breakdown of API costs across all running agents.', status: 'Completed', trend: '+12%', Icon: Zap },
  { id: 2, title: 'Pipeline Latency Outages', date: 'Oct 15, 2026', type: 'Engineering', desc: 'Post-mortem on the Firecrawl scraping delay incident.', status: 'Archived', trend: '-4%', Icon: Activity },
  { id: 3, title: 'System Growth & Usage', date: 'Sep 30, 2026', type: 'Executive', desc: 'High-level aggregation of automated tasks vs manual intervention.', status: 'Completed', trend: '+28%', Icon: TrendingUp }
];

export function ReportsView() {
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
                <div className="text-2xl font-mono text-text-primary">$1,440.00 <span className="text-sm text-aurora-green ml-2">+12%</span></div>
              </div>
              <div className="px-3 py-1 bg-aurora-teal/10 text-aurora-teal text-xs rounded border border-aurora-teal/20">30-Day Window</div>
            </div>

            <div className="flex-1 w-full -ml-4">
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
            </div>
          </div>

          <div className="col-span-4 spatial-panel p-6 flex flex-col justify-between">
            <div>
               <h3 className="text-sm text-text-muted uppercase tracking-widest mb-1">Critical Exceptions</h3>
               <div className="text-4xl font-display text-aurora-rose mt-2">14</div>
               <p className="text-xs text-text-body mt-2">API rate limits and memory leaks logged.</p>
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
          <div className="grid grid-cols-3 gap-5">
            {mockReports.map(rep => (
              <motion.div 
                key={rep.id} 
                whileHover={{ y: -4, scale: 1.02 }}
                className="spatial-panel p-5 flex flex-col border-white/5 hover:border-aurora-violet/30 transition-all cursor-pointer group hover:shadow-glow-violet overflow-hidden"
              >
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-aurora-violet/10 rounded-full blur-2xl group-hover:bg-aurora-violet/20 transition-all pointer-events-none" />
                
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-aurora-violet border border-white/5 group-hover:bg-aurora-violet group-hover:text-canvas transition-colors">
                    <rep.Icon className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">{rep.type}</div>
                    <div className="text-xs font-mono text-aurora-green">{rep.trend}</div>
                  </div>
                </div>
                
                <h3 className="text-text-primary font-semibold text-lg mb-2 relative z-10">{rep.title}</h3>
                <p className="text-xs text-text-body mb-6 flex-1 relative z-10">{rep.desc}</p>
                
                <div className="flex items-center justify-between text-[10px] border-t border-border pt-4 mt-auto relative z-10">
                  <div className="flex items-center gap-2 text-text-muted">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="font-mono">{rep.date}</span>
                  </div>
                  <button className="flex items-center gap-1.5 text-aurora-violet hover:text-white transition-colors">
                    <Download className="w-3.5 h-3.5" /> DL
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
}
