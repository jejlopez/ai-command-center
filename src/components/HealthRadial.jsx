import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function HealthRadial({ label, value, color }) {
  const [offset, setOffset] = useState(175.93); // Full circle stroke-dasharray roughly 2 * pi * 28

  useEffect(() => {
    // animate offset after mount
    const dash = 175.93;
    const newOffset = dash - (dash * value) / 100;
    setTimeout(() => setOffset(newOffset), 100);
  }, [value]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle 
            cx="32" cy="32" r="28" 
            fill="none" 
            stroke="rgba(255,255,255,0.06)" 
            strokeWidth="5" 
          />
          <motion.circle 
            cx="32" cy="32" r="28" 
            fill="none" 
            stroke={color} 
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="175.93"
            initial={{ strokeDashoffset: 175.93 }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-sm font-semibold font-tabular text-text-primary">{value}</span>
        </div>
      </div>
      <div className="mt-2 text-[9px] uppercase tracking-[0.15em] text-text-disabled">{label}</div>
    </div>
  );
}
