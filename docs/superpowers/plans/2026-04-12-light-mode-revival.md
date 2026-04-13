# Light Mode Revival + Connections Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix washed-out light mode readability across the app, add light-mode-aware CalendarRail event colors, and redesign the Settings connectors/providers into a unified Connections page with real brand icons.

**Architecture:** Three independent changes: (1) CSS variable updates in index.css, (2) CalendarRail theme-aware event styles, (3) new ConnectionsPanel component replacing ProvidersPanel + ConnectorsPanel in Settings. The ConnectionsPanel reuses existing `jarvis.setProviderKey()`/`jarvis.getConnectors()` backend APIs.

**Tech Stack:** React, Tailwind CSS, CSS custom properties, inline SVGs for brand icons

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/index.css` | Modify | Light-mode CSS variable values + surface box-shadow |
| `src/components/ops/CalendarRail.jsx` | Modify | Theme-aware KIND_STYLE map + left accent borders |
| `src/components/settings/ConnectionsPanel.jsx` | Create | Unified connections page with grouped grid layout |
| `src/components/settings/BrandIcons.jsx` | Create | All brand icon SVG components in one file |
| `src/views/Settings.jsx` | Modify | Replace providers+connectors tabs with single connections tab |

---

### Task 1: Fix Light-Mode CSS Variables

**Files:**
- Modify: `src/index.css:18-29`

- [ ] **Step 1: Update the `[data-theme="light"]` block**

Open `src/index.css` and replace lines 18-29:

```css
[data-theme="light"] {
  color-scheme: light;
  --jarvis-bg: #eef0f4;
  --jarvis-surface: rgba(255,255,255,0.92);
  --jarvis-surface-hover: rgba(255,255,255,0.96);
  --jarvis-border: rgba(0,0,0,0.13);
  --jarvis-border-hover: rgba(0,0,0,0.20);
  --jarvis-ink: rgba(0,0,0,0.9);
  --jarvis-body: rgba(0,0,0,0.72);
  --jarvis-muted: rgba(0,0,0,0.45);
  --jarvis-ghost: rgba(0,0,0,0.10);
}
```

- [ ] **Step 2: Add light-mode surface box-shadow**

After the existing `.glass` rule (around line 63), add:

```css
[data-theme="light"] .surface {
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev`, open the app, toggle to light mode in Settings → Theme. Verify:
- Card borders are visible (not ghostly)
- Body text is readable without squinting
- Muted text (timestamps, subtitles) is visible
- Cards feel solid, not translucent

- [ ] **Step 4: Toggle back to dark mode**

Verify dark mode is unchanged — all variables are scoped to `[data-theme="light"]`.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "fix: boost light-mode contrast — surfaces, borders, text opacity"
```

---

### Task 2: CalendarRail Light-Mode Event Colors

**Files:**
- Modify: `src/components/ops/CalendarRail.jsx:26-31`

- [ ] **Step 1: Add a theme-aware KIND_STYLE**

Replace the current `KIND_STYLE` constant (lines 26-31) with a function that returns the appropriate styles based on theme:

```jsx
const KIND_STYLE_DARK = {
  followup: "bg-blue-500/20 border border-blue-500/50 text-blue-300 border-l-[3px] border-l-blue-400",
  trading:  "bg-jarvis-purple/20 border border-jarvis-purple/50 text-jarvis-purple border-l-[3px] border-l-jarvis-purple",
  focus:    "bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 border-l-[3px] border-l-cyan-400",
  event:    "bg-jarvis-primary/15 border border-jarvis-primary/40 text-jarvis-primary border-l-[3px] border-l-jarvis-primary",
};

const KIND_STYLE_LIGHT = {
  followup: "bg-blue-600/10 border border-blue-600/35 text-blue-800 border-l-[3px] border-l-blue-600",
  trading:  "bg-purple-600/10 border border-purple-600/35 text-purple-800 border-l-[3px] border-l-purple-600",
  focus:    "bg-cyan-600/10 border border-cyan-600/35 text-cyan-800 border-l-[3px] border-l-cyan-600",
  event:    "bg-teal-600/10 border border-teal-600/35 text-teal-800 border-l-[3px] border-l-teal-600",
};

function useKindStyle() {
  const [isLight, setIsLight] = useState(
    () => document.documentElement.getAttribute("data-theme") === "light"
  );

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsLight(document.documentElement.getAttribute("data-theme") === "light");
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  return isLight ? KIND_STYLE_LIGHT : KIND_STYLE_DARK;
}
```

- [ ] **Step 2: Use the hook in CalendarRail**

Inside the `CalendarRail` component function, add:

```jsx
const kindStyle = useKindStyle();
```

Then find every reference to `KIND_STYLE[...]` in the component and replace with `kindStyle[...]`. There should be one usage where events are rendered — look for the line that reads the event's `kind` property and applies the style class.

- [ ] **Step 3: Verify in browser**

Toggle to light mode. Navigate to the Work page. Verify:
- Calendar rail events have readable dark text (blue-800, purple-800, etc.)
- Each event has a 3px colored left accent border
- Hour labels are visible (they use `text-jarvis-muted` which is now 45% opacity)

Toggle to dark mode. Verify events still look correct with the existing light-colored text.

- [ ] **Step 4: Commit**

```bash
git add src/components/ops/CalendarRail.jsx
git commit -m "fix: add light-mode event colors to CalendarRail with accent borders"
```

---

### Task 3: Create Brand Icons File

**Files:**
- Create: `src/components/settings/BrandIcons.jsx`

- [ ] **Step 1: Create the brand icons component file**

Create `src/components/settings/BrandIcons.jsx` with all brand icon SVGs as named exports:

```jsx
export const ClaudeSunburst = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <line x1="12" y1="2" x2="12" y2="7" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="12" y1="17" x2="12" y2="22" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="2" y1="12" x2="7" y2="12" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="17" y1="12" x2="22" y2="12" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="4.93" y1="4.93" x2="8.46" y2="8.46" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="15.54" y1="15.54" x2="19.07" y2="19.07" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="4.93" y1="19.07" x2="8.46" y2="15.54" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="15.54" y1="8.46" x2="19.07" y2="4.93" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
    <circle cx="12" cy="12" r="2" fill="white"/>
  </svg>
);

export const CodexCloud = ({ size = 28 }) => (
  <svg width={size} height={size * 0.78} viewBox="0 0 32 26" fill="none">
    <ellipse cx="16" cy="16" rx="12" ry="9" fill="rgba(255,255,255,0.25)"/>
    <ellipse cx="11" cy="13" rx="8" ry="8" fill="rgba(255,255,255,0.25)"/>
    <ellipse cx="21" cy="13" rx="8" ry="8" fill="rgba(255,255,255,0.25)"/>
    <ellipse cx="16" cy="10" rx="9" ry="7" fill="rgba(255,255,255,0.3)"/>
  </svg>
);

export const OpenAIIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
    <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0011.5.5a6.04 6.04 0 00-5.753 4.218 5.97 5.97 0 00-3.997 2.9 6.05 6.05 0 00.754 7.09 5.98 5.98 0 00.516 4.911 6.05 6.05 0 006.51 2.9A6.04 6.04 0 0013.5 23.5a6.04 6.04 0 005.753-4.218 5.97 5.97 0 003.997-2.9 6.04 6.04 0 00-.968-6.561z"/>
  </svg>
);

export const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export const GroqIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="#F47834"/>
  </svg>
);

export const GmailIcon = ({ size = 18 }) => (
  <svg width={size} height={size * 0.78} viewBox="0 0 24 18" fill="none">
    <path d="M1.636 18h4.364V8.727L0 5.455V16.36c0 .905.731 1.636 1.636 1.636z" fill="#4285F4"/>
    <path d="M18 18h4.364c.905 0 1.636-.731 1.636-1.636V5.455L18 8.727z" fill="#34A853"/>
    <path d="M18 1.636V8.727l6-3.272V3.273c0-2.024-2.312-3.178-3.927-1.964z" fill="#FBBC05"/>
    <path d="M6 8.727V1.636l6 4.91 6-4.91v7.09l-6 4.91z" fill="#EA4335"/>
    <path d="M0 3.273v2.182l6 3.273V1.636L3.927 1.31C2.312-.096 0 1.25 0 3.273z" fill="#C5221F"/>
  </svg>
);

export const CalendarIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="2" fill="none"/>
    <path d="M3 10h18" stroke="#4285F4" strokeWidth="2"/>
    <path d="M8 2v4M16 2v4" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/>
    <rect x="7" y="13" width="3" height="3" rx="0.5" fill="#34A853"/>
    <rect x="14" y="13" width="3" height="3" rx="0.5" fill="#EA4335"/>
  </svg>
);

export const DriveIcon = ({ size = 18 }) => (
  <svg width={size} height={size * 0.89} viewBox="0 0 24 22" fill="none">
    <path d="M8.24 1L1 14l3.56 6.16L11.8 7.16z" fill="#0066DA"/>
    <path d="M15.76 1H8.24l7.24 13.16h7.52z" fill="#00AC47"/>
    <path d="M23 14.16h-7.24L12.2 20.32h7.24z" fill="#EA4335"/>
    <path d="M4.56 20.16L8.12 14H1z" fill="#00832D"/>
    <path d="M15.76 14l3.56 6.16L23 14.16z" fill="#2684FC"/>
    <path d="M8.24 1l7.52 13.16H8.12L4.56 20.16l7.24-13z" fill="#FFBA00"/>
  </svg>
);

export const AppleIcon = ({ size = 16 }) => (
  <svg width={size} height={size * 1.125} viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

export const PandaDocIcon = ({ size = 38 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64">
    <path d="M62.125 0H1.875C.84 0 0 .84 0 1.875v60.25C0 63.16.84 64 1.875 64h60.25C63.16 64 64 63.16 64 62.125V1.875C64 .84 63.16 0 62.125 0z" fill="#248567"/>
    <path d="M48.123 11.37V23.25c-1.92-1.525-4.35-2.436-6.992-2.436-3.737 0-7.048 1.823-9.094 4.627a11.2 11.2 0 0 0-2.157 6.625c0 .013-.005.005-.015-.015-.006 3.857-3.134 6.982-6.992 6.982-3.853 0-6.977-3.116-6.992-6.966v-.053c.014-3.85 3.14-6.966 6.992-6.966 2.62 0 4.904 1.443 6.1 3.577.142-.48.473-1.512.937-2.42.403-.788.922-1.47 1.207-1.82a11.22 11.22 0 0 0-8.245-3.597c-6.14 0-11.132 4.92-11.25 11.033h-.01v20.912h4.267V40.855c1.92 1.525 4.35 2.436 6.99 2.436 3.753 0 7.076-1.838 9.12-4.662 1.334-1.836 2.116-4.1 2.116-6.546 0-.02.012.004.032.058 0-.026-.002-.05-.002-.077 0-3.862 3.13-6.992 6.992-6.992 3.852 0 6.976 3.115 6.992 6.963v.058c-.016 3.848-3.14 6.963-6.992 6.963-2.622 0-4.906-1.444-6.103-3.58-.134.458-.47 1.528-.95 2.467-.39.765-.89 1.43-1.18 1.787a11.22 11.22 0 0 0 8.234 3.586c6.14 0 11.132-4.92 11.25-11.033h.01V11.37z" fill="#fff"/>
  </svg>
);

export const PipedriveIcon = ({ size = 38 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.21,
      background: "#000000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <span
      style={{
        color: "white",
        fontSize: size * 0.58,
        fontWeight: 700,
        fontFamily: "-apple-system, system-ui, sans-serif",
        lineHeight: 1,
        marginTop: size * -0.1,
      }}
    >
      p
    </span>
  </div>
);

// Icon background configs for the ConnectionsPanel
export const ICON_BG = {
  claude:      "bg-[#D97757]",
  claudeCode:  "bg-[#D97757]",
  codex:       "bg-gradient-to-br from-[#7B6BF0] via-[#5B8DEF] to-[#9B7BF7]",
  google:      "bg-blue-500/10",
  groq:        "bg-orange-500/10",
  gmail:       "bg-red-500/10",
  gcal:        "bg-blue-500/10",
  drive:       "bg-yellow-500/10",
  apple:       "bg-white/[0.06]",
  pandadoc:    "", // self-contained icon
  pipedrive:   "", // self-contained icon
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/BrandIcons.jsx
git commit -m "feat: add brand icon SVG components for Connections page"
```

---

### Task 4: Build the ConnectionsPanel

**Files:**
- Create: `src/components/settings/ConnectionsPanel.jsx`

- [ ] **Step 1: Create ConnectionsPanel**

Create `src/components/settings/ConnectionsPanel.jsx`:

```jsx
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Trash2, AlertTriangle, ExternalLink, Eye, EyeOff } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";
import { GoogleSignInButton } from "../GoogleSignInButton.jsx";
import { UnifiedGoogleCard } from "./UnifiedGoogleCard.jsx";
import { AppleConnectCard } from "./AppleConnectCard.jsx";
import {
  ClaudeSunburst, CodexCloud, OpenAIIcon, GoogleIcon, GroqIcon,
  GmailIcon, CalendarIcon, DriveIcon, AppleIcon,
  PandaDocIcon, PipedriveIcon, ICON_BG,
} from "./BrandIcons.jsx";

// ─── Provider definitions ───────────────────────────────────────────
const AI_MODELS = [
  { id: "anthropic", label: "Claude", hint: "Anthropic · Claude family", Icon: ClaudeSunburst, keyUrl: "https://console.anthropic.com/settings/keys", iconKey: "claude" },
  { id: "openai", label: "Codex", hint: "OpenAI · GPT family", Icon: CodexCloud, keyUrl: "https://platform.openai.com/api-keys", iconKey: "codex", overlay: ">_" },
  { id: "claude-code", label: "Claude Code", hint: "Anthropic · CLI agent", Icon: ClaudeSunburst, keyUrl: "https://console.anthropic.com/settings/keys", iconKey: "claudeCode" },
  { id: "google", label: "Google", hint: "Gemini family", Icon: GoogleIcon, keyUrl: "https://aistudio.google.com/app/apikey", iconKey: "google" },
  { id: "groq", label: "Groq", hint: "Fast inference", Icon: GroqIcon, keyUrl: "https://console.groq.com/keys", iconKey: "groq" },
];

const SALES_TOOLS = [
  { id: "pandadoc", label: "PandaDoc", hint: "Proposals & contracts", Icon: PandaDocIcon, keyUrl: "https://developers.pandadoc.com/reference/api-key", iconKey: "pandadoc" },
  { id: "pipedrive", label: "Pipedrive", hint: "CRM & deal pipeline", Icon: PipedriveIcon, keyUrl: "https://pipedrive.readme.io/docs/how-to-find-the-api-token", iconKey: "pipedrive" },
];

// ─── Status helper ──────────────────────────────────────────────────
function statusOf(p) {
  if (!p) return "none";
  if (p.available) return "verified";
  if (p.linked) return "linked";
  return "none";
}

// ─── Provider Row (API key card) ────────────────────────────────────
function ProviderRow({ provider, state, onSave, onRemove }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const status = statusOf(state);
  const connected = status === "verified" || status === "linked";
  const selfContainedIcon = ["pandadoc", "pipedrive"].includes(provider.iconKey);

  const save = async () => {
    if (!value.trim()) return;
    setBusy(true); setErr(null);
    try { await onSave(provider.id, value.trim()); setValue(""); }
    catch (e) { setErr(String(e.message ?? e)); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setErr(null);
    try { await onRemove(provider.id); }
    catch (e) { setErr(String(e.message ?? e)); }
    finally { setBusy(false); }
  };

  const iconContent = selfContainedIcon ? (
    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
      <provider.Icon size={40} />
    </div>
  ) : (
    <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${ICON_BG[provider.iconKey]} relative`}>
      <provider.Icon />
      {provider.overlay && (
        <span className="absolute text-white text-[10px] font-bold font-mono" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
          {provider.overlay}
        </span>
      )}
    </div>
  );

  if (connected) {
    return (
      <div className="rounded-2xl border border-jarvis-border bg-jarvis-surface p-4">
        <div className="flex items-center gap-3">
          {iconContent}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-jarvis-ink font-semibold">{provider.label}</div>
            <div className="text-[11px] text-jarvis-muted">{provider.hint}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="chip bg-jarvis-success/10 text-jarvis-success">
              <Check size={10} /> Connected
            </span>
            <button
              onClick={remove}
              disabled={busy}
              className="p-1.5 rounded-lg text-jarvis-muted hover:text-jarvis-danger hover:bg-jarvis-danger/10 transition"
              title="Disconnect"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        </div>
        {err && (
          <div className="mt-2 text-[11px] text-jarvis-danger flex items-center gap-1.5">
            <AlertTriangle size={12} /> {err}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-jarvis-border bg-jarvis-surface p-4 opacity-70 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-3 mb-3">
        {iconContent}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-jarvis-ink font-semibold">{provider.label}</div>
          <div className="text-[11px] text-jarvis-muted">{provider.hint}</div>
        </div>
        <a
          href={provider.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-jarvis-primary hover:text-jarvis-ink flex items-center gap-1 transition shrink-0"
        >
          Get a key <ExternalLink size={10} />
        </a>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            placeholder="sk-…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-xl bg-jarvis-ghost border border-jarvis-border px-3 py-2 pr-9 text-sm text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-primary/50"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-jarvis-muted hover:text-jarvis-body"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          onClick={save}
          disabled={busy || !value.trim()}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            busy || !value.trim()
              ? "bg-jarvis-ghost text-jarvis-muted cursor-not-allowed"
              : "bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25"
          }`}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : "Connect"}
        </button>
      </div>
      {err && (
        <div className="mt-2 text-[11px] text-jarvis-danger flex items-center gap-1.5">
          <AlertTriangle size={12} /> {err}
        </div>
      )}
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[11px] uppercase tracking-[0.12em] text-jarvis-muted">{children}</span>
      <div className="flex-1 h-px bg-jarvis-border" />
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────
export function ConnectionsPanel() {
  const [providerMap, setProviderMap] = useState({});
  const [connectorStatus, setConnectorStatus] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [providers, connectors] = await Promise.all([
        jarvis.getProviders(),
        jarvis.getConnectors(),
      ]);
      const map = {};
      for (const p of providers ?? []) map[p.id] = p;
      setProviderMap(map);
      setConnectorStatus(connectors ?? {});
    } catch (e) {
      setError(String(e.message ?? e));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveKey = async (id, key) => {
    await jarvis.setProviderKey(id, key);
    try {
      const result = await jarvis.testProvider(id);
      setProviderMap((m) => ({
        ...m,
        [id]: { ...(m[id] ?? { id }), linked: true, available: !!result?.ok, lastError: result?.ok ? undefined : result?.error },
      }));
    } catch (e) {
      setProviderMap((m) => ({
        ...m,
        [id]: { ...(m[id] ?? { id }), linked: true, available: false, lastError: String(e.message ?? e) },
      }));
    }
  };

  const removeKey = async (id) => {
    await jarvis.removeProviderKey(id);
    setProviderMap((m) => ({
      ...m,
      [id]: { ...(m[id] ?? { id }), linked: false, available: false, lastError: undefined },
    }));
  };

  const allProviders = [...AI_MODELS, ...SALES_TOOLS];
  const connectedCount = allProviders.filter((p) => {
    const s = statusOf(providerMap[p.id]);
    return s === "verified" || s === "linked";
  }).length;
  const availableCount = allProviders.length - connectedCount;

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <div className="label">Settings</div>
        <h3 className="font-display text-2xl text-jarvis-ink mt-1">Connections</h3>
        <p className="text-jarvis-body text-sm mt-1">
          Manage all integrations — AI models, data sources, and sales tools.
        </p>
      </div>

      {/* Status bar */}
      <div className="flex gap-4 mb-6 px-4 py-3 rounded-xl bg-jarvis-ghost border border-jarvis-border">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-jarvis-success" />
          <span className="text-xs text-jarvis-body">
            <strong className="text-jarvis-success">{connectedCount}</strong> connected
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-jarvis-muted" />
          <span className="text-xs text-jarvis-muted">{availableCount} available</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-jarvis-danger/30 bg-jarvis-danger/5 px-4 py-3 text-xs text-jarvis-danger">
          {error}
        </div>
      )}

      {/* AI Models */}
      <div className="mb-7">
        <SectionLabel>AI Models</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AI_MODELS.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              state={providerMap[p.id]}
              onSave={saveKey}
              onRemove={removeKey}
            />
          ))}
        </div>
      </div>

      {/* Data Sources */}
      <div className="mb-7">
        <SectionLabel>Data Sources</SectionLabel>
        <AppleConnectCard />
        <div className="mt-3">
          <UnifiedGoogleCard status={connectorStatus} onLinked={refresh} />
        </div>
      </div>

      {/* Sales & CRM Tools */}
      <div className="mb-7">
        <SectionLabel>Sales & CRM Tools</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SALES_TOOLS.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              state={providerMap[p.id]}
              onSave={saveKey}
              onRemove={removeKey}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/ConnectionsPanel.jsx
git commit -m "feat: add unified ConnectionsPanel with grouped grid and real brand icons"
```

---

### Task 5: Wire ConnectionsPanel into Settings

**Files:**
- Modify: `src/views/Settings.jsx:1-22`

- [ ] **Step 1: Update imports**

Replace the ProvidersPanel and ConnectorsPanel imports (lines 3-4):

```jsx
// Remove these:
// import { ProvidersPanel } from "../components/settings/ProvidersPanel.jsx";
// import { ConnectorsPanel } from "../components/settings/ConnectorsPanel.jsx";

// Add this:
import { ConnectionsPanel } from "../components/settings/ConnectionsPanel.jsx";
```

- [ ] **Step 2: Update the TABS array**

Replace the `providers` and `connectors` entries (lines 14-15) with a single entry:

```jsx
const TABS = [
 { id: "connections", label: "Connections", Icon: Plug, Component: ConnectionsPanel },
 { id: "budget", label: "Budget", Icon: Wallet, Component: BudgetPanel },
 { id: "privacy", label: "Privacy", Icon: ShieldCheck, Component: PrivacyPanel },
 { id: "vault", label: "Vault", Icon: Lock, Component: VaultPanel },
 { id: "audit", label: "Audit Log", Icon: ScrollText, Component: AuditPanel },
 { id: "theme", label: "Theme", Icon: Palette, Component: ThemePanel },
 { id: "about", label: "About", Icon: Info, Component: AboutPanel },
];
```

- [ ] **Step 3: Update default tab**

Change the default tab state (line 25):

```jsx
const [tab, setTab] = useState("connections");
```

- [ ] **Step 4: Remove unused import**

Remove `KeyRound` from the lucide-react import since we no longer have the "Providers" tab using it.

- [ ] **Step 5: Verify in browser**

Run `npm run dev`. Go to Settings:
- Verify single "Connections" tab appears (no separate Providers/Connectors)
- Verify three sections: AI Models, Data Sources, Sales & CRM Tools
- Verify existing connected services (Anthropic, OpenAI, Google) show as CONNECTED
- Verify PandaDoc and Pipedrive show as dimmed with "+ Add key" affordance
- Verify clicking an unconnected card shows the API key input
- Toggle to light mode — verify readability is good

- [ ] **Step 6: Toggle dark mode**

Verify everything looks correct in dark mode too — brand icons, card borders, text readability.

- [ ] **Step 7: Commit**

```bash
git add src/views/Settings.jsx
git commit -m "feat: replace Providers+Connectors tabs with unified Connections tab"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Full light/dark mode sweep**

Toggle between light and dark mode. Check each page:
- **Work page**: Cards readable, borders visible, text clear
- **Calendar rail**: Events readable with accent borders in light mode, unchanged in dark
- **Settings → Connections**: All brand icons render, connected/unconnected states correct
- **Other pages** (Home, Money, Health, Brain): Global CSS changes cascade — verify no regressions

- [ ] **Step 2: Test PandaDoc/Pipedrive connect flow**

On the Connections page:
1. Click PandaDoc card
2. Enter a test API key
3. Click Connect
4. Verify the card transitions to CONNECTED state with green pill
5. Click trash icon to disconnect
6. Verify card returns to unconnected state
7. Repeat for Pipedrive

- [ ] **Step 3: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "fix: final tweaks from light-mode revival verification"
```
