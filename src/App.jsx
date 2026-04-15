// Initialize theme from localStorage
const savedTheme = localStorage.getItem("jarvis-theme");
if (savedTheme) {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { Sidebar } from "./components/Sidebar.jsx";
import { StatusStrip } from "./components/StatusStrip.jsx";
import { MorningBrief } from "./components/MorningBrief.jsx";
import { HomeStatusBoard } from "./components/HomeStatusBoard.jsx";
import { RightRail } from "./components/RightRail.jsx";
import { Composer } from "./components/Composer.jsx";
import { ConversationThread } from "./components/ConversationThread.jsx";
import { JarvisHalo } from "./components/JarvisHalo.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { Loader2 } from "lucide-react";
import Onboarding from "./views/Onboarding.jsx";
import Login from "./views/Login.jsx";
import { VaultLockedOverlay } from "./components/VaultLockedOverlay.jsx";

const JarvisView = lazy(() => import("./views/JarvisView.jsx"));
const Settings   = lazy(() => import("./views/Settings.jsx"));
const Today      = lazy(() => import("./views/Today.jsx"));
const Brain      = lazy(() => import("./views/Brain.jsx"));
const Work       = lazy(() => import("./views/Work.jsx"));
const Money      = lazy(() => import("./views/Money.jsx"));
const HomeLife   = lazy(() => import("./views/HomeLife.jsx"));
const Health     = lazy(() => import("./views/Health.jsx"));
const Skills     = lazy(() => import("./views/Skills.jsx"));
import { VoiceButton } from "./components/VoiceButton.jsx";
import { CommandPalette } from "./components/CommandPalette.jsx";
import { NotificationCenter } from "./components/NotificationCenter.jsx";
import { QuickCapture } from "./components/QuickCapture.jsx";
import { useNotifications } from "./hooks/useNotifications.js";
import { useKeyboardNav } from "./hooks/useKeyboardNav.js";
import { useJarvisBrief, useOnboarding, useCostToday } from "./hooks/useJarvis.js";
import { useAuth } from "./hooks/useAuth.js";
import { jarvis } from "./lib/jarvis.js";

export default function App() {
  const [active, setActive] = useState("home");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [localMode, setLocalMode] = useState(() => localStorage.getItem("jarvis_local_mode") === "true");
  const auth = useAuth();
  useNotifications();
  useKeyboardNav(setActive);
  const { brief, rail, recentRuns, error, loading, decide, regenerateBrief } = useJarvisBrief();
  const { status: onboardingStatus, loading: onboardingLoading, refresh: refreshOnboarding } = useOnboarding();
  const { cost } = useCostToday();

  useEffect(() => {
    jarvis.health().then(setHealth).catch(() => setHealth(null));
  }, [onboardingStatus?.complete]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
      if (e.key === "Escape") setCmdOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auth gate — show login unless authenticated or in local mode
  if (auth.loading) {
    return (
      <div className="h-full w-full grid place-items-center">
        <JarvisHalo size={64} />
      </div>
    );
  }

  if (!auth.authenticated && !localMode) {
    return (
      <Login
        onAuth={{
          ...auth,
          skipAuth: () => {
            setLocalMode(true);
            localStorage.setItem("jarvis_local_mode", "true");
          },
        }}
      />
    );
  }

  const refreshHealth = async () => {
    const h = await jarvis.health().catch(() => null);
    setHealth(h);
  };

  // Wait for onboarding status before deciding which shell to render.
  if (onboardingLoading) {
    return (
      <div className="h-full w-full grid place-items-center text-jarvis-body text-sm">
        <div className="flex items-center gap-3">
          <JarvisHalo size={48} />
          <div>Calibrating JARVIS…</div>
        </div>
      </div>
    );
  }

  if (onboardingStatus && !onboardingStatus.complete) {
    return (
      <>
        <Onboarding onComplete={refreshOnboarding} />
        {health?.vaultLocked && <VaultLockedOverlay onUnlocked={refreshHealth} />}
      </>
    );
  }

  return (
    <div className="h-full w-full flex text-jarvis-ink">
      <Sidebar active={active} onSelect={setActive} />

      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 left-1/3 w-[500px] h-[500px] rounded-full bg-jarvis-primary/[0.04] blur-[150px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-jarvis-purple/[0.03] blur-[120px]" />
        </div>

        <header className="relative flex items-center justify-between gap-4 px-6 py-3 border-b border-jarvis-border">
          <h1 className="font-display text-[18px] font-semibold tracking-[0.02em] text-jarvis-ink">
            {active === "home" ? "Home" : active === "today" ? "Today" : active === "work" ? "Work" : active === "money" ? "Money" : active === "life" ? "Home Life" : active === "health" ? "Health" : active === "brain" ? "Brain" : active === "skills" ? "Skills" : active === "settings" ? "Settings" : ""}
          </h1>
          <div className="flex items-center gap-3">
            <VoiceButton />
            <NotificationCenter />
            <StatusStrip vaultLocked={health?.vaultLocked ?? true} cost={cost} />
          </div>
        </header>

        <ErrorBoundary>
          <Suspense fallback={<div className="h-full grid place-items-center"><Loader2 className="animate-spin text-jarvis-primary" size={24} /></div>}>
            {active === "settings" ? (
              <div className="relative flex flex-1 min-h-0">
                <Settings key={health?.vaultLocked ? "locked" : "unlocked"} />
              </div>
            ) : active === "home" ? (
              <div className="relative flex flex-1 min-h-0">
                <JarvisView />
              </div>
            ) : (
              <div className="relative flex flex-1 min-h-0">
                <section className="flex-1 min-w-0 overflow-y-auto">
                  {active === "today"  && <Today />}
                  {active === "brain"  && <Brain />}
                  {active === "work"   && <Work />}
                  {active === "money"  && <Money />}
                  {active === "life"   && <HomeLife />}
                  {active === "health" && <Health />}
                  {active === "skills" && <Skills />}
                </section>

                <aside className="p-6 border-l border-jarvis-border overflow-y-auto bg-jarvis-surface/20">
                  <RightRail rail={rail} recentRuns={recentRuns} onDecide={decide} />
                </aside>
              </div>
            )}
          </Suspense>
        </ErrorBoundary>
      </main>

      {health?.vaultLocked && <VaultLockedOverlay onUnlocked={refreshHealth} />}

      <QuickCapture />

      {cmdOpen && (
        <CommandPalette
          onClose={() => setCmdOpen(false)}
          onNavigate={(page) => { setActive(page); setCmdOpen(false); }}
        />
      )}
    </div>
  );
}
