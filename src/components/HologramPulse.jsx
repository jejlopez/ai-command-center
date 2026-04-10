import React from 'react';
import { motion } from 'framer-motion';

export function HologramPulse() {
  return (
    <div className="relative w-96 h-96 flex items-center justify-center">
      {/* Outer Ring */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 rounded-full border border-dashed border-aurora-blue/30 scale-150"
      />
      
      {/* Middle Ring */}
      <motion.div 
        animate={{ rotate: -360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute inset-4 rounded-full border border-dotted border-aurora-teal/20 scale-110"
      />
      
      {/* Inner Radar/Pulse */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-16 rounded-full border border-aurora-teal/40 bg-aurora-teal/5 shadow-[0_0_40px_rgba(6,182,212,0.2)]"
      />
      
      {/* Core Unit */}
      <div className="absolute inset-32 rounded-full border-2 border-aurora-teal/60 bg-canvas-elevated flex items-center justify-center backdrop-blur-md">
        <div className="w-2 h-2 bg-aurora-teal rounded-full animate-ping"></div>
      </div>
    </div>
  );
}
