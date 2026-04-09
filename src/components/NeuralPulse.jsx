import React from 'react';
import { motion } from 'framer-motion';
import { useAnimatedCounter } from '../utils/useAnimatedCounter';
import { Activity, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { JarvisHalo } from './JarvisHalo';

export function NeuralPulse({ systemHealth = 100, agentCount = 0, idleCount = 0, errorCount = 0, totalCount = 0, onDeploy }) {
  const displayCount = useAnimatedCounter(agentCount);

  let orbColor = '#00D9C8'; // teal
  if (systemHealth <= 70) orbColor = '#fb7185'; // rose
  else if (systemHealth <= 90) orbColor = '#fbbf24'; // amber

  return (
    <div className="relative overflow-hidden spatial-panel">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(96,165,250,0.15),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(167,139,250,0.12),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-y-6 left-[33%] hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent lg:block" />

      <div className="relative flex flex-col gap-8 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-text-muted">
            <Sparkles className="h-3.5 w-3.5 text-aurora-violet" />
            Jarvis Command Layer
          </div>

          <div className="flex items-start gap-4">
            <div className="relative mt-1 flex h-12 w-12 items-center justify-center">
              <motion.div
                animate={{ scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
                className="h-full w-full rounded-full"
                style={{
                  backgroundColor: `${orbColor}66`,
                  boxShadow: `0 0 20px ${orbColor}33, 0 0 40px ${orbColor}22, 0 0 80px ${orbColor}11`,
                }}
              />
              <div className="absolute z-10 h-6 w-6 rounded-full" style={{ backgroundColor: orbColor }} />
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">System Core</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
                Jarvis orchestration is <span className="text-white">live</span>
              </div>
              <div className="mt-2 flex items-end gap-3">
                <div className="font-mono text-4xl font-bold leading-none text-text-primary">
                  <motion.span>{displayCount}</motion.span>
                </div>
                <div className="pb-1 text-sm text-text-muted">
                  active agents out of {totalCount}
                </div>
              </div>
              <p className="mt-4 max-w-lg text-sm leading-6 text-text-muted">
                Use this lane as the dashboard&apos;s cinematic anchor: ambient scan lines, orbital telemetry, and a responsive core that intensifies when system load or alerts spike.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-teal opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-aurora-teal" />
              </span>
              <span className="text-xs font-mono text-aurora-teal">{agentCount} Active</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <Activity className="h-3.5 w-3.5 text-aurora-blue" />
              <span className="text-xs font-mono text-text-muted">{idleCount} Idle</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <ShieldCheck className="h-3.5 w-3.5 text-aurora-green" />
              <span className="text-xs font-mono text-text-muted">{systemHealth}% Health</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-aurora-rose/30 bg-aurora-rose/10 px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-aurora-rose animate-pulse" />
                <span className="text-xs font-mono font-semibold text-aurora-rose">{errorCount} Error</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 lg:items-end">
          <JarvisHalo className="h-[200px] w-[200px] sm:h-[220px] sm:w-[220px]" />
          <div className="grid w-full max-w-sm grid-cols-3 gap-2 text-center">
            {[
              ['Load', `${Math.max(agentCount * 7, 12)}%`],
              ['Standby', `${idleCount}`],
              ['Alerts', `${errorCount}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                <div className="text-[9px] uppercase tracking-[0.22em] text-text-disabled">{label}</div>
                <div className="mt-1 font-mono text-sm text-text-primary">{value}</div>
              </div>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDeploy}
            className="flex items-center gap-2 rounded-xl bg-aurora-teal px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-aurora-teal/90 shadow-glow-teal"
          >
            <Plus className="h-4 w-4" />
            Deploy Agent
          </motion.button>
        </div>
      </div>
    </div>
  );
}
