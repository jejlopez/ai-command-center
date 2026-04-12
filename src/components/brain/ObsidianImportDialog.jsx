import { useEffect, useState } from "react";
import { X, Loader2, FolderInput, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const KIND_OPTIONS = [
  { value: "person",  label: "Person"  },
  { value: "project", label: "Project" },
  { value: "task",    label: "Task"    },
  { value: "fact",    label: "Fact"    },
  { value: "event",   label: "Event"   },
  { value: "pref",    label: "Pref"    },
];

export default function ObsidianImportDialog({ open, onClose, onCompleted }) {
  const [path, setPath] = useState("");
  const [kind, setKind] = useState("fact");
  const [defaultTrust, setDefaultTrust] = useState(0.6);
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);
  const [ranLive, setRanLive] = useState(false);
  const [errorsOpen, setErrorsOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setPath("");
      setKind("fact");
      setDefaultTrust(0.6);
      setDryRun(true);
      setBusy(false);
      setErr(null);
      setResult(null);
      setRanLive(false);
      setErrorsOpen(false);
    }
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    if (busy) return;
    if (result && ranLive && typeof onCompleted === "function") {
      onCompleted();
    }
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!path.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await jarvis.importObsidian({
        path: path.trim(),
        kind,
        defaultTrust,
        dryRun,
      });
      setResult(res ?? { scanned: 0, imported: 0, skipped: 0, errors: [] });
      setRanLive(!dryRun);
    } catch (e) {
      setErr(e?.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-6">
      <div className="glass w-full max-w-lg p-6 relative">
        <button
          type="button"
          onClick={handleClose}
          disabled={busy}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-jarvis-muted hover:text-jarvis-ink hover:bg-white/5 disabled:opacity-40"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <FolderInput size={14} className="text-jarvis-cyan" />
          <div className="label text-jarvis-cyan">Import</div>
        </div>
        <h2 className="text-lg font-semibold text-jarvis-ink mb-5">Import Obsidian vault</h2>

        {!result ? (
          <form onSubmit={submit}>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-jarvis-muted font-semibold">
                  Vault path (absolute)
                </label>
                <input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/Users/you/Documents/Obsidian/Vault"
                  className="mt-1 w-full bg-jarvis-panel/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-cyan/50 outline-none font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-jarvis-muted font-semibold">
                  Default kind
                </label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="mt-1 w-full bg-jarvis-panel/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-cyan/50 outline-none"
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-[0.18em] text-jarvis-muted font-semibold">
                    Default trust
                  </label>
                  <span className="text-[11px] text-jarvis-cyan tabular-nums">{defaultTrust.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={defaultTrust}
                  onChange={(e) => setDefaultTrust(parseFloat(e.target.value))}
                  className="mt-2 w-full accent-jarvis-cyan"
                />
              </div>

              <label className="flex items-center gap-2 text-[12px] text-jarvis-body cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="accent-jarvis-cyan"
                />
                Dry run (don't write anything; just show counts)
              </label>
            </div>

            {err && (
              <div className="mt-4 flex items-start gap-2 text-[11px] text-jarvis-red">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="px-4 py-2 rounded-xl text-sm text-jarvis-body hover:text-jarvis-ink hover:bg-white/5 disabled:opacity-40 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !path.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-cyan/10 text-jarvis-cyan border border-jarvis-cyan/30 shadow-glow-cyan hover:bg-jarvis-cyan/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Run import
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-jarvis-panel/40 border border-jarvis-border px-3 py-3 text-center">
                <div className="label text-jarvis-muted mb-1">Scanned</div>
                <div className="text-lg font-semibold text-jarvis-ink tabular-nums">{result.scanned ?? 0}</div>
              </div>
              <div className="rounded-xl bg-jarvis-green/10 border border-jarvis-green/30 px-3 py-3 text-center">
                <div className="label text-jarvis-green mb-1">Imported</div>
                <div className="text-lg font-semibold text-jarvis-green tabular-nums">{result.imported ?? 0}</div>
              </div>
              <div className="rounded-xl bg-jarvis-amber/10 border border-jarvis-amber/30 px-3 py-3 text-center">
                <div className="label text-jarvis-amber mb-1">Skipped</div>
                <div className="text-lg font-semibold text-jarvis-amber tabular-nums">{result.skipped ?? 0}</div>
              </div>
            </div>

            {!ranLive && (
              <div className="mt-4 text-[11px] text-jarvis-muted italic">
                Dry run complete — nothing was written. Uncheck dry-run and run again to import for real.
              </div>
            )}

            {Array.isArray(result.errors) && result.errors.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setErrorsOpen((o) => !o)}
                  className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-semibold text-jarvis-red hover:text-jarvis-red/80 transition"
                >
                  {errorsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  {result.errors.length} error{result.errors.length === 1 ? "" : "s"}
                </button>
                {errorsOpen && (
                  <div className="mt-2 max-h-48 overflow-y-auto flex flex-col gap-1">
                    {result.errors.map((e, i) => (
                      <div
                        key={`${e.file}-${i}`}
                        className="text-[11px] bg-jarvis-red/5 border border-jarvis-red/20 rounded-lg px-3 py-2"
                      >
                        <code className="text-jarvis-red">{e.file}</code>
                        <div className="text-jarvis-body mt-0.5">{e.error}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              {!ranLive && (
                <button
                  type="button"
                  onClick={() => { setResult(null); }}
                  className="px-4 py-2 rounded-xl text-sm text-jarvis-body hover:text-jarvis-ink hover:bg-white/5 transition"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-cyan/10 text-jarvis-cyan border border-jarvis-cyan/30 shadow-glow-cyan hover:bg-jarvis-cyan/20 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
