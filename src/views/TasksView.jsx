import React from 'react';
import { motion } from 'framer-motion';
import { PlayCircle, Clock, CheckCircle2, Circle } from 'lucide-react';

export function TasksView({ context }) {
  const tasks = context.tasks || [];

  return (
    <div className="flex flex-col gap-6 h-full pb-8">
      
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium text-white tracking-tight">Pipeline Control</h2>
        <button className="spatial-button px-4 py-2 text-sm bg-white text-black hover:bg-white/90">
          + New Routine
        </button>
      </div>

      {/* Board Layout */}
      <div className="grid grid-cols-3 gap-6 flex-1 min-h-[500px]">
        
        {/* Column: Pending */}
        <div className="spatial-panel rounded-3xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-medium text-white flex items-center gap-2">
              <Circle className="w-4 h-4 text-modern-muted" /> Queued
            </h3>
            <span className="text-xs font-mono text-modern-muted">0</span>
          </div>
          <div className="flex-1 flex items-center justify-center text-sm text-modern-muted text-center border-2 border-dashed border-modern-border/50 rounded-2xl">
            Drop sequence here
          </div>
        </div>

        {/* Column: In Progress */}
        <div className="spatial-panel rounded-3xl p-6 flex flex-col bg-white/[0.02]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-medium text-white flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-modern-highlight" /> Executing
            </h3>
            <span className="text-xs font-mono text-modern-muted">{tasks.filter(t => t.status === 'in-progress').length}</span>
          </div>
          
          <div className="flex-1 space-y-4">
            {tasks.filter(t => t.status === 'in-progress').map(t => (
              <motion.div 
                key={t.id}
                layoutId={`task-${t.id}`}
                className="bg-modern-bg border border-modern-border rounded-2xl p-5 hover:border-modern-accent transition-colors cursor-grab"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] font-mono uppercase bg-modern-panel px-2 py-1 rounded text-modern-muted border border-modern-border">{t.agent}</span>
                  <Clock className="w-3 h-3 text-modern-muted" />
                </div>
                <h4 className="text-sm text-white font-medium mb-4">{t.text}</h4>
                <div className="w-full h-1 bg-modern-panel rounded-full overflow-hidden">
                  <div className="h-full bg-modern-highlight rounded-full transition-all" style={{width: `${t.progress}%`}}></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Column: Done */}
        <div className="spatial-panel rounded-3xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-medium text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-modern-success" /> Completed
            </h3>
            <span className="text-xs font-mono text-modern-muted">{tasks.filter(t => t.status === 'completed').length}</span>
          </div>
          
          <div className="flex-1 space-y-4 opacity-60">
            {tasks.filter(t => t.status === 'completed').map(t => (
              <motion.div 
                key={t.id}
                layoutId={`task-${t.id}`}
                className="bg-modern-bg border border-modern-border/50 rounded-2xl p-5"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono text-modern-muted">{t.agent}</span>
                </div>
                <h4 className="text-sm text-modern-muted strike-through">{t.text}</h4>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
