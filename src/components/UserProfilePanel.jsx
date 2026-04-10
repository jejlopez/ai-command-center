import React from 'react';
import { motion as Motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import {
  Clock,
  LogOut,
  Shield,
  User as UserIcon,
  X,
  ShieldCheck,
  ChevronRight,
  Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function formatDateTime(value) {
  if (!value) return 'N/A';
  try {
    const date = new Date(value);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return 'N/A';
  }
}

// Living Pixel Robot (The Sentinel - Strategic Droid Edition)
function PixelRobot() {
  const [frame, setFrame] = React.useState(0);
  
  // 10x8 Robot Sentinel Sprite (Industrial Silhouette)
  const sprite = [
    [0,0,1,1,1,1,0,0], // Head Top
    [0,1,1,1,1,1,1,0], 
    [0,1,0,0,0,0,1,0], // Visor Gap
    [0,1,1,1,1,1,1,0], // Head Base
    [0,0,0,1,1,0,0,0], // Neck
    [1,1,1,1,1,1,1,1], // Shoulders/Arm
    [1,1,1,1,1,1,1,1], // Torso
    [0,1,1,1,1,1,1,0], // Hips
    [0,1,1,0,0,1,1,0], // Tracks/Feet
    [0,1,1,0,0,1,1,0]  // Base
  ];

  React.useEffect(() => {
    const interval = setInterval(() => setFrame(f => (f + 1) % 4), 250);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-16 bg-black/80 rounded-xl border border-white/5 overflow-hidden flex items-center shadow-[inset_0_2px_10px_rgba(0,0,0,1)]">
      <Motion.div 
        animate={{ 
          left: ["5%", "88%", "5%"],
          rotateY: [0, 0, 180, 180, 0]
        }}
        transition={{ 
          duration: 12, 
          repeat: Infinity, 
          ease: "linear",
          rotateY: { duration: 0.1, times: [0, 0.49, 0.5, 0.99, 1] }
        }}
        className="absolute flex flex-col gap-[1.5px] z-20"
      >
        {sprite.map((row, ri) => (
          <div key={ri} className="flex gap-[1.5px]">
            {row.map((active, ci) => {
              const isVisor = ri === 2 && ci >= 2 && ci <= 5;
              const isAntenna = ri === 0 && (ci === 2 || ci === 5);
              const isCore = ri === 6 && (ci === 3 || ci === 4);
              
              const antennaPulse = frame % 2 === 0 && isAntenna;
              const corePulse = frame === 2 && isCore;
              
              let pixelColor = 'bg-transparent';
              let shadowStyle = '';
              
              if (active) {
                if (isVisor) {
                  pixelColor = 'bg-white';
                  shadowStyle = 'shadow-[0_0_8px_rgba(255,255,255,0.6)]';
                } else if (isCore && corePulse) {
                  pixelColor = 'bg-white';
                  shadowStyle = 'shadow-[0_0_10px_rgba(0,217,200,0.8)]';
                } else if (antennaPulse) {
                  pixelColor = 'bg-white';
                } else {
                  pixelColor = 'bg-aurora-teal';
                }
              }
              
              return (
                <div 
                  key={ci} 
                  className={`w-[5px] h-[5px] rounded-[0.5px] transition-all duration-200 ${pixelColor} ${shadowStyle}`} 
                />
              );
            })}
          </div>
        ))}
      </Motion.div>
      
      {/* Texture Grid */}
      <div className="absolute inset-0 grid grid-cols-[repeat(24,1fr)] opacity-[0.05] pointer-events-none">
         {[...Array(24)].map((_, i) => (
           <div key={i} className="border-r border-white/10 h-full" />
         ))}
      </div>

      {/* Background Scanning Pulse */}
      <Motion.div 
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-aurora-teal/[0.08] to-transparent pointer-events-none"
      />
    </div>
  );
}

function BentoBlock({ children, className = "" }) {
  const x = useSpring(0, { stiffness: 150, damping: 20 });
  const y = useSpring(0, { stiffness: 150, damping: 20 });
  
  const rotateX = useTransform(y, [-100, 100], [5, -5]);
  const rotateY = useTransform(x, [-100, 100], [-5, 5]);
  const glintX = useTransform(x, [-100, 100], ["-25%", "25%"]);
  const glintY = useTransform(y, [-100, 100], ["-25%", "25%"]);

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(e.clientX - (rect.left + rect.width / 2));
    y.set(e.clientY - (rect.top + rect.height / 2));
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <Motion.div 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, perspective: 1200 }}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-[32px] shadow-2xl p-7 ${className}`}
    >
      <Motion.div 
        style={{ translateX: glintX, translateY: glintY }}
        className="absolute inset-[-50%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,transparent_50%)] pointer-events-none blur-3xl z-10" 
      />
      <div className="relative z-20">{children}</div>
    </Motion.div>
  );
}

function DataRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0 group">
      <div className="flex items-center gap-4">
        <Icon className="h-4 w-4 text-aurora-teal/80 group-hover:text-aurora-teal transition-all group-hover:scale-110" />
        <span className="text-[10px] font-black uppercase tracking-[0.45em] text-white group-hover:text-white transition-all">{label}</span>
      </div>
      <div className="font-mono text-[11px] font-bold text-white group-hover:text-aurora-teal transition-colors">
        {value}
      </div>
    </div>
  );
}

export function UserProfilePanel({ profileOpen, setProfileOpen }) {
  const { user, signOut, signOutAll } = useAuth();
  const [dragProgress, setDragProgress] = React.useState(0);
  const constraintsRef = React.useRef(null);
  
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  async function handleSignOut() {
    await signOut();
    setProfileOpen(false);
  }

  async function handleSignOutAll() {
    await signOutAll();
    setProfileOpen(false);
  }

  return (
    <AnimatePresence>
      {profileOpen && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProfileOpen(false)}
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-[10px]"
          />

          <Motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 35, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-[96vw] flex-col overflow-hidden bg-[#0A0A0A] backdrop-blur-[40px] border-l border-white/10 shadow-[-60px_0_120px_rgba(0,0,0,1)]"
          >
            {/* Header */}
            <div className="relative border-b border-white/[0.06] px-10 py-10 z-10 flex items-center justify-between font-mono">
              <h2 className="text-[10px] font-black tracking-[0.65em] text-white uppercase">User Registry</h2>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="group p-3.5 text-white/30 hover:text-white transition-all bg-white/[0.03] border border-white/[0.08] rounded-xl hover:bg-white/[0.1]"
              >
                <X className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" />
              </button>
            </div>

            <Motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="relative flex-1 overflow-y-auto px-10 py-14 no-scrollbar z-10 space-y-12"
            >
              <BentoBlock className="flex flex-col gap-10">
                <div className="text-left space-y-2">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-none">{userName}</h3>
                  <p className="text-[11px] font-mono font-bold text-white/30 lowercase tracking-widest">{user?.email}</p>
                </div>
                <PixelRobot />
              </BentoBlock>

              <BentoBlock>
                <div className="space-y-1">
                  <DataRow label="Session Link" value={formatDateTime(user?.last_sign_in_at)} icon={Clock} />
                  <DataRow label="Registration" value={formatDateTime(user?.created_at)} icon={ShieldCheck} />
                </div>
              </BentoBlock>
            </Motion.div>

            {/* Tactical Footer */}
            <div className="mt-auto px-10 pt-10 pb-16 bg-black/40 border-t border-white/[0.08] z-10 shadow-[0_-20px_80px_rgba(0,0,0,1)]">
              <div className="space-y-10">
                {/* Sign Out Button (Hybrid) */}
                <div 
                  ref={constraintsRef}
                  className="relative h-18 w-full rounded-2xl bg-[#050505] border border-white/[0.08] p-1.5 flex items-center cursor-pointer shadow-[inset_0_2px_15px_rgba(0,0,0,1)] group overflow-hidden"
                  onClick={handleSignOut}
                >
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[11px] font-black uppercase text-white tracking-[0.55em] group-hover:text-white transition-all group-hover:scale-105">
                      Sign Out
                    </span>
                  </div>

                  <Motion.div
                    drag="x"
                    dragConstraints={{ left: 0, right: 300 }}
                    dragElastic={0.1}
                    dragMomentum={false}
                    onDrag={(e, info) => setDragProgress(info.offset.x)}
                    onDragEnd={(e, info) => {
                      if (info.offset.x > 250) {
                        handleSignOut();
                      } else {
                        setDragProgress(0);
                      }
                    }}
                    animate={{ x: dragProgress }}
                    whileDrag={{ scale: 0.96 }}
                    className="relative z-20 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-white to-[#D0D0D0] shadow-[0_8px_24px_rgba(0,0,0,0.6)] border border-white/40 cursor-grab active:cursor-grabbing hover:shadow-white/20"
                  >
                    <LogOut className="h-6 w-6 text-black" />
                  </Motion.div>

                  <Motion.div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-aurora-rose/40 to-transparent z-10"
                    animate={{ width: dragProgress + 60 }}
                    transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                  />
                </div>

                <button
                  onClick={handleSignOutAll}
                  className="group relative flex w-full items-center justify-center gap-4 py-5 rounded-2xl border border-white/5 bg-white/[0.03] overflow-hidden transition-all hover:bg-white/[0.06] hover:border-white/10"
                >
                  <ShieldCheck className="h-4 w-4 text-white/40 group-hover:text-aurora-rose group-hover:scale-110 transition-all duration-300" />
                  <span className="text-[11px] font-black uppercase text-white/40 tracking-[0.45em] group-hover:text-white transition-colors">
                    Sign Out All Devices
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/20 group-hover:translate-x-1.5 transition-transform" />
                </button>
              </div>
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default UserProfilePanel;
