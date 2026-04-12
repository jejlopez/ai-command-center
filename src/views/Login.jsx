// JARVIS OS — Cinematic Login
// Reactor responds to keystrokes. Audio rises with activity.
// Remembers you. Time-aware. Keyboard-first. Zero friction.

import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { startHum, stopHum, setHumIntensity, playKeystroke, playFailure, playUnlock } from "../components/login/audio.js";
const JarvisReactor = lazy(() => import("../components/login/JarvisReactor.jsx"));
import Starfield from "../components/login/Starfield.jsx";
import FloatingDots from "../components/login/FloatingDots.jsx";
import HolographicHUD, { StatusTypewriter } from "../components/login/HolographicHUD.jsx";

function ReactorFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-20 h-20 rounded-full bg-jarvis-primary/8 animate-pulse" style={{
        boxShadow: "0 0 80px rgba(0,224,208,0.12)",
      }} />
    </div>
  );
}

// Letter-by-letter name reveal
function NameReveal({ name }) {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (!name) return;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setRevealed(i);
      if (i >= name.length) clearInterval(iv);
    }, 60);
    return () => clearInterval(iv);
  }, [name]);
  if (!name) return null;
  return (
    <span className="font-mono tracking-[0.15em]">
      {name.split("").map((c, i) => (
        <span key={i} className={`transition-all duration-200 ${i < revealed ? "text-jarvis-primary/80" : "text-transparent"}`}>{c}</span>
      ))}
    </span>
  );
}

export default function Login({ onAuth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const impulseRef = useRef(0);
  const emailRef = useRef(null);
  const formRef = useRef(null);

  // Remembered user
  const [rememberedName] = useState(() => localStorage.getItem("jarvis_user_name"));

  // Start ambient audio on first interaction
  const initAudio = useCallback(() => {
    if (audioStarted) return;
    setAudioStarted(true);
    startHum();
  }, [audioStarted]);

  // Stagger entrance
  useEffect(() => {
    const t = setTimeout(() => setShowForm(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Focus email on form appear
  useEffect(() => {
    if (showForm) setTimeout(() => emailRef.current?.focus(), 100);
  }, [showForm]);

  // Cleanup audio
  useEffect(() => () => stopHum(), []);

  // Keystroke handler — ripple the reactor + audio tick
  const handleKeystroke = useCallback(() => {
    initAudio();
    playKeystroke();
    impulseRef.current = 1;
    // Decay impulse
    const decay = () => {
      impulseRef.current *= 0.85;
      if (impulseRef.current > 0.01) requestAnimationFrame(decay);
      else impulseRef.current = 0;
    };
    requestAnimationFrame(decay);

    // Hum intensity based on input length
    const len = email.length + password.length;
    setHumIntensity(Math.min(len / 30, 1));
  }, [email.length, password.length, initAudio]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    initAudio();
    setPhase("authenticating");
    setHumIntensity(0.8);
    setError(null);
    try {
      const result = await onAuth.signInWithEmail(email, password || undefined);
      if (result.authenticated) {
        playUnlock();
        setHumIntensity(1);
        setPhase("success");

        // Remember user name
        const name = email.split("@")[0];
        localStorage.setItem("jarvis_user_name", name);

        setTimeout(() => {
          setPhase("unlocking");
          stopHum();
        }, 1200);
      } else if (result.sent) {
        setPhase("idle");
        setHumIntensity(0.2);
        setError("Magic link sent — check your email");
      }
    } catch (err) {
      playFailure();
      setHumIntensity(0);
      setError(err.message);
      setPhase("error");
      setTimeout(() => setPhase("idle"), 2500);
    }
  };

  const handleGoogle = async () => {
    initAudio();
    setPhase("authenticating");
    setHumIntensity(0.8);
    setError(null);
    try {
      await onAuth.signInWithGoogle();
    } catch (err) {
      playFailure();
      setError(err.message);
      setPhase("error");
      setTimeout(() => setPhase("idle"), 2500);
    }
  };

  const handleSkip = () => {
    initAudio();
    playUnlock();
    setPhase("success");
    setTimeout(() => {
      setPhase("unlocking");
      stopHum();
      setTimeout(() => onAuth.skipAuth?.(), 600);
    }, 1000);
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none flex flex-col"
      style={{ background: "#000000" }}
      onClick={initAudio}
    >
      {/* Deep space starfield — fills entire screen */}
      <Starfield />

      {/* Floating cyan dots drifting across the whole page */}
      <FloatingDots />

      {/* HUD */}
      <HolographicHUD />

      {/* Clean — no scan lines, no glitch */}

      {/* ===== CENTER: Reactor + Title stacked vertically ===== */}
      <div className="relative flex-1 min-h-0 z-[1] flex flex-col items-center justify-center">

        {/* Title — directly above the orb */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="relative z-10 text-center mb-2"
        >
          <h1 className="font-display text-[2rem] font-bold tracking-[0.14em] text-white/90">
            J.A.R.V.I.S
          </h1>
        </motion.div>

        {/* Reactor orb */}
        <div className="relative w-full" style={{ height: "clamp(200px, 40vh, 380px)" }}>
          <Suspense fallback={<ReactorFallback />}>
            <JarvisReactor state={phase} impulse={impulseRef} />
          </Suspense>
        </div>

        {/* Greeting + status + LOGIN FORM — all directly below the orb */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="relative z-10 text-center mt-2 space-y-2"
        >
          {rememberedName ? (
            <div className="text-[12px] tracking-[0.2em] text-white/30">
              Welcome back, <NameReveal name={rememberedName} />
            </div>
          ) : (
            <div className="text-[11px] tracking-[0.35em] uppercase text-jarvis-primary/25">
              Personal Operating System
            </div>
          )}
          <StatusTypewriter />
        </motion.div>

        {/* Login form — right here, under greeting */}
        <div className="relative z-10 mt-4 flex flex-col items-center w-full">
        <AnimatePresence mode="wait">
          {phase === "unlocking" ? (
            <motion.div
              key="unlock"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0, scale: 0.9, y: -15 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-2"
            >
              <span className="font-mono text-[12px] tracking-[0.35em] text-jarvis-primary/70">SYSTEMS ONLINE</span>
            </motion.div>
          ) : showForm ? (
            <motion.div
              key="form"
              ref={formRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[360px] px-5"
            >
              <div
                className="rounded-2xl p-5 space-y-3.5"
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  backdropFilter: "blur(20px)",
                  boxShadow: "0 0 60px rgba(0,0,0,0.3)",
                }}
              >
                {/* Google */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGoogle}
                  disabled={phase === "authenticating"}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] transition-all duration-200 text-white/60 text-[12px] font-medium"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </motion.button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/[0.03]" />
                  <div className="w-1 h-1 rounded-full bg-white/[0.06]" />
                  <div className="flex-1 h-px bg-white/[0.03]" />
                </div>

                {/* Email + Password */}
                <form onSubmit={handleSubmit} className="space-y-2">
                  <div className="relative group">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/12 group-focus-within:text-jarvis-primary/40 transition-colors" />
                    <input
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); handleKeystroke(); }}
                      placeholder="Email"
                      className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-white/[0.015] border border-white/[0.04] focus:border-jarvis-primary/20 focus:outline-none text-[12px] text-white/75 placeholder:text-white/10 transition-all"
                      autoComplete="email"
                      tabIndex={1}
                    />
                  </div>
                  <div className="relative group">
                    <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/12 group-focus-within:text-jarvis-primary/40 transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); handleKeystroke(); }}
                      placeholder="Password"
                      className="w-full pl-8 pr-8 py-2.5 rounded-lg bg-white/[0.015] border border-white/[0.04] focus:border-jarvis-primary/20 focus:outline-none text-[12px] text-white/75 placeholder:text-white/10 transition-all"
                      autoComplete="current-password"
                      tabIndex={2}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/10 hover:text-jarvis-primary/30 transition"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={!email.trim() || phase === "authenticating"}
                    whileTap={{ scale: 0.995 }}
                    tabIndex={3}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-semibold tracking-[0.12em] transition-all disabled:opacity-10 disabled:cursor-not-allowed"
                    style={{
                      background: phase === "success"
                        ? "linear-gradient(135deg, rgba(74,222,128,0.15), rgba(47,212,194,0.1))"
                        : "linear-gradient(135deg, rgba(0,224,208,0.08), rgba(47,212,194,0.05))",
                      border: `1px solid ${phase === "success" ? "rgba(74,222,128,0.2)" : "rgba(0,224,208,0.1)"}`,
                      color: phase === "success" ? "rgba(74,222,128,0.85)" : "rgba(0,224,208,0.75)",
                    }}
                  >
                    {phase === "authenticating" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : phase === "success" ? (
                      "ACCESS GRANTED"
                    ) : (
                      <>AUTHENTICATE <ArrowRight size={13} /></>
                    )}
                  </motion.button>
                </form>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`text-[10px] rounded-lg px-3 py-2 border overflow-hidden ${
                        error.includes("Magic link")
                          ? "text-jarvis-green/60 bg-jarvis-green/5 border-jarvis-green/8"
                          : "text-jarvis-red/60 bg-jarvis-red/5 border-jarvis-red/8"
                      }`}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Local mode — Escape key hint */}
              <div className="mt-2 flex items-center justify-center gap-3">
                <button
                  onClick={handleSkip}
                  tabIndex={4}
                  className="text-[9px] text-white/8 hover:text-white/20 transition tracking-[0.12em]"
                >
                  LOCAL MODE
                </button>
                <span className="text-white/5 text-[8px]">ESC</span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
}
