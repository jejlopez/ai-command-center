import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers } from 'lucide-react';

export function TaskQueue({ tasks }) {
  return (
    <div className="glass-panel flex flex-col rounded-xl overflow-hidden h-full border border-jarvis-border/40 bg-jarvis-surface/20">
      <div className="p-4 border-b border-jarvis-border/30 bg-jarvis-dark/80 backdrop-blur flex justify-between items-center">
         <h2 className="font-display font-semibold text-jarvis-cyan tracking-wider flex items-center gap-2">
           <Layers className="w-5 h-5" />
           TASK PROTOCOL
         </h2>
         <div className="font-mono text-xs text-jarvis-blue/70">
           {tasks.length} JOB(S) IN QUEUE
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence>
          {tasks.map((task) => (
            <motion.div 
              key={task.id}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-jarvis-surface/30 border border-jarvis-border/30 p-4 rounded-lg relative overflow-hidden group hover:border-jarvis-cyan/30 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-[10px] text-jarvis-cyan bg-jarvis-blue/10 px-2 py-0.5 rounded border border-jarvis-border/50">
                  {task.agent}
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase">
                  {task.status}
                </span>
              </div>
              
              <p className="font-mono text-sm text-white mb-4">
                <span className="text-jarvis-blue mr-2">{"//"}</span>
                {task.text}
              </p>
              
              {/* Progress Bar */}
              <div className="h-1 w-full bg-jarvis-dark rounded overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${task.progress}%` }}
                  transition={{ duration: 1 }}
                  className={`h-full ${task.progress === 100 ? 'bg-jarvis-blue' : 'bg-jarvis-cyan shadow-[0_0_8px_#06b6d4]'}`}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
