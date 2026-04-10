import React, { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  LogOut,
  Clock,
  ShieldCheck,
  ChevronRight,
  X,
  Settings,
  Bell,
  Briefcase,
  Sparkles,
  UserCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferenceContext';
import { cn } from '../utils/cn';

/**
 * PixelRobot: The 'Living Agent' sentinel entity.
 * Restored 1:1 from the Liquid Glass blueprint.
 */
function PixelRobot() {
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % 2), 250);
    return () => clearInterval(timer);
  }, []);

  const spriteMap = [
    [0,0,1,1,1,1,0,0], // Head Top
    [0,1,1,1,1,1,1,0],
    frame === 0 ? [0,1,0,0,0,0,1,0] : [0,1,1,1,1,1,1,0], // Visor Blink
    [0,1,1,1,1,1,1,0], // Head Base
    [0,0,0,1,1,0,0,0], // Neck
    [1,1,1,1,1,1,1,1], // Shoulders
    [1,1,1,1,1,1,1,1], // Torso
    [0,1,1,1,1,1,1,0], // Hips
    [0,1,1,0,0,1,1,0], // Tracks
    [0,1,1,0,0,1,1,0]  // Base
  ];

  return (
    <div className="flex flex-col items-center justify-center py-6 bg-black/40 rounded-3xl border border-white/5 shadow-inner">
      <div className="grid grid-cols-8 gap-[3px]">
        {spriteMap.map((row, transition) =>
          row.map((pixel, pi) => (
            <div
              key={`${transition}-${pi}`}
              className={cn(
                "h-[6px] w-[6px] transition-all duration-300",
                pixel === 1 ? "bg-aurora-teal shadow-[0_0_8px_rgba(0,217,200,0.4)]" : "bg-transparent"
              )}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DataRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/[0.04] last:border-0 group">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-3.5 w-3.5 text-white/20 group-hover:text-aurora-teal transition-colors" />}
        <span className="text-[10px] font-black uppercase tracking-[0.45em] text-white/30">{label}</span>
      </div>
      <span className="text-[11px] font-mono font-bold text-white/80 tabular-nums">{value}</span>
    </div>
  );
}

function CommandAction({ icon: Icon, label, detail, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col gap-2 rounded-2xl border border-white/5 bg-white/[0.02] p-5 text-left transition-all hover:bg-white/[0.05] hover:border-white/10"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.03] border border-white/5 group-hover:bg-aurora-teal/10 group-hover:border-aurora-teal/30 transition-all">
            {Icon && <Icon className="h-4 w-4 text-white/40 group-hover:text-aurora-teal transition-colors" />}
          </div>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50 group-hover:text-white transition-colors">
            {label}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 text-white/20 group-hover:translate-x-1.5 transition-transform" />
      </div>
      <p className="text-[10px] leading-relaxed text-white/20 font-medium group-hover:text-white/40 transition-colors">
        {detail}
      </p>
    </button>
  );
}

export function UserProfilePanel({ profileOpen, setProfileOpen, onAction }) {
  const { user, signOut, signOutAll } = useAuth();
  
  const handleSignOut = async () => {
    await signOut();
    setProfileOpen(false);
  };

  const handleSignOutAll = async () => {
    await signOutAll();
    setProfileOpen(false);
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const userName = user?.email?.split('@')[0].toUpperCase() || 'COMMANDER';

  return (
    <AnimatePresence>
      {profileOpen && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProfileOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md"
          />

          <Motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col bg-[#0A0A0A] border-l border-white/[0.08] shadow-[-40px_0_100px_rgba(0,0,0,0.8)]"
          >
            {/* Header / Brand */}
            <div className="relative px-12 py-12 flex items-center justify-between border-b border-white/[0.03]">
              <h2 className="text-[10px] font-black tracking-[0.7em] text-white/30 uppercase">User Registry</h2>
              <button
                onClick={() => setProfileOpen(false)}
                className="group p-2 text-white/20 hover:text-white transition-colors"
              >
                <X className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-12 py-10 no-scrollbar space-y-12">
              {/* Identity Card */}
              <div className="space-y-10">
                <div className="space-y-3">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tight leading-none">{userName}</h3>
                  <p className="text-[11px] font-mono font-bold text-white/30 lowercase tracking-widest leading-none">{user?.email}</p>
                </div>
                
                <PixelRobot />
              </div>

              {/* Data Registry */}
              <div className="bg-white/[0.01] border border-white/[0.04] rounded-3xl p-6 px-8">
                <DataRow label="Session Link" value={formatDateTime(user?.last_sign_in_at)} icon={Clock} />
                <DataRow label="Registration" value={formatDateTime(user?.created_at)} icon={ShieldCheck} />
              </div>

              {/* Navigation Grid */}
              <div className="space-y-6">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.45em] text-white/20">Command Access</h4>
                 <div className="space-y-3">
                    <CommandAction 
                      icon={Bell} 
                      label="Open Command Alerts"
                      detail="Failures, approvals, and system anomalies."
                      onClick={() => onAction({ type: 'panel', panel: 'notifications' })}
                    />
                    <CommandAction 
                      icon={Settings} 
                      label="Open Systems Control"
                      detail="Tune doctrine and configure integrations."
                      onClick={() => onAction({ type: 'panel', panel: 'settings' })}
                    />
                    <CommandAction 
                      icon={Briefcase} 
                      label="Executive Debrief"
                      detail="Review missions, cost, and operator focus."
                      onClick={() => onAction({ type: 'navigate', route: 'reports' })}
                    />
                    <CommandAction 
                      icon={Sparkles} 
                      label="Strategic Intelligence"
                      detail="Models, memory, and cognitive posture."
                      onClick={() => onAction({ type: 'navigate', route: 'intelligence' })}
                    />
                 </div>
              </div>
            </div>

            {/* Tactical Footer / Sign Out Bed */}
            <div className="p-10 px-12 bg-black/40 border-t border-white/[0.08] space-y-8">
              <button
                onClick={handleSignOut}
                className="group relative flex w-full items-center gap-10 p-2 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-white to-[#D0D0D0] shadow-xl">
                  <LogOut className="h-6 w-6 text-black" />
                </div>
                <div className="text-left">
                  <span className="block text-[11px] font-black uppercase text-white tracking-[0.3em] leading-none">Sign Out</span>
                  <span className="block mt-1 text-[10px] font-medium text-white/30 italic">Close session on this device.</span>
                </div>
              </button>

              <button
                onClick={handleSignOutAll}
                className="group flex w-full items-center justify-center gap-3 py-2 text-white/20 hover:text-aurora-rose transition-all"
              >
                <ShieldCheck className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-[0.45em]">Sign Out All Devices</span>
              </button>
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
