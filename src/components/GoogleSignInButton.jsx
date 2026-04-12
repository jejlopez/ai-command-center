import { useEffect, useRef, useState } from "react";
import { Loader2, ExternalLink, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { jarvis } from "../lib/jarvis.js";

// Button that runs the Google OAuth flow for the google provider (Gemini).
// - On first use, asks for a Google Cloud OAuth client_id/secret (same as the
//   data connectors: gmail/gcal/drive).
// - Posts creds to /providers/google/oauth/creds, gets authUrl, opens it in a
//   new tab, then polls /providers every 2s (max 5 min) until google shows
//   linked=true, then calls onLinked().
const REDIRECT_URI = "http://127.0.0.1:8787/providers/google/oauth/callback";

export function GoogleSignInButton({ onLinked }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollTimer = useRef(null);

  useEffect(() => () => { if (pollTimer.current) clearInterval(pollTimer.current); }, []);

  const startPolling = () => {
    setPolling(true);
    const start = Date.now();
    pollTimer.current = setInterval(async () => {
      try {
        const list = await jarvis.getProviders();
        const google = list?.find?.((p) => p.id === "google");
        if (google?.linked && google?.authMode === "oauth") {
          clearInterval(pollTimer.current);
          pollTimer.current = null;
          setPolling(false);
          setOpen(false);
          onLinked?.();
        }
      } catch {
        // swallow transient errors (e.g. vault re-lock)
      }
      if (Date.now() - start > 5 * 60 * 1000) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
        setPolling(false);
        setErr("Timed out waiting for Google sign-in. Try again.");
      }
    }, 2000);
  };

  const handleSubmit = async () => {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const { authUrl } = await jarvis.googleOAuthSetCreds({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      });
      window.open(authUrl, "_blank", "noreferrer,noopener");
      startPolling();
    } catch (e) {
      setErr(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(REDIRECT_URI);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="rounded-xl border border-jarvis-primary/20 bg-jarvis-primary/5 p-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full py-2 px-3 rounded-lg bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 text-[12px] font-semibold transition flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.5-5.9 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13a12 12 0 0 1 7.9 3L38 10A20 20 0 0 0 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C41 34.5 44 29.7 44 24c0-1.2-.1-2.4-.4-3.5z"/>
          </svg>
          Sign in with Google
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="label text-jarvis-primary">Google OAuth — one-time setup</span>
            <button
              onClick={() => setOpen(false)}
              className="text-[11px] text-jarvis-muted hover:text-jarvis-body"
            >
              Cancel
            </button>
          </div>

          <div className="rounded-lg border border-jarvis-amber/25 bg-jarvis-amber/5 p-3 text-[11px] text-jarvis-body leading-relaxed">
            JARVIS is local-first, so Google OAuth requires <em>your</em> Google Cloud OAuth client
            (same as every local app that says "Sign in with Google"). This is a one-time ~2-minute
            setup. After that, every future sign-in is actually one-click.
            <div className="mt-2">
              <strong className="text-jarvis-ink">Fastest alternative:</strong> just paste a Gemini
              API key below — no setup needed.
            </div>
          </div>

          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer noopener"
            className="w-full py-2 px-3 rounded-lg bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 text-[12px] font-semibold transition flex items-center justify-center gap-2"
          >
            <ExternalLink size={12} /> Open Google Cloud Console → Credentials
          </a>

          <div className="flex items-center gap-2 text-[10px] text-jarvis-muted bg-black/40 rounded-lg px-3 py-2">
            <span className="shrink-0">Paste this as the redirect URI:</span>
            <code className="text-jarvis-primary truncate flex-1">{REDIRECT_URI}</code>
            <button
              onClick={copyRedirect}
              title="Copy redirect URI"
              className="text-jarvis-muted hover:text-jarvis-primary shrink-0"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>

          <div className="pt-1 border-t border-jarvis-border" />

          <input
            type="password"
            placeholder="Paste client_id from Google Cloud"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-jarvis-border px-3 py-2 text-xs text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-primary/50"
          />
          <input
            type="password"
            placeholder="Paste client_secret from Google Cloud"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-jarvis-border px-3 py-2 text-xs text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-primary/50"
          />
          <button
            onClick={handleSubmit}
            disabled={busy || polling || !clientId.trim() || !clientSecret.trim()}
            className="w-full py-2 px-3 rounded-lg bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 text-[12px] font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : null}
            {polling ? "Waiting for Google sign-in…" : busy ? "Opening…" : "Save & Open Google sign-in"}
          </button>
          {err && <div className="text-[11px] text-jarvis-red">{err}</div>}
          <HelpExpander defaultOpen={true} />
        </div>
      )}
    </div>
  );
}

function HelpExpander({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-jarvis-muted hover:text-jarvis-primary flex items-center gap-1"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Step-by-step setup
      </button>
      {open && (
        <ol className="mt-2 text-[11px] text-jarvis-body list-decimal pl-5 space-y-1.5">
          <li>
            Create (or pick) a project in{" "}
            <a
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
            >
              Google Cloud Console <ExternalLink size={10} />
            </a>
            .
          </li>
          <li>
            Go to{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials/consent"
              target="_blank"
              rel="noreferrer noopener"
              className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
            >
              OAuth consent screen <ExternalLink size={10} />
            </a>{" "}
            → External → fill the basics → save.
          </li>
          <li>
            Then{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer noopener"
              className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
            >
              Credentials <ExternalLink size={10} />
            </a>{" "}
            → Create credentials → OAuth client ID → <strong>Web application</strong>.
          </li>
          <li>Add the redirect URI above to "Authorized redirect URIs".</li>
          <li>
            Enable{" "}
            <a
              href="https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com"
              target="_blank"
              rel="noreferrer noopener"
              className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
            >
              Generative Language API <ExternalLink size={10} />
            </a>
            .
          </li>
          <li>Copy client_id and client_secret from the OAuth client you just made, paste them above.</li>
        </ol>
      )}
    </div>
  );
}
