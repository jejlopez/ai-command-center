import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Activity, ScanLine, Stethoscope, RotateCcw, X, Pause, Play, Download } from 'lucide-react';
import { useSystemState } from '../context/SystemStateContext';
import { useAgents } from '../utils/useSupabase';
import { cn } from '../utils/cn';

export function DoctorModePanel() {
  const { doctorModeOpen, setDoctorModeOpen } = useSystemState();
  const { agents } = useAgents();
  const [logs, setLogs] = useState([]);
  const [autopilotOn, setAutopilotOn] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const logsEndRef = useRef(null);

  // Safety: If agents haven't loaded yet, default to empty
  const safeAgents = agents || [];

  useEffect(() => {
    if (doctorModeOpen && logs.length === 0) {
      setLogs([{ type: 'info', text: `[${new Date().toLocaleTimeString()}] 🩺 Doctor Mode Engaged. System health check routine running...` }]);
    }
  }, [doctorModeOpen, logs.length]);

  useEffect(() => {
    if (!isPaused) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isPaused]);

  if (!doctorModeOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setDoctorModeOpen(false)} />
      <motion.div
        initial={{ x: -420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -420, opacity: 0 }}
        className="fixed top-0 bottom-0 left-16 z-50 w-[420px] bg-[#111111]/95 backdrop-blur-2xl border-r border-white/10 flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <Stethoscope className="w-5 h-5 text-[#00FF41]" />
            <h2 className="text-sm font-semibold text-white tracking-wide">Medic</h2>
          </div>
          <button onClick={() => setDoctorModeOpen(false)} className="p-1.5 text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="p-4 bg-white/5 rounded-lg border border-white/5 flex justify-between items-center">
            <div>
              <div className="text-sm font-medium">Autopilot Medic</div>
              <div className="text-xs text-white/40">Auto-resolve issues</div>
            </div>
            <button 
              onClick={() => setAutopilotOn(!autopilotOn)}
              className={cn("w-10 h-5 rounded-full transition-colors relative", autopilotOn ? "bg-[#00FF41]/30" : "bg-black")}
            >
              <div className={cn("w-4 h-4 rounded-full absolute top-0.5 shadow-sm transition-all", autopilotOn ? "bg-[#00FF41] left-5" : "bg-white/40 left-0.5")} />
            </button>
          </div>

          <div className="bg-black/60 rounded-xl border border-white/10 p-4 font-mono text-xs h-[400px] overflow-y-auto overflow-x-hidden">
            {logs.map((log, i) => (
              <div key={i} className="mb-2 text-white/60">
                {log.text}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
