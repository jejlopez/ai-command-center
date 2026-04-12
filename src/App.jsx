import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar.jsx";
import { StatusStrip } from "./components/StatusStrip.jsx";
import { SegmentedControl } from "./components/SegmentedControl.jsx";
import { MorningBrief } from "./components/MorningBrief.jsx";
import { RightRail } from "./components/RightRail.jsx";
import { Composer } from "./components/Composer.jsx";
import { ConversationThread } from "./components/ConversationThread.jsx";
import { JarvisHalo } from "./components/JarvisHalo.jsx";
import Onboarding from "./views/Onboarding.jsx";
import Login from "./views/Login.jsx";
import Settings from "./views/Settings.jsx";
import Today from "./views/Today.jsx";
import Brain from "./views/Brain.jsx";
import Work from "./views/Work.jsx";
import Money from "./views/Money.jsx";
import HomeLife from "./views/HomeLife.jsx";
import Health from "./views/Health.jsx";
import Skills from "./views/Skills.jsx";
import { VaultLockedOverlay } from "./components/VaultLockedOverlay.jsx";
import { RefreshCcw, Loader2 } from "lucide-react";
import { useJarvisBrief, useOnboarding, useCostToday } from "./hooks/useJarvis.js";
import { useAuth } from "./hooks/useAuth.js";
import { jarvis } from "./lib/jarvis.js";

export default function App() {
  const [active, setActive] = useState("home");
  const [mode, setMode] = useState("brief");
  const [health, setHealth] = useState(null);
  const [localMode, setLocalMode] = useState(() => localStorage.getItem("jarvis_local_mode") === "true");
  const auth = useAuth();
  const { brief, rail, recentRuns, error, loading, decide, regenerateBrief } = useJarvisBrief();
  const { status: onboardingStatus, loading: onboardingLoading, refresh: refreshOnboarding } = useOnboarding();
  const { cost } = useCostToday();

  useEffect(() => {
    jarvis.health().then(setHealth).catch(() => setHealth(null));
  }, [onboardingStatus?.complete]);

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
          <div className="absolute -top-20 left-1/3 w-[500px] h-[500px] rounded-full bg-jarvis-cyan/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-jarvis-blue/10 blur-[120px]" />
        </div>

        <header className="relative flex items-center justify-between gap-4 px-6 py-4 border-b border-jarvis-border">
          <div className="flex items-center gap-3">
            <JarvisHalo size={36} />
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-jarvis-cyan font-semibold">
                J.A.R.V.I.S
              </div>
              <div className="text-[10px] text-jarvis-muted">Operating System</div>
            </div>
          </div>
          {active === "home" && (
            <div className="flex items-center gap-3">
              <SegmentedControl
                value={mode}
                onChange={setMode}
                options={[
                  { value: "brief",  label: "Morning Brief" },
                  { value: "output", label: "Jarvis Output" },
                ]}
              />
              {mode === "brief" && (
                <button
                  type="button"
                  onClick={() => { regenerateBrief().catch(() => {}); }}
                  disabled={loading}
                  title="Regenerate brief"
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border",
                    loading
                      ? "bg-white/5 text-jarvis-muted border-jarvis-border cursor-not-allowed"
                      : "bg-jarvis-cyan/10 text-jarvis-cyan border-jarvis-cyan/30 hover:bg-jarvis-cyan/20 shadow-glow-cyan",
                  ].join(" ")}
                >
                  {loading
                    ? <Loader2 size={14} className="animate-spin" />
                    : <RefreshCcw size={14} />}
                  <span>Regenerate</span>
                </button>
              )}
            </div>
          )}
          <StatusStrip
            vaultLocked={health?.vaultLocked ?? true}
            uptimeSec={health?.uptimeSec ?? 0}
            cost={cost}
          />
        </header>

        {active === "settings" ? (
          <div className="relative flex flex-1 min-h-0">
            <Settings key={health?.vaultLocked ? "locked" : "unlocked"} />
          </div>
        ) : (
          <div className="relative flex flex-1 min-h-0">
            <section className="flex-1 min-w-0 overflow-y-auto">
              {active === "home" && (
                <>
                  <div className="px-6 py-5 space-y-5 pb-36">
                    {loading && (
                      <div className="glass p-6 text-jarvis-body text-sm">Connecting to jarvisd…</div>
                    )}
                    {error && (
                      <div className="rounded-2xl border border-jarvis-red/30 bg-jarvis-red/5 p-6">
                        <div className="text-jarvis-red text-sm font-semibold">Daemon unreachable</div>
                        <div className="text-jarvis-body text-xs mt-1">
                          Start it with <code className="text-jarvis-cyan">cd jarvisd && npm run dev</code>
                        </div>
                      </div>
                    )}
                    {!loading && !error && mode === "brief" && <MorningBrief brief={brief} />}
                    {!loading && !error && mode === "output" && (
                      <div className="glass p-6 text-jarvis-body text-sm">
                        No outputs yet. Ask JARVIS something to see them here.
                      </div>
                    )}

                    {!loading && !error && <ConversationThread />}
                  </div>

                  {/* Sticky composer */}
                  <div className="sticky bottom-0 left-0 right-0 px-6 pb-5 pt-3 bg-gradient-to-t from-[#05070d] via-[#05070d]/90 to-transparent">
                    <Composer onSend={(t) => console.log("ask:", t)} />
                  </div>
                </>
              )}

              {active === "today"  && <Today />}
              {active === "brain"  && <Brain />}
              {active === "work"   && <Work />}
              {active === "money"  && <Money />}
              {active === "life"   && <HomeLife />}
              {active === "health" && <Health />}
              {active === "skills" && <Skills />}
            </section>

            <aside className="p-6 border-l border-jarvis-border overflow-y-auto bg-jarvis-panel/20">
              <RightRail rail={rail} recentRuns={recentRuns} onDecide={decide} />
            </aside>
          </div>
        )}
      </main>

      {health?.vaultLocked && <VaultLockedOverlay onUnlocked={refreshHealth} />}
    </div>
  );
}
