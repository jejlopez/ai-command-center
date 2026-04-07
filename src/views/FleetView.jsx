import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Maximize2, Settings2 } from 'lucide-react';

export function FleetView({ context }) {
  const agents = context.agents || [];

  return (
    <div className="flex flex-col gap-6 h-full pb-8">
      
      {/* Top Controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium text-white tracking-tight">Fleet Graph</h2>
        <div className="flex gap-3">
          <button className="spatial-button px-4 py-2 flex items-center gap-2 text-sm bg-white text-black hover:bg-white/90">
            <Plus className="w-4 h-4" /> Deploy Node
          </button>
        </div>
      </div>

      {/* Main Node Canvas Area */}
      <div className="spatial-panel rounded-3xl flex-1 relative overflow-hidden flex flex-col border border-modern-border/40 bg-modern-bg/30">
        
        {/* Canvas Toolbar */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
          <div className="flex gap-2">
            <button className="spatial-pill px-3 py-1.5 text-xs text-modern-muted hover:text-white transition-colors">Select All</button>
            <button className="spatial-pill px-3 py-1.5 text-xs text-modern-muted hover:text-white transition-colors">Group</button>
          </div>
          <div className="flex gap-2">
            <button className="w-8 h-8 rounded-full spatial-pill flex items-center justify-center text-modern-muted hover:text-white transition-colors">
              <Settings2 className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-full spatial-pill flex items-center justify-center text-modern-muted hover:text-white transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Abstract Node Editor Canvas */}
        <div className="flex-1 w-full h-full relative" style={{ backgroundImage: 'radial-gradient(circle, #262626 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
          
          {agents.length === 0 ? (
             <div className="absolute inset-0 flex items-center justify-center text-modern-muted text-sm pb-10">
               No instances running in this workspace. Deploy a node to begin.
             </div>
          ) : (
             <div className="absolute inset-0 flex items-center justify-center mt-8">
               {/* Extremely Simplified Visual Node Representation */}
               <div className="relative w-[600px] h-[400px]">
                 {agents.map((agent, i) => {
                   const xOffset = i % 2 === 0 ? -150 + (i*50) : 150 - (i*50);
                   const yOffset = i * 80 - 100;
                   return (
                     <motion.div 
                       key={agent.id}
                       drag
                       dragMomentum={false}
                       initial={{ opacity: 0, scale: 0.8 }}
                       animate={{ opacity: 1, scale: 1 }}
                       whileHover={{ scale: 1.02 }}
                       whileDrag={{ scale: 1.05, zIndex: 50 }}
                       className="absolute p-4 rounded-xl spatial-pill cursor-pointer min-w-[180px] group"
                       style={{ left: `calc(50% + ${xOffset}px)`, top: `calc(50% + ${yOffset}px)` }}
                     >
                       <div className="flex justify-between items-start mb-3">
                         <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${agent.status === 'processing' ? 'bg-modern-success shadow-[0_0_8px_#10B981]' : agent.status === 'offline' ? 'bg-modern-alert' : 'bg-modern-muted'}`}></div>
                           <span className="font-sans font-medium text-white text-sm">{agent.name}</span>
                         </div>
                       </div>
                       <div className="flex flex-col gap-1">
                         <span className="text-xs font-mono text-modern-muted uppercase tracking-wider">{agent.role}</span>
                         <span className="text-[10px] text-modern-accent bg-white/5 px-2 py-0.5 rounded w-max">{agent.model}</span>
                       </div>
                       
                       {/* Connection anchors */}
                       <div className="absolute w-2 h-2 rounded-full bg-modern-border -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                       <div className="absolute w-2 h-2 rounded-full bg-modern-border -right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     </motion.div>
                   )
                 })}

                 {/* Connection Paths (Abstract representation) */}
                 {agents.length > 1 && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none -z-10">
                      <path d="M 230 180 C 300 180, 300 240, 370 240" stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none" />
                    </svg>
                 )}
               </div>
             </div>
          )}

        </div>
        
        {/* Properties Panel (Right side fixed) */}
        {agents.length > 0 && (
          <div className="absolute right-0 top-0 bottom-0 w-72 border-l border-modern-border/30 bg-modern-panel/95 backdrop-blur-3xl p-6 shadow-2xl flex flex-col pt-20">
            <h3 className="text-sm font-medium text-white mb-6">Node Properties</h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-mono text-modern-muted uppercase">Selected Asset</label>
                <div className="p-3 bg-modern-bg rounded-lg text-sm text-white border border-modern-border">{agents[0].name}</div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-mono text-modern-muted uppercase">Model</label>
                <select className="w-full p-3 bg-modern-bg rounded-lg text-sm text-modern-accent border border-modern-border appearance-none">
                  <option>{agents[0].model}</option>
                  <option>GPT-4o</option>
                  <option>Claude 3.5 Sonnet</option>
                </select>
              </div>
              
              <div className="pt-6 border-t border-modern-border/50">
                <button className="text-sm text-modern-alert hover:text-white transition-colors w-full text-left">Suspend Node</button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
