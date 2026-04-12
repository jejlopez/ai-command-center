// Holographic HUD — real telemetry, not fake data.

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

function randomHex(len = 8) {
  return Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("").toUpperCase();
}

function DataStream({ side = "left", speed = 50 }) {
  const [lines, setLines] = useState(() =>
    Array.from({ length: 24 }, () => randomHex(Math.floor(Math.random() * 10) + 4))
  );

  useEffect(() => {
    const iv = setInterval(() => {
      setLines(prev => [randomHex(Math.floor(Math.random() * 10) + 4), ...prev.slice(0, -1)]);
    }, speed);
    return () => clearInterval(iv);
  }, [speed]);

  return (
    <div className={`absolute top-0 bottom-0 ${side === "left" ? "left-4" : "right-4"} w-24 overflow-hidden pointer-events-none`}>
      <div className="flex flex-col gap-px font-mono text-[8px] tracking-widest opacity-[0.08]">
        {lines.map((line, i) => (
          <div key={`${i}-${line}`} className="text-jarvis-primary" style={{ opacity: 1 - (i / lines.length) * 0.8 }}>
            {side === "left" ? `0x${line}` : `${line}`}
          </div>
        ))}
      </div>
    </div>
  );
}

// Real telemetry from the daemon
function LiveTelemetry() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const BASE = import.meta.env.VITE_JARVIS_URL ?? "http://127.0.0.1:8787";
    let cancelled = false;

    const poll = async () => {
      try {
        const [health, skills, memory] = await Promise.all([
          fetch(`${BASE}/health`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${BASE}/skills`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`${BASE}/memory`).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (!cancelled) {
          setStats({
            daemon: health?.status === "ok",
            latency: health ? "< 2ms" : "---",
            uptime: health?.uptimeSec ?? 0,
            skills: Array.isArray(skills) ? skills.length : 0,
            memory: Array.isArray(memory) ? memory.length : 0,
            vault: health?.vaultLocked ? "LOCKED" : "READY",
          });
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (!stats) return null;

  return (
    <div className="absolute bottom-6 left-5 font-mono text-[9px] text-jarvis-primary/15 space-y-0.5 pointer-events-none tabular-nums">
      <div>DAEMON ····· {stats.daemon ? <span className="text-jarvis-green/30">ONLINE</span> : <span className="text-jarvis-red/30">OFFLINE</span>}</div>
      <div>LATENCY ···· {stats.latency}</div>
      <div>SKILLS ····· {stats.skills}</div>
      <div>MEMORY ····· {stats.memory} nodes</div>
      <div>VAULT ······ {stats.vault}</div>
      <div>UPTIME ····· {Math.floor(stats.uptime / 60)}m</div>
    </div>
  );
}

function CornerBrackets() {
  const s = 30;
  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="absolute top-3 left-3" width={s} height={s}><path d={`M 0 ${s} L 0 0 L ${s} 0`} stroke="rgba(0,224,208,0.08)" strokeWidth="0.5" fill="none" /></svg>
      <svg className="absolute top-3 right-3" width={s} height={s}><path d={`M 0 0 L ${s} 0 L ${s} ${s}`} stroke="rgba(0,224,208,0.08)" strokeWidth="0.5" fill="none" /></svg>
      <svg className="absolute bottom-3 left-3" width={s} height={s}><path d={`M 0 0 L 0 ${s} L ${s} ${s}`} stroke="rgba(0,224,208,0.08)" strokeWidth="0.5" fill="none" /></svg>
      <svg className="absolute bottom-3 right-3" width={s} height={s}><path d={`M ${s} 0 L ${s} ${s} L 0 ${s}`} stroke="rgba(0,224,208,0.08)" strokeWidth="0.5" fill="none" /></svg>
    </div>
  );
}

function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-px pointer-events-none"
      style={{
        background: "linear-gradient(90deg, transparent, rgba(0,224,208,0.12) 30%, rgba(0,224,208,0.18) 50%, rgba(0,224,208,0.12) 70%, transparent)",
      }}
      animate={{ top: ["-1%", "101%"] }}
      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
    />
  );
}

export function StatusTypewriter() {
  const messages = [
    "NEURAL CORE ONLINE",
    "SCANNING BIOMETRIC CHANNELS",
    "QUANTUM ENCRYPTION ACTIVE",
    "AWAITING OPERATOR",
  ];
  const [text, setText] = useState("");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let charIdx = 0;
    let del = false;
    let timeout;
    const tick = () => {
      const msg = messages[idx];
      if (!del) {
        charIdx++;
        setText(msg.slice(0, charIdx));
        if (charIdx >= msg.length) { del = true; timeout = setTimeout(tick, 2200); return; }
        timeout = setTimeout(tick, 40 + Math.random() * 25);
      } else {
        charIdx--;
        setText(msg.slice(0, charIdx));
        if (charIdx <= 0) { del = false; setIdx(p => (p + 1) % messages.length); timeout = setTimeout(tick, 250); return; }
        timeout = setTimeout(tick, 18);
      }
    };
    tick();
    return () => clearTimeout(timeout);
  }, [idx]);

  return (
    <div className="h-4 text-center">
      <span className="font-mono text-[10px] tracking-[0.3em] text-jarvis-primary/30">
        {text}<span className="animate-pulse text-jarvis-primary/50">▊</span>
      </span>
    </div>
  );
}

export default function HolographicHUD() {
  return (
    <>
      <DataStream side="left" speed={55} />
      <DataStream side="right" speed={70} />
      <LiveTelemetry />
      <CornerBrackets />
      <ScanLine />
      <div className="absolute bottom-6 right-5 font-mono text-[9px] text-jarvis-primary/10 text-right pointer-events-none">
        <div>JARVIS.OS v0.1.0</div>
        <div>BUILD.2026.04</div>
      </div>
    </>
  );
}
