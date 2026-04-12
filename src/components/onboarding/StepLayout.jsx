import { JarvisHalo } from "../JarvisHalo.jsx";

export function StepLayout({
  stepIndex,
  totalSteps,
  title,
  description,
  children,
  primaryLabel = "Continue",
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel,
  onSecondary,
  footNote,
  error,
}) {
  return (
    <div className="min-h-full w-full grid place-items-center px-6 py-10">
      <div className="glass relative w-full max-w-5xl p-10 overflow-hidden">
        {/* Ambient cyan wash */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-[360px] h-[360px] rounded-full bg-jarvis-cyan/10 blur-[120px]" />
          <div className="absolute -bottom-24 -right-24 w-[360px] h-[360px] rounded-full bg-jarvis-blue/10 blur-[120px]" />
        </div>

        {/* Progress pips */}
        <div className="relative flex items-center justify-between mb-8">
          <div className="label">
            Step {stepIndex + 1} / {totalSteps}
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span
                key={i}
                className={[
                  "h-1.5 rounded-full transition-all",
                  i < stepIndex
                    ? "w-6 bg-jarvis-cyan/70"
                    : i === stepIndex
                    ? "w-10 bg-jarvis-cyan shadow-glow-cyan"
                    : "w-6 bg-white/10",
                ].join(" ")}
              />
            ))}
          </div>
        </div>

        <div className="relative grid grid-cols-[140px_1fr] gap-10 items-start">
          <div className="flex flex-col items-center gap-4 pt-2">
            <JarvisHalo size={120} />
            <div className="text-[10px] uppercase tracking-[0.22em] text-jarvis-cyan/80 font-semibold">
              J.A.R.V.I.S
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="font-display text-3xl text-jarvis-ink leading-tight">
              {title}
            </h2>
            {description && (
              <p className="mt-3 text-jarvis-body text-sm max-w-xl leading-relaxed">
                {description}
              </p>
            )}

            <div className="mt-8">{children}</div>

            {error && (
              <div className="mt-5 rounded-xl border border-jarvis-red/30 bg-jarvis-red/5 px-4 py-3 text-xs text-jarvis-red">
                {error}
              </div>
            )}

            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={onPrimary}
                disabled={primaryDisabled || primaryLoading}
                className={[
                  "px-5 py-2.5 rounded-xl text-sm font-semibold transition",
                  primaryDisabled || primaryLoading
                    ? "bg-white/5 text-jarvis-muted cursor-not-allowed"
                    : "bg-jarvis-cyan/15 text-jarvis-cyan hover:bg-jarvis-cyan/25 shadow-glow-cyan",
                ].join(" ")}
              >
                {primaryLoading ? "Working…" : primaryLabel}
              </button>

              {secondaryLabel && (
                <button
                  type="button"
                  onClick={onSecondary}
                  className="px-4 py-2.5 rounded-xl text-sm text-jarvis-body hover:text-jarvis-ink hover:bg-white/5 transition"
                >
                  {secondaryLabel}
                </button>
              )}

              {footNote && (
                <div className="ml-auto text-[11px] text-jarvis-muted">{footNote}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
