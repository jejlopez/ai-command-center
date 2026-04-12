import { useCallback, useEffect, useState } from "react";
import { Cpu, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { StepLayout } from "./StepLayout.jsx";
import { jarvis } from "../../lib/jarvis.js";

export function LocalStep({ stepIndex, totalSteps, onNext, onBack }) {
  const [detect, setDetect] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [d, cfg] = await Promise.all([
        jarvis.detectLocalModels().catch(() => ({ up: false, models: [] })),
        jarvis.getConfig().catch(() => null),
      ]);
      setDetect(d);
      const allowed = new Set(cfg?.allowedLocalModels ?? d?.models ?? []);
      setSelected(allowed);
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const toggle = (model) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model);
      else next.add(model);
      return next;
    });
  };

  const saveAndNext = async () => {
    setBusy(true);
    setError(null);
    try {
      await jarvis.setConfig({ allowedLocalModels: Array.from(selected) });
      onNext();
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const up = detect?.up === true;
  const models = detect?.models ?? [];

  return (
    <StepLayout
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      title="Local intelligence"
      description="JARVIS can run sensitive queries entirely on-device via Ollama. This step is optional — skip it if you don't have local models installed."
      primaryLabel={models.length ? "Save & continue" : "Continue"}
      onPrimary={saveAndNext}
      primaryLoading={busy}
      secondaryLabel="Back"
      onSecondary={onBack}
      error={error}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={[
                "w-10 h-10 rounded-full grid place-items-center",
                up ? "bg-jarvis-green/15 shadow-glow-green" : "bg-white/5",
              ].join(" ")}>
                <Cpu size={18} className={up ? "text-jarvis-green" : "text-jarvis-muted"} />
              </div>
              <div>
                <div className="text-sm text-jarvis-ink font-semibold">Ollama</div>
                <div className="text-[11px] text-jarvis-muted flex items-center gap-1.5">
                  {up ? (
                    <><CheckCircle2 size={12} className="text-jarvis-green" /> Reachable on localhost</>
                  ) : (
                    <><XCircle size={12} className="text-jarvis-muted" /> Not detected</>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-jarvis-body hover:text-jarvis-ink flex items-center gap-1.5"
            >
              <RefreshCw size={12} /> Rescan
            </button>
          </div>

          {up && models.length > 0 && (
            <div className="mt-5">
              <div className="label mb-2">Allowed models</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {models.map((m) => {
                  const checked = selected.has(m);
                  return (
                    <label
                      key={m}
                      className={[
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2 cursor-pointer transition",
                        checked
                          ? "border-jarvis-cyan/40 bg-jarvis-cyan/5"
                          : "border-jarvis-border bg-white/[0.02] hover:bg-white/[0.04]",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(m)}
                        className="accent-jarvis-cyan"
                      />
                      <span className="text-xs font-mono text-jarvis-ink">{m}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {up && models.length === 0 && (
            <div className="mt-4 text-[11px] text-jarvis-muted">
              Ollama is up but no models are installed. Run{" "}
              <code className="text-jarvis-cyan">ollama pull llama3.1</code> and rescan.
            </div>
          )}
          {!up && (
            <div className="mt-4 text-[11px] text-jarvis-muted leading-relaxed">
              Ollama isn't running. Install from{" "}
              <span className="text-jarvis-cyan">ollama.ai</span> and start the daemon — or skip this step.
            </div>
          )}
        </div>
      </div>
    </StepLayout>
  );
}
