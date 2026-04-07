import React from 'react';
import { motion } from 'framer-motion';
import { Database, Search, Layers, Server, Hash } from 'lucide-react';
import { container, item } from '../utils/variants';

const mockEmbeddings = [
  { id: 'vec_8a99', context: 'SaaS landing page pricing tiers scraped from firecrawl session.', distance: '0.002', namespace: 'intel-market', date: '2 min ago' },
  { id: 'vec_2b4f', context: 'System prompt override instructions for deep parsing JSON schemas.', distance: '0.015', namespace: 'system-config', date: '1 hr ago' },
  { id: 'vec_7c11', context: 'Cached user session identity tokens and auth constraints.', distance: '0.041', namespace: 'identity', date: '3 hrs ago' },
  { id: 'vec_1d8e', context: 'Parsed HTML DOM tree representation of Bloomberg live feed.', distance: '0.089', namespace: 'intel-market', date: '4 hrs ago' },
  { id: 'vec_9f2a', context: 'Agent Atlas memory dump post-crash analysis diagnostics.', distance: '0.120', namespace: 'logs-archive', date: '12 hrs ago' },
];

export function MemoryView() {
  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar pb-10">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-1">Memory Core Database</h2>
          <p className="text-sm text-text-muted">High-density Vector Embeddings and Deep Storage search.</p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input 
            type="text" 
            placeholder="Query semantic index..." 
            className="w-full bg-surface border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm font-mono focus:outline-none focus:border-aurora-teal transition-colors text-text-primary"
          />
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-6">

        {/* Top Analytics Tier */}
        <motion.div variants={item} className="grid grid-cols-12 gap-6">
          <div className="col-span-4 spatial-panel p-6 border-aurora-teal/20 relative overflow-hidden group hover:shadow-glow-blue transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 flex items-center justify-center transform group-hover:scale-110 transition-transform"><Database size={80} /></div>
            <h3 className="text-sm text-text-muted uppercase tracking-widest mb-1 relative z-10">Total Extracted Vectors</h3>
            <div className="text-4xl font-mono text-aurora-teal font-bold relative z-10">84,102</div>
            <div className="mt-4 flex items-center gap-2 text-xs text-aurora-teal font-medium relative z-10">
              <span className="w-2 h-2 rounded-full bg-aurora-teal animate-pulse" /> +1,240 stored today
            </div>
          </div>
          
          <div className="col-span-4 spatial-panel p-6 border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 flex items-center justify-center"><Server size={80} /></div>
            <h3 className="text-sm text-text-muted uppercase tracking-widest mb-1">Memory Footprint</h3>
            <div className="text-4xl font-mono text-text-primary font-bold">14.2 <span className="text-2xl text-text-muted font-normal">GB</span></div>
            <div className="mt-4 w-full h-1 bg-surface-raised rounded-full overflow-hidden">
              <div className="h-full bg-text-muted w-[34%]" />
            </div>
            <p className="text-[10px] text-text-muted mt-2 text-right">34% Storage Limit</p>
          </div>

          <div className="col-span-4 spatial-panel p-6 border-white/5 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10 flex items-center justify-center"><Layers size={80} /></div>
             <h3 className="text-sm text-text-muted uppercase tracking-widest mb-1">Active Namespaces</h3>
             <div className="text-4xl font-mono text-text-primary font-bold">12</div>
             <div className="flex flex-wrap gap-2 mt-4 relative z-10">
               <span className="px-2 py-1 bg-white/[0.04] rounded text-[10px] font-mono text-text-muted">intel-market</span>
               <span className="px-2 py-1 bg-white/[0.04] rounded text-[10px] font-mono text-text-muted">identity</span>
               <span className="px-2 py-1 bg-white/[0.04] rounded text-[10px] font-mono text-text-muted">system</span>
             </div>
          </div>
        </motion.div>

        {/* Data Console Matrix */}
        <motion.div variants={item} className="spatial-panel flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between bg-black/20 rounded-t-xl">
             <h3 className="text-xs uppercase tracking-widest text-text-muted font-semibold flex items-center gap-2">
               <Hash className="w-4 h-4 text-aurora-teal" /> Live Semantic Matrix
             </h3>
          </div>
          
          <div className="w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.04] text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="font-semibold py-3 px-6">CID / Hash</th>
                  <th className="font-semibold py-3 px-6">Context Representation</th>
                  <th className="font-semibold py-3 px-6">Namespace</th>
                  <th className="font-semibold py-3 px-6">Proximity (L2)</th>
                  <th className="font-semibold py-3 px-6 text-right">Indexed</th>
                </tr>
              </thead>
              <tbody className="text-sm text-text-primary">
                {mockEmbeddings.map((emb, idx) => (
                  <tr key={idx} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group cursor-crosshair">
                    <td className="py-4 px-6 font-mono text-xs text-text-muted group-hover:text-aurora-teal transition-colors">
                      {emb.id}
                    </td>
                    <td className="py-4 px-6 pr-12 w-1/2">
                      <span className="truncate block opacity-80 group-hover:opacity-100 transition-opacity">
                        {emb.context}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-1 bg-surface-raised border border-white/5 rounded text-[10px] font-mono text-text-muted">
                        {emb.namespace}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs opacity-70">
                      {emb.distance}
                    </td>
                    <td className="py-4 px-6 text-right text-xs text-text-disabled">
                      {emb.date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
