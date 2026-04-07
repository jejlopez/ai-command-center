import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Activity, ScanLine, Stethoscope, RotateCcw, History, X, Pause, Play, Download, AlertTriangle } from 'lucide-react';
import { useSystemState } from '../context/SystemStateContext';
import { cn } from '../utils/cn';

export function DoctorModePanel() {
  const { doctorModeOpen, setDoctorModeOpen } = useSystemState();
  const [logs, setLogs] = useState([]);
  const [working, setWorking] = useState(false);
  const [autopilotOn, setAutopilotOn] = useState(false);

  const [isPaused, setIsPaused] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [logicLoops, setLogicLoops] = useState([
    { id: 'agent-4', name: 'Agent 4: Scraper', time: '2m ago' },
    { id: 'worker-2', name: 'Worker 2: UI', time: '12s ago' }
  ]);

  const logsEndRef = useRef(null);

  useEffect(() => {
    if (doctorModeOpen && !isPaused) {
      if (logs.length === 0) {
          setLogs([{ type: 'info', text: '[' + new Date().toLocaleTimeString() + '] 🩺 Doctor Mode Engaged. System health check routine running...' }]);
      }

      const interval = setInterval(() => {
        if (!autopilotOn) {
            setLogs((prev) => [...prev, { type: 'info', text: `[${new Date().toLocaleTimeString()}] No critical fleet issues found.` }].slice(-15));
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [doctorModeOpen, autopilotOn, isPaused, logs.length]);

  useEffect(() => {
    if (autopilotOn && !isPaused) {
      setLogs((prev) => [...prev, { type: 'autopilot', text: `[${new Date().toLocaleTimeString()}] 🟢 Autopilot Medic ACTIVE. Scanning for logic loops...` }]);
      const medicInterval = setInterval(() => {
        const interventions = [
            'Agent 4 logic loop detected. Executing micro-restart...',
            'Memory fragmentation on Agent 12 healed.',
            'Telemetry spike normalized via Autopilot.',
            'Stalled Subtask (id: a9x4) purged and redelegated.'
        ];
        const randomFix = interventions[Math.floor(Math.random() * interventions.length)];
        setLogs((prev) => [...prev, { type: 'autopilot', text: `[${new Date().toLocaleTimeString()}] [AUTOPILOT] ${randomFix} 💉` }].slice(-15));
      }, 4000);
      return () => clearInterval(medicInterval);
    } else if (doctorModeOpen && !autopilotOn && !isPaused && logs.length > 0) {
      setLogs((prev) => [...prev, { type: 'critical', text: `[${new Date().toLocaleTimeString()}] 🔴 Autopilot Medic OFFLINE. Manual intervention required.` }]);
    }
  }, [autopilotOn, doctorModeOpen, isPaused]);

  useEffect(() => {
    if (!isPaused) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isPaused]);

  const executeDiagnosis = (actionName) => {
    if (working) return;
    setWorking(true);
    setLogs((prev) => [...prev, { type: 'action', text: `[${new Date().toLocaleTimeString()}] INITIATING: ${actionName}...` }]);
    setTimeout(() => {
      setLogs((prev) => [...prev, { type: 'success', text: `[${new Date().toLocaleTimeString()}] COMPLETE: ${actionName} successful.` }]);
      setWorking(false);
    }, 2000);
  };

  const purgeTargetAgent = (agent) => {
    if (working) return;
    setWorking(true);
    setLogs((prev) => [...prev, { type: 'action', text: `[${new Date().toLocaleTimeString()}] PURGING: Resetting memory core for ${agent.name}...` }]);
    setTimeout(() => {
      setLogs((prev) => [...prev, { type: 'success', text: `[${new Date().toLocaleTimeString()}] HEALED: ${agent.name} context restored.` }]);
      setLogicLoops((prev) => prev.filter(l => l.id !== agent.id));
      setWorking(false);
    }, 1500);
  };

  const filteredLogs = logs.filter(log => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'critical') return log.type === 'critical' || log.type === 'action';
    if (activeFilter === 'autopilot') return log.type === 'autopilot';
    return true;
  });

  return (
    <AnimatePresence>
      {doctorModeOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="medic-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setDoctorModeOpen(false)}
          />

          {/* Panel */}
          <motion.div
            key="medic-panel"
            initial={{ x: -420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -420, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed top-0 bottom-0 left-16 z-50 w-[420px] bg-surface/95 backdrop-blur-2xl border-r border-border flex flex-col shadow-[4px_0_24px_-4px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <Stethoscope className="w-5 h-5 text-[#00FF41] drop-shadow-[0_0_8px_rgba(0,255,65,1)]" />
                <h2 className="text-sm font-semibold text-text-primary tracking-wide">
                  Medic
                </h2>
              </div>
              <button
                onClick={() => setDoctorModeOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
              {/* Autopilot Medic Toggle */}
              <div className="px-5 pb-3">
                <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <Activity className={cn("w-5 h-5 transition-colors", autopilotOn ? "text-[#00FF41]" : "text-text-muted")} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Autopilot Medic</span>
                      <span className="text-xs text-text-muted">Auto-resolve issues</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setAutopilotOn(!autopilotOn)}
                    className={cn("w-10 h-5 rounded-full transition-colors relative flex items-center shrink-0", autopilotOn ? "bg-[#00FF41]/30" : "bg-black")}
                  >
                    <motion.div
                      animate={{ x: autopilotOn ? 20 : 2 }}
                      className={cn("w-4 h-4 rounded-full absolute shadow-sm", autopilotOn ? "bg-[#00FF41] shadow-glow" : "bg-text-muted")}
                    />
                  </button>
                </div>
              </div>

              {/* Manual Action Buttons */}
              <div className="px-5 pb-3 flex flex-col gap-2">
                <button
                  onClick={() => executeDiagnosis('Diagnose Fleet Issues')}
                  disabled={working}
                  className="flex items-center gap-3 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm border border-white/5 transition-all w-full text-left font-medium group disabled:opacity-50"
                >
                  <ScanLine className="w-4 h-4 text-text-muted group-hover:text-aurora-teal transition-colors" />
                  Diagnose Fleet
                </button>

                <button
                  onClick={() => executeDiagnosis('Restart Stalled Tasks')}
                  disabled={working}
                  className="flex items-center gap-3 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm border border-white/5 transition-all w-full text-left font-medium group disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4 text-text-muted group-hover:text-aurora-amber transition-colors" />
                  Restart Stalled Tasks
                </button>
              </div>

              {/* Active Logic Loops */}
              <div className="px-5 pb-4 flex flex-col gap-2">
                <span className="text-xs font-mono text-text-muted uppercase tracking-wider mb-1">Active Logic Loops</span>
                {logicLoops.length === 0 ? (
                  <div className="text-xs text-text-muted italic px-2">No stranded agents detected.</div>
                ) : (
                  logicLoops.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => purgeTargetAgent(agent)}
                      disabled={working}
                      className="flex items-center justify-between px-3 py-2 bg-aurora-rose/5 hover:bg-aurora-rose/10 border border-aurora-rose/10 rounded-lg text-xs transition-colors group disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2 text-aurora-rose">
                        <AlertTriangle className="w-3 h-3" />
                        {agent.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted text-[10px]">{agent.time}</span>
                        <History className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-border mx-5" />

              {/* Patient Files Section */}
              <div className="px-5 pt-4 pb-2 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-text-primary font-mono">
                      <Terminal className="w-4 h-4 text-[#00FF41]" />
                      Patient Files
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {working && <span className="text-aurora-teal text-[10px] font-mono uppercase animate-pulse">Running...</span>}
                    <button
                      onClick={() => setIsPaused(!isPaused)}
                      className={cn("p-1.5 rounded-md hover:bg-white/10 transition-colors", isPaused ? "bg-white/10 text-aurora-amber" : "text-text-muted")}
                      title={isPaused ? "Resume Feed" : "Pause Feed"}
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    </button>
                    <button className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-white/10 transition-colors" title="Export Diagnosis">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-black/40 rounded-md p-1 border border-border">
                  {['all', 'critical', 'autopilot'].map(filter => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={cn(
                        "flex-1 px-2.5 py-1 text-[11px] font-mono uppercase rounded-md transition-colors",
                        activeFilter === filter ? "bg-white/[0.08] text-text-primary" : "text-text-muted hover:text-text-primary hover:bg-white/[0.04]"
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Log Feed Area */}
              <div className="px-5 pb-5 flex-1 min-h-0">
                <div className="bg-black/60 rounded-xl border border-border p-4 font-mono text-xs overflow-y-auto no-scrollbar h-[320px] relative">
                  <AnimatePresence>
                    {filteredLogs.length === 0 ? (
                      <div className="text-text-muted italic">No logs match filter criteria.</div>
                    ) : (
                      filteredLogs.map((log, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 }}
                          className={cn(
                            "mb-2 leading-relaxed tracking-wide",
                            log.type === 'success' ? "text-[#00FF41]" :
                            log.type === 'autopilot' ? "text-[#00FF41]/80" :
                            log.type === 'critical' ? "text-aurora-rose" :
                            log.type === 'action' ? "text-aurora-teal" : "text-text-muted"
                          )}
                        >
                          {log.text}
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                  <div ref={logsEndRef} />

                  {working && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="mt-3 text-aurora-teal flex items-center gap-2 pb-4"
                    >
                      <div className="w-2 h-4 bg-aurora-teal animate-pulse" />
                      <span className="tracking-widest">Administering override...</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
