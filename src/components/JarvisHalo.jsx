import { motion } from 'framer-motion';
import { cn } from '../utils/cn';

export function JarvisHalo({ className }) {
  return (
    <div className={cn('relative flex h-[220px] w-[220px] items-center justify-center', className)}>
      <div className="jarvis-halo-glow absolute inset-0 rounded-full" />

      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-0 rounded-full border border-white/10"
      />

      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-[14%] rounded-full border border-dashed border-aurora-violet/30"
      />

      <motion.div
        animate={{ rotate: 360, scale: [0.98, 1.03, 0.98] }}
        transition={{
          rotate: { duration: 16, repeat: Infinity, ease: 'linear' },
          scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute inset-[23%] rounded-full border border-aurora-teal/35"
      />

      <motion.div
        animate={{ rotate: [0, 8, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="jarvis-dot-field absolute inset-[11%] rounded-full"
      />

      <motion.div
        animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-[30%] rounded-full border border-aurora-blue/40 bg-aurora-blue/10 blur-[1px]"
      />

      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-[7%] rounded-full"
      >
        <div className="jarvis-sweep absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 origin-bottom" />
      </motion.div>

      <div className="relative flex h-[86px] w-[86px] flex-col items-center justify-center rounded-full border border-white/10 bg-black/45 backdrop-blur-xl shadow-[0_0_50px_rgba(96,165,250,0.15)]">
        <span className="text-[9px] uppercase tracking-[0.35em] text-text-muted">Core</span>
        <span className="mt-1 font-mono text-lg font-semibold tracking-[0.3em] text-white">JARVIS</span>
      </div>
    </div>
  );
}
