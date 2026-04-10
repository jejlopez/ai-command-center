import React, { useEffect, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence, animate, useMotionValue } from 'framer-motion';
import { LogOut, Clock, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';

/**
 * PixelRobot: The 'Living Agent' sentinel entity.
 * The presentation pad stays anchored while the robot itself moves.
 */
function PixelRobot() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((current) => (current + 1) % 2), 250);
    return () => clearInterval(timer);
  }, []);

  const spriteMap = [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    frame === 0 ? [0, 1, 0, 0, 0, 0, 1, 0] : [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 1, 1, 0, 0, 1, 1, 0]
  ];

  return (
    <div
      className="relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-[2rem] bg-panel shadow-xl"
      style={{ backdropFilter: 'blur(24px) saturate(180%)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--color-panel-strong) 94%, transparent), color-mix(in srgb, var(--color-panel-soft) 82%, transparent))',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[1px] rounded-[calc(2rem-1px)]"
        style={{
          border: '1px solid color-mix(in srgb, var(--color-panel-soft) 90%, transparent)',
        }}
      />

      <Motion.div
        animate={{
          y: [0, -18, 0],
          rotateX: [0, 8, -8, 0],
          rotateY: [0, 10, -10, 0],
          rotateZ: [-4, 4, -4],
          scale: [1, 1.04, 1]
        }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10 flex flex-col items-center justify-center perspective-1200"
      >
        <Motion.div
          animate={{
            filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1)'],
            opacity: [0.82, 1, 0.82]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="grid grid-cols-8 gap-[3.5px]"
        >
          {spriteMap.map((row, rowIndex) =>
            row.map((pixel, pixelIndex) => (
              <div
                key={`${rowIndex}-${pixelIndex}`}
                className={cn('h-[7px] w-[7px] transition-all duration-300', pixel === 1 ? 'bg-aurora-teal' : 'bg-transparent')}
                style={pixel === 1 ? { boxShadow: '0 0 12px color-mix(in srgb, var(--color-aurora-teal) 60%, transparent)' } : undefined}
              />
            ))
          )}
        </Motion.div>
      </Motion.div>

      <Motion.div
        animate={{ x: ['-65%', '65%'], opacity: [0, 0.45, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        className="pointer-events-none absolute inset-y-0 w-1/2"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-aurora-teal) 22%, transparent), transparent)',
        }}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 bottom-8 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-hairline-strong) 90%, transparent), transparent)',
        }}
      />
    </div>
  );
}

function SlideToSignOut({ onConfirm }) {
  const trackRef = useRef(null);
  const x = useMotionValue(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleWidth = 56;
  const inset = 6;

  useEffect(() => {
    const updateWidth = () => {
      if (!trackRef.current) return;
      setTrackWidth(trackRef.current.offsetWidth);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const maxSlide = Math.max(trackWidth - handleWidth - inset * 2, 0);

  const resetSlider = () => {
    animate(x, 0, { type: 'spring', stiffness: 420, damping: 34 });
  };

  const handleDragEnd = async () => {
    if (isSubmitting) return;

    if (x.get() >= maxSlide * 0.8) {
      setIsSubmitting(true);
      animate(x, maxSlide, { type: 'spring', stiffness: 420, damping: 34 });
      await onConfirm();
      return;
    }

    resetSlider();
  };

  return (
    <div
      ref={trackRef}
      className="relative h-[72px] overflow-hidden rounded-[1.75rem] shadow-xl"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--color-panel) 96%, transparent), color-mix(in srgb, var(--color-panel-soft) 84%, transparent))',
        backdropFilter: 'blur(20px) saturate(160%)',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[1px] rounded-[calc(1.75rem-1px)]"
        style={{
          border: '1px solid color-mix(in srgb, var(--color-panel-soft) 88%, transparent)',
        }}
      />
      <Motion.div
        className="pointer-events-none absolute inset-y-[6px] left-[6px] rounded-[1.35rem]"
        style={{
          width: handleWidth,
          x,
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--color-panel-strong) 92%, transparent), color-mix(in srgb, var(--color-panel-soft) 70%, transparent))',
          boxShadow: 'var(--shadow-main)',
        }}
      />

      <div className="relative flex h-full items-center justify-between gap-4 pl-[88px] pr-5">
        <div className="min-w-0 text-left">
          <span className="block text-[11px] font-black uppercase tracking-[0.34em] text-text">Sign Out</span>
          <span className="mt-1 block text-[10px] font-medium italic text-text-dim">Slide to close this session on this device.</span>
        </div>
        <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.28em] text-text-dim">
          {isSubmitting ? 'Signing Out' : 'Slide'}
        </span>
      </div>

      <Motion.button
        type="button"
        drag="x"
        dragConstraints={{ left: 0, right: maxSlide }}
        dragElastic={0.04}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={handleDragEnd}
        disabled={isSubmitting}
        className="absolute left-[6px] top-[6px] flex h-14 w-14 items-center justify-center rounded-[1.35rem] text-text transition-opacity disabled:cursor-default disabled:opacity-80"
        aria-label="Slide to sign out"
      >
        <div
          className="absolute inset-0 rounded-[1.35rem]"
          style={{
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--color-panel-strong) 96%, transparent), color-mix(in srgb, var(--color-panel-soft) 72%, transparent))',
            border: '1px solid color-mix(in srgb, var(--color-panel-soft) 82%, transparent)',
          }}
        />
        <LogOut className="relative z-10 h-5 w-5" />
      </Motion.button>
    </div>
  );
}

function DataRow({ label, value, icon: Icon }) {
  return (
    <div className="group flex items-center justify-between border-b border-hairline-soft py-4 last:border-0">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-3.5 w-3.5 text-text-dim transition-colors group-hover:text-aurora-teal" />}
        <span className="text-[10px] font-black uppercase tracking-[0.45em] text-text-dim">{label}</span>
      </div>
      <span className="text-[11px] font-mono font-bold tabular-nums text-text">{value}</span>
    </div>
  );
}

export function UserProfilePanel({ profileOpen, setProfileOpen }) {
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
            className="fixed inset-0 z-40 backdrop-blur-md"
            style={{ background: 'color-mix(in srgb, var(--color-canvas) 65%, transparent)' }}
          />

          <Motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-canvas shadow-xl"
            style={{ boxShadow: '-48px 0 100px color-mix(in srgb, var(--color-canvas) 72%, transparent)' }}
          >
            <div className="relative flex items-center justify-between px-6 py-8 sm:px-12 sm:py-12">
              <h2 className="text-[10px] font-black uppercase tracking-[0.7em] text-text-dim">User Registry</h2>
              <button
                onClick={() => setProfileOpen(false)}
                className="group p-2 text-text-dim transition-colors hover:text-text"
              >
                <X className="h-6 w-6 transition-transform duration-500 group-hover:rotate-90" />
              </button>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto px-6 py-8 no-scrollbar sm:space-y-12 sm:px-12 sm:py-10">
              <div className="space-y-8">
                <div className="space-y-3">
                  <h3 className="text-3xl font-black uppercase leading-none tracking-tight text-text">{userName}</h3>
                  <p className="text-[11px] font-mono font-bold lowercase leading-none tracking-widest text-text-dim">{user?.email}</p>
                </div>

                <PixelRobot />
              </div>

              <div
                className="rounded-[1.8rem] px-6 py-5 shadow-main sm:px-8 sm:py-6"
                style={{
                  background: 'color-mix(in srgb, var(--color-panel) 94%, transparent)',
                  backdropFilter: 'blur(18px) saturate(150%)',
                  border: '1px solid color-mix(in srgb, var(--color-panel-soft) 84%, transparent)',
                }}
              >
                <DataRow label="Session Link" value={formatDateTime(user?.last_sign_in_at)} icon={Clock} />
                <DataRow label="Registration" value={formatDateTime(user?.created_at)} icon={ShieldCheck} />
              </div>
            </div>

            <div className="shrink-0 space-y-6 bg-canvas-elevated px-6 py-6 sm:px-12 sm:py-8">
              <SlideToSignOut onConfirm={handleSignOut} />

              <button
                onClick={handleSignOutAll}
                className="group flex w-full items-center justify-center gap-3 py-2 text-text-dim transition-all hover:text-aurora-rose"
              >
                <ShieldCheck className="h-4 w-4 transition-transform group-hover:rotate-12" />
                <span className="text-[10px] font-black uppercase tracking-[0.45em]">Sign Out All Devices</span>
              </button>
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
