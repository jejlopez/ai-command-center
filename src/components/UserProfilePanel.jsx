import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, X, Mail, Lock, Eye, EyeOff, Copy, Activity, Download, LogOut, UserPlus, ChevronRight } from 'lucide-react';

function GithubIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
import { cn } from '../utils/cn';

/* ------------------------------------------------------------------ */
/*  Google icon (Lucide doesn't ship one)                              */
/* ------------------------------------------------------------------ */

function GoogleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock user data                                                     */
/* ------------------------------------------------------------------ */

const MOCK_USER = {
  name: 'J. Jarvis',
  email: 'jarvis@nexus.ai',
  initials: 'JJ',
  role: 'Commander',
  activeSince: 'Today, 2:15 PM',
  agentsDeployed: 7,
  tokenUsage: 142800,
  tokenLimit: 500000,
};

/* ------------------------------------------------------------------ */
/*  Logged-out form                                                    */
/* ------------------------------------------------------------------ */

function AuthForm({ onSignIn }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const inputClass =
    'bg-surface-input border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary outline-none focus:border-aurora-teal/50 transition-colors w-full placeholder:text-text-muted/50';

  const handleSubmit = (e) => {
    e.preventDefault();
    onSignIn();
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-6">
      {/* Welcome */}
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-aurora-teal/10 flex items-center justify-center mb-4">
          <User className="w-8 h-8 text-aurora-teal" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary">Welcome to Nexus</h3>
        <p className="text-sm text-text-muted mt-1.5 leading-relaxed">
          Sign in to sync your settings and manage your fleet.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {isSignUp && (
          <div className="relative">
            <UserPlus className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={cn(inputClass, 'pl-10')}
            />
          </div>
        )}

        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={cn(inputClass, 'pl-10')}
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(inputClass, 'pl-10 pr-10')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <button
          type="submit"
          className="w-full bg-aurora-teal text-canvas font-semibold rounded-lg py-2.5 text-sm hover:brightness-110 active:brightness-95 transition-all mt-1"
        >
          {isSignUp ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted">or continue with</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* OAuth buttons */}
      <div className="flex gap-3">
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-sm text-text-primary hover:bg-white/[0.04] transition-colors">
          <GithubIcon className="w-4 h-4" />
          GitHub
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border text-sm text-text-primary hover:bg-white/[0.04] transition-colors">
          <GoogleIcon className="w-4 h-4" />
          Google
        </button>
      </div>

      {/* Toggle sign in / sign up */}
      <p className="text-center text-sm text-text-muted mt-6">
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-aurora-teal hover:text-aurora-teal/80 font-medium transition-colors"
        >
          {isSignUp ? 'Sign In' : 'Sign Up'}
        </button>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Logged-in profile view                                             */
/* ------------------------------------------------------------------ */

function ProfileView({ onSignOut }) {
  const [copied, setCopied] = useState(false);
  const user = MOCK_USER;
  const usagePercent = Math.round((user.tokenUsage / user.tokenLimit) * 100);

  const handleCopyApiKey = () => {
    navigator.clipboard?.writeText('nxs_sk_mock_api_key_1234567890');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-6 flex flex-col">
      {/* User card */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-aurora-teal/10 flex items-center justify-center mb-3">
          <span className="text-xl font-bold text-aurora-teal">{user.initials}</span>
        </div>
        <h3 className="text-lg font-semibold text-text-primary">{user.name}</h3>
        <p className="text-sm text-text-muted mt-0.5">{user.email}</p>
        <span className="mt-2 px-3 py-1 text-xs font-medium rounded-full bg-aurora-teal/10 text-aurora-teal">
          {user.role}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Session section */}
      <div className="mt-5">
        <p className="text-xs uppercase tracking-wider text-text-muted mb-3">Session</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-body">Active since</span>
            <span className="text-sm text-text-primary font-medium">{user.activeSince}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-body">Agents deployed</span>
            <span className="text-sm text-text-primary font-medium">{user.agentsDeployed}</span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-text-body">Token usage</span>
              <span className="text-sm text-text-primary font-medium">
                {(user.tokenUsage / 1000).toFixed(1)}k / {(user.tokenLimit / 1000).toFixed(0)}k
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-aurora-teal"
                initial={{ width: 0 }}
                animate={{ width: `${usagePercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions section */}
      <div className="mt-6">
        <p className="text-xs uppercase tracking-wider text-text-muted mb-3">Quick Actions</p>
        <div className="flex flex-col gap-1">
          <button
            onClick={handleCopyApiKey}
            className="flex items-center justify-between py-2.5 px-3 -mx-3 rounded-lg text-sm text-text-body hover:text-text-primary hover:bg-white/[0.04] transition-colors group"
          >
            <span className="flex items-center gap-2.5">
              <Copy className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
              {copied ? 'Copied!' : 'Copy API Key'}
            </span>
            <ChevronRight className="w-4 h-4 text-text-disabled group-hover:text-text-muted transition-colors" />
          </button>
          <button className="flex items-center justify-between py-2.5 px-3 -mx-3 rounded-lg text-sm text-text-body hover:text-text-primary hover:bg-white/[0.04] transition-colors group">
            <span className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
              View Activity Log
            </span>
            <ChevronRight className="w-4 h-4 text-text-disabled group-hover:text-text-muted transition-colors" />
          </button>
          <button className="flex items-center justify-between py-2.5 px-3 -mx-3 rounded-lg text-sm text-text-body hover:text-text-primary hover:bg-white/[0.04] transition-colors group">
            <span className="flex items-center gap-2.5">
              <Download className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
              Export Session Data
            </span>
            <ChevronRight className="w-4 h-4 text-text-disabled group-hover:text-text-muted transition-colors" />
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <div className="mt-auto pt-6">
        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-aurora-rose/20 text-aurora-rose text-sm font-medium hover:bg-aurora-rose/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                         */
/* ------------------------------------------------------------------ */

export function UserProfilePanel({ profileOpen, setProfileOpen }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <AnimatePresence>
      {profileOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="profile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setProfileOpen(false)}
          />

          {/* Panel */}
          <motion.div
            key="profile-panel"
            initial={{ x: 380, opacity: 0, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 380, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 32, stiffness: 200, mass: 0.8 }}
            className="fixed top-0 bottom-0 right-0 z-50 w-[360px] bg-surface/95 backdrop-blur-2xl border-l border-border flex flex-col shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <User className="w-5 h-5 text-aurora-teal" />
                <h2 className="text-sm font-semibold text-text-primary tracking-wide">
                  {isLoggedIn ? 'Profile' : 'Sign In'}
                </h2>
              </div>
              <button
                onClick={() => setProfileOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-border mx-5" />

            {/* Content */}
            {isLoggedIn ? (
              <ProfileView onSignOut={() => setIsLoggedIn(false)} />
            ) : (
              <AuthForm onSignIn={() => setIsLoggedIn(true)} />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default UserProfilePanel;
