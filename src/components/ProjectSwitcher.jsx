import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, FolderDot, LayoutGrid } from 'lucide-react';
import { PROJECTS } from '../utils/mockData';

export function ProjectSwitcher({ activeProject, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const current = PROJECTS.find(p => p.id === activeProject) || PROJECTS[0];

  return (
    <div className="relative z-50">
      {/* The Floating Pill */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="spatial-pill py-2 px-4 rounded-full flex items-center gap-3 hover:bg-modern-panel transition-all group"
      >
        <FolderDot className="w-4 h-4 text-modern-muted group-hover:text-modern-primary transition-colors" />
        <span className="font-sans text-sm font-medium text-modern-primary">{current.name}</span>
        <span className="text-[10px] uppercase font-mono text-modern-muted bg-white/5 px-2 py-0.5 rounded-full">
          {current.environment}
        </span>
        <ChevronDown className={`w-4 h-4 text-modern-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* The Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-3 left-1/2 -translate-x-1/2 w-64 spatial-panel rounded-xl overflow-hidden py-2"
          >
            <div className="px-4 py-2 border-b border-modern-border mb-2 flex items-center gap-2">
              <LayoutGrid className="w-3 h-3 text-modern-muted" />
              <span className="text-xs font-mono uppercase text-modern-muted tracking-widest">Workspaces</span>
            </div>
            
            {PROJECTS.map(proj => (
              <button
                key={proj.id}
                onClick={() => {
                  onChange(proj.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors ${activeProject === proj.id ? 'bg-white/5' : ''}`}
              >
                <div className="flex flex-col">
                  <span className={`text-sm font-sans ${activeProject === proj.id ? 'text-white' : 'text-modern-accent'}`}>
                    {proj.name}
                  </span>
                  <span className="text-[10px] text-modern-muted uppercase font-mono mt-0.5">{proj.environment}</span>
                </div>
                {activeProject === proj.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-modern-primary"></div>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
