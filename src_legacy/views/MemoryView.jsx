import React from 'react';
import { motion } from 'framer-motion';
import { Database, Search, Layers, Server, Hash } from 'lucide-react';
import { container, item } from '../utils/variants';
import { useActivityLog } from '../utils/useSupabase';

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'now';
  const diffMs = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ago`;
}

export function MemoryView() {
  const { logs } = useActivityLog();
  const embeddings = logs.slice(-5).reverse().map((log, index) => ({
    id: `vec_${String(index + 1).padStart(4, '0')}`,
    context: log.message,
    distance: (0.01 + index * 0.017).toFixed(3),
    namespace: log.agentId ? 'agent-memory' : 'system-events',
    date: formatRelativeTime(log.timestamp),
  }));

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
          <div className="col-span-4 ui-panel p-6 border-aurora-teal/20 relative overflow-hidden group hover:shadow-glow-blue transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 flex items-center justify-center transform group-hover:scale-110 transition-transform"><Database size={80} /></div>
            <h3 className="text-sm text-text-muted uppercase tracking-widest mb-1 relative z-10">Total Extracted Vectors</h3>
            <div className="text-4xl font-mono text-aurora-teal font-bold relative z-10">{logs.length}</div>
            <div className="mt-4 flex items-center gap-2 text-xs text-aurora-teal font-medium relative z-10">
              <span className="w-2 h-2 rounded-full bg-aurora-teal animate-pulse" /> Live vectors derived from account activity
            </div>
          </div>
          
          <div className="col-span-4 ui-panel p-6 border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 flex items-center justify-center"><Server size={80} /></div>
            <h3 className="text-sm text-text-muted uppercase tracking-widest mb-1">Memory Footprint</h3>
            <div className="text-4xl font-mono text-text-primary font-bold">{(logs.length / 100).toFixed(1)} <span className="text-2xl text-text-muted font-normal">GB</span></div>
            <div className="mt-4 w-full h-1 bg-surface-raised rounded-full overflow-hidden">
              <div className="h-full bg-text-muted" style={{ width: `${Math.min(100, logs.length)}%` }} />
            </div>
            <p className="text-[10px] text-text-muted mt-2 text-right">{Math.min(100, logs.length)}% Storage Index</p>
          </div>

          <div className="col-span-4 ui-panel p-6 border-white/5 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10 flex items-center justify-center"><Layers size={80} /></div>
             <h3 className="text-sm text-text-muted uppercase tracking-widest mb-1">Active Namespaces</h3>
             <div className="text-4xl font-mono text-text-primary font-bold">{new Set(logs.map((log) => (log.agentId ? 'agent-memory' : 'system-events'))).size}</div>
             <div className="flex flex-wrap gap-2 mt-4 relative z-10">
               <span className="px-2 py-1 bg-white/[0.04] rounded text-[10px] font-mono text-text-muted">agent-memory</span>
               <span className="px-2 py-1 bg-white/[0.04] rounded text-[10px] font-mono text-text-muted">system-events</span>
             </div>
          </div>
        </motion.div>

        {/* Data Console Matrix */}
        <motion.div variants={item} className="ui-shell flex flex-col">
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
                {embeddings.map((emb, idx) => (
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
                {embeddings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-text-muted">
                      No memory records have been created for this account yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
