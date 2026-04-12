import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabaseConfigError } from '../lib/supabaseClient';
import { cn } from '../utils/cn';

export function LoginView() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const data = await signUp(email, password);
        // If email confirmation is enabled, user won't be auto-logged-in
        if (data?.user && !data.session) {
          setSuccess('Account created. Check your email to confirm, then sign in.');
          setMode('signin');
        }
        // If email confirmation is disabled, onAuthStateChange handles login automatically
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      const defaultMessage = `${mode === 'signup' ? 'Sign up' : 'Sign in'} failed`;
      const message = err?.message || defaultMessage;

      if (message === 'Failed to fetch') {
        setError(
          supabaseConfigError ||
          'Unable to reach Supabase. Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values, then restart the dev server.'
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode(m => m === 'signin' ? 'signup' : 'signin');
    setError(null);
    setSuccess(null);
  }

  const isSignUp = mode === 'signup';

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center relative overflow-hidden">
      {/* Aurora background */}
      <div className="aurora-drift absolute inset-0 pointer-events-none" />
      <div className="noise-overlay absolute inset-0 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:140px_140px]" />
      <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,217,200,0.10),transparent_55%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-aurora-teal/10 border border-aurora-teal/20 mb-4">
            <Lock className="w-6 h-6 text-aurora-teal" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Jarvis</h1>
          <p className="text-sm text-text-muted mt-1">Agent Command Center</p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="ui-shell p-6 space-y-5">
          {/* Error Banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 p-3 bg-aurora-rose/5 border border-aurora-rose/20 rounded-lg"
            >
              <AlertCircle className="w-4 h-4 text-aurora-rose shrink-0 mt-0.5" />
              <p className="text-xs text-aurora-rose leading-relaxed">{error}</p>
            </motion.div>
          )}

          {!error && supabaseConfigError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 p-3 bg-aurora-amber/5 border border-aurora-amber/20 rounded-lg"
            >
              <AlertCircle className="w-4 h-4 text-aurora-amber shrink-0 mt-0.5" />
              <p className="text-xs text-aurora-amber leading-relaxed">{supabaseConfigError}</p>
            </motion.div>
          )}

          {/* Success Banner */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 p-3 bg-aurora-green/5 border border-aurora-green/20 rounded-lg"
            >
              <CheckCircle2 className="w-4 h-4 text-aurora-green shrink-0 mt-0.5" />
              <p className="text-xs text-aurora-green leading-relaxed">{success}</p>
            </motion.div>
          )}

          {/* Email */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-2 block">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-text-disabled absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full pl-10 pr-3 py-2.5 bg-panel-soft border border-hairline rounded-lg text-sm font-mono text-text-primary placeholder-text-disabled focus:border-aurora-teal/40 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-2 block">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-text-disabled absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isSignUp ? 'Min 6 characters' : 'Enter password'}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="w-full pl-10 pr-3 py-2.5 bg-panel-soft border border-hairline rounded-lg text-sm font-mono text-text-primary placeholder-text-disabled focus:border-aurora-teal/40 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-bold font-mono uppercase tracking-wider transition-all",
              loading
                ? "bg-aurora-teal/50 text-black/50 cursor-wait"
                : "ui-button-primary bg-aurora-teal text-black hover:bg-[#00ebd8] shadow-[0_0_20px_rgba(0,217,200,0.3)] hover:shadow-[0_0_30px_rgba(0,217,200,0.5)]"
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isSignUp ? 'Creating account...' : 'Authenticating...'}
              </span>
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </button>

          {/* Mode toggle */}
          <div className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-xs text-text-muted hover:text-aurora-teal transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] text-text-disabled mt-6 font-mono">
          Jarvis v4.0 &middot; Secured by Supabase
        </p>
      </motion.div>
    </div>
  );
}
