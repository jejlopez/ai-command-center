import React from 'react';
import { Network, Activity } from 'lucide-react';

export function AgentList({ agents }) {
  return (
    <div className="glass-panel rounded-xl flex flex-col h-full overflow-hidden border border-jarvis-border/40 bg-jarvis-surface/20">
      <div className="p-4 border-b border-jarvis-border/30 bg-jarvis-dark/80 backdrop-blur">
        <h2 className="font-display font-semibold text-jarvis-cyan tracking-wider flex items-center gap-2">
          <Network className="w-5 h-5" />
          FLEET ASSETS
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-jarvis-surface/40 hover:bg-jarvis-surface/60 transition-colors border border-jarvis-border/30 p-3 rounded group relative overflow-hidden">
            {/* Status gradient bg */}
            {agent.status === 'processing' && (
               <div className="absolute top-0 left-0 w-1 bg-jarvis-cyan h-full shadow-[0_0_10px_#06b6d4]"></div>
            )}
            {agent.status === 'offline' && (
               <div className="absolute top-0 left-0 w-1 bg-slate-600 h-full"></div>
            )}
            {agent.status === 'idle' && (
               <div className="absolute top-0 left-0 w-1 bg-jarvis-blue h-full"></div>
            )}

            <div className="flex gap-4 items-center">
              {/* 2D Pixel Avatar */}
              <div className="shrink-0 w-12 h-12 bg-jarvis-dark/80 border border-jarvis-border/50 rounded flex justify-center items-center overflow-hidden relative group-hover:border-jarvis-cyan/50 transition-colors">
                <img 
                  src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${agent.seed}&backgroundColor=transparent`} 
                  alt={agent.name}
                  className="w-10 h-10 object-contain drop-shadow-[0_0_5px_rgba(14,165,233,0.5)]"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-display text-sm font-bold text-white truncate">{agent.name}</h3>
                  <div className="flex items-center gap-1">
                    {agent.status === 'processing' && <Activity className="w-3 h-3 text-jarvis-cyan animate-pulse" />}
                    <span className={`font-mono text-[10px] uppercase tracking-wider ${
                      agent.status === 'processing' ? 'text-jarvis-cyan' : 
                      agent.status === 'idle' ? 'text-jarvis-blue' : 'text-slate-500'
                    }`}>
                      {agent.status}
                    </span>
                  </div>
                </div>
                <p className="font-mono text-xs text-jarvis-blue/70 truncate">{agent.role}</p>
              </div>
            </div>
            
            {/* Mock telemetry */}
            <div className="mt-3 pt-2 border-t border-jarvis-border/20 flex gap-4 font-mono text-[10px] text-slate-400">
              <div>MEM: {agent.status === 'processing' ? '84%' : agent.status === 'offline' ? '0%' : '12%'}</div>
              <div>GPU: {agent.status === 'processing' ? 'TEMP NORMAL' : 'STNDBY'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
