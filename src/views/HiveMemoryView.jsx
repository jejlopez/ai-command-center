import React from 'react';
import { motion } from 'framer-motion';
import { Database, FileText, Share2, Search, PlusCircle } from 'lucide-react';

const KNOWLEDGE_BASE = [
  { id: 1, name: 'Brand_Guidelines_2026.pdf', type: 'document', size: '4.2 MB', embeddedAt: 'yesterday', status: 'synced' },
  { id: 2, name: 'API_Documentation_v3.md', type: 'code', size: '156 KB', embeddedAt: '3 days ago', status: 'synced' },
];

export function HiveMemoryView({ context }) {
  return (
    <div className="grid grid-cols-12 gap-6 h-full pb-8">
      
      {/* LEFT: Context Vector Visualization */}
      <div className="col-span-5 spatial-panel rounded-3xl p-8 flex flex-col relative overflow-hidden h-full">
        <div className="absolute inset-0 bg-mesh opacity-30 pointer-events-none"></div>
        <h3 className="font-medium text-white mb-6 z-10">Shared Intelligence Vector</h3>
        <p className="text-sm text-modern-muted mb-8 leading-relaxed z-10">
          The memory core provides real-time RAG context to all active agents within the <span className="text-modern-primary">{context?.id || 'current'}</span> workspace.
        </p>

        {/* Minimalist Vector Representation */}
        <div className="flex-1 rounded-2xl bg-modern-bg/50 border border-modern-border/30 relative flex items-center justify-center p-4 z-10">
          <div className="relative w-full max-w-[200px] aspect-square flex items-center justify-center">
             {/* Center DB Node */}
             <div className="w-16 h-16 rounded-2xl border border-modern-border bg-modern-panel flex items-center justify-center shadow-xl z-20">
               <Database className="w-6 h-6 text-modern-accent" />
             </div>

             {/* Orbiting particles */}
             {[...Array(6)].map((_, i) => (
               <motion.div 
                 key={i}
                 className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10"
                 animate={{ rotate: 360 }}
                 transition={{ duration: 15 + (i * 3), repeat: Infinity, ease: 'linear' }}
                 style={{ originX: 0, originY: 0, translateX: `${50 + (i * 6)}px`, translateY: 0 }}
               />
             ))}
             
             {/* Abstract Grid Rings */}
             <svg className="absolute inset-0 w-full h-full opacity-10 pointer-events-none">
                <circle cx="50%" cy="50%" r="60" stroke="#fff" fill="none" />
                <circle cx="50%" cy="50%" r="90" stroke="#fff" fill="none" />
             </svg>
          </div>
        </div>
        
        <div className="mt-6 flex flex-wrap gap-3 font-mono text-[10px] text-modern-muted">
          <div className="bg-modern-bg px-3 py-1.5 rounded border border-modern-border uppercase">Vector Count: 1.4M</div>
          <div className="bg-modern-bg px-3 py-1.5 rounded border border-modern-border uppercase">CTX: 128K</div>
        </div>
      </div>

      {/* RIGHT: Document Manager */}
      <div className="col-span-7 flex flex-col h-full gap-6">
        
        <div className="flex gap-4">
           <div className="flex-1 spatial-panel rounded-2xl p-6 flex flex-col justify-center relative group cursor-pointer overflow-hidden">
             <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <div className="flex flex-col gap-2">
               <PlusCircle className="w-6 h-6 text-modern-accent" />
               <span className="text-sm font-medium text-white">Embed Data source</span>
               <span className="text-xs text-modern-muted">Drag & drop files or link repos</span>
             </div>
           </div>
           
           <div className="flex-1 spatial-panel rounded-2xl p-6 flex flex-col justify-center">
             <label className="text-xs font-medium text-modern-muted mb-3">Semantic Query Core</label>
             <div className="relative">
               <input 
                 type="text" 
                 placeholder="Search the hive..." 
                 className="w-full bg-modern-bg border border-modern-border rounded-xl px-4 py-3 pl-10 text-sm focus:outline-none focus:border-white/20 text-white placeholder:text-modern-muted"
               />
               <Search className="w-4 h-4 text-modern-muted absolute left-3 top-3.5" />
             </div>
           </div>
        </div>

        <div className="spatial-panel flex-1 rounded-3xl p-8 overflow-y-auto">
          <h4 className="font-medium text-white mb-6">Indexed Knowledge</h4>
          
          <div className="space-y-3">
            {KNOWLEDGE_BASE.map(doc => (
               <div key={doc.id} className="bg-modern-bg/50 border border-modern-border/50 rounded-xl p-4 flex items-center gap-4 hover:bg-modern-panel transition-colors cursor-pointer">
                 <div className="w-10 h-10 rounded-lg bg-modern-border/30 flex items-center justify-center">
                   <FileText className="w-5 h-5 text-modern-accent" />
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-center mb-1">
                     <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                     <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-modern-success/10 text-modern-success border border-modern-success/20">
                       {doc.status}
                     </span>
                   </div>
                   <div className="flex gap-4 text-xs text-modern-muted mt-1">
                     <span className="uppercase tracking-wide">{doc.type}</span>
                     <span>{doc.size}</span>
                   </div>
                 </div>
               </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
