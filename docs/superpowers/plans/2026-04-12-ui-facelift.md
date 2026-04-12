# JARVIS OS UI Facelift — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current cyan/navy theme with the "Titanium Cinematic" design — teal & white on warm charcoal, ghost surfaces, collapsible sidebar, and cinematic Framer Motion animations across all views.

**Architecture:** Bottom-up — update the design tokens first (Tailwind + CSS), then rebuild the shared layout components (Sidebar, Header, cards), then sweep each view. Every view gets Framer Motion stagger animations. No backend changes.

**Tech Stack:** React, Tailwind CSS, Framer Motion, Lucide React

---

### Task 1: Design Tokens — Tailwind Config

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Replace the color palette**

Replace the entire `colors.jarvis` object in `tailwind.config.js` with:

```js
jarvis: {
  bg:      '#08080a',
  surface: 'rgba(255,255,255,0.015)',
  'surface-hover': 'rgba(255,255,255,0.03)',
  border:  'rgba(255,255,255,0.04)',
  'border-hover': 'rgba(255,255,255,0.08)',
  primary: '#00E0D0',
  'primary-muted': 'rgba(0,224,208,0.15)',
  ink:     'rgba(255,255,255,0.85)',
  body:    'rgba(255,255,255,0.45)',
  muted:   'rgba(255,255,255,0.2)',
  ghost:   'rgba(255,255,255,0.08)',
  success: '#00E0A0',
  warning: '#FFB340',
  danger:  '#FF5577',
  purple:  '#a78bfa',
},
```

- [ ] **Step 2: Update shadows — remove all glow shadows**

Replace the `boxShadow` section with:

```js
boxShadow: {
  'glow-primary': '0 0 0 1px rgba(0,224,208,0.2), 0 0 20px rgba(0,224,208,0.08)',
  'panel': '0 2px 12px rgba(0,0,0,0.2)',
},
```

- [ ] **Step 3: Verify build**

Run: `npx vite build 2>&1 | grep "built in"`
Expected: build succeeds (warnings about unused classes are fine — those get cleaned in later tasks)

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.js
git commit -m "design: replace color tokens with Titanium palette"
```

---

### Task 2: Base Styles — index.css

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace the entire file**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

html, body, #root {
  height: 100%;
}

body {
  background: #08080a;
  color: rgba(255,255,255,0.85);
  font-family: Inter, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

@layer components {
  .surface {
    @apply bg-jarvis-surface border border-jarvis-border rounded-[14px];
  }
  .surface-hover {
    @apply hover:bg-jarvis-surface-hover hover:border-jarvis-border-hover transition-all duration-200;
  }
  .chip {
    @apply inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-medium tracking-[0.12em] uppercase;
  }
  .label {
    @apply text-[9px] uppercase tracking-[0.18em] text-jarvis-muted font-medium;
  }
  .metric {
    @apply text-2xl font-light tracking-tight text-jarvis-ink;
  }
}

/* Shimmer loading animation */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.shimmer {
  background: linear-gradient(90deg, rgba(255,255,255,0.01) 25%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.01) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

/* Pulse for orb */
@keyframes pulse-primary {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.pulse-primary { animation: pulse-primary 2.8s ease-in-out infinite; }
```

- [ ] **Step 2: Verify build**

Run: `npx vite build 2>&1 | grep "built in"`

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "design: replace base styles with Titanium ghost surfaces"
```

---

### Task 3: Motion Utilities — shared animation config

**Files:**
- Create: `src/lib/motion.js`

- [ ] **Step 1: Create the shared motion config**

```js
// Cinematic animation presets for Framer Motion.
// Import these in any view/component for consistent stagger + entrance.

export const stagger = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3 } },
};

export const slideUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// Animated counter — counts from 0 to target over 800ms
export function countUp(target, duration = 800) {
  return {
    from: 0,
    to: target,
    duration: duration / 1000,
    ease: [0.22, 1, 0.36, 1],
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/motion.js
git commit -m "design: add shared cinematic motion presets"
```

---

### Task 4: Collapsible Sidebar

**Files:**
- Modify: `src/components/Sidebar.jsx`

- [ ] **Step 1: Rewrite with collapsible behavior**

```jsx
import { useState } from "react";
import { Home, CalendarClock, Briefcase, Wallet, Heart, HeartPulse, Brain, Settings, Wand2, ChevronsRight, ChevronsLeft } from "lucide-react";

const ITEMS = [
  { id: "home",   label: "Home",      Icon: Home },
  { id: "today",  label: "Today",     Icon: CalendarClock },
  { id: "work",   label: "Work",      Icon: Briefcase },
  { id: "money",  label: "Money",     Icon: Wallet },
  { id: "life",   label: "Home Life", Icon: Heart },
  { id: "health", label: "Health",    Icon: HeartPulse },
  { id: "brain",  label: "Brain",     Icon: Brain },
  { id: "skills", label: "Skills",    Icon: Wand2 },
];

function NavBtn({ id, label, Icon, isActive, expanded, onSelect }) {
  return (
    <button
      onClick={() => onSelect?.(id)}
      title={expanded ? undefined : label}
      className={[
        "relative flex items-center gap-3 rounded-[10px] transition-all duration-200",
        expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
        isActive
          ? "bg-jarvis-primary-muted text-jarvis-primary"
          : "text-jarvis-muted hover:text-jarvis-ink hover:bg-jarvis-surface-hover",
      ].join(" ")}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-jarvis-primary" />
      )}
      <Icon size={17} strokeWidth={isActive ? 2 : 1.5} />
      {expanded && (
        <span className="text-[12px] font-medium whitespace-nowrap overflow-hidden">{label}</span>
      )}
    </button>
  );
}

export function Sidebar({ active = "home", onSelect }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={[
        "flex flex-col py-3 border-r border-jarvis-border bg-jarvis-bg transition-all duration-200",
        expanded ? "w-[180px] px-2.5" : "w-[56px] px-[10px]",
      ].join(" ")}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Brand */}
      <div className={`flex items-center gap-2.5 mb-4 pb-4 border-b border-jarvis-border ${expanded ? "px-2" : "justify-center"}`}>
        <div className="relative w-7 h-7 rounded-full bg-jarvis-primary-muted grid place-items-center shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-jarvis-primary pulse-primary" />
        </div>
        {expanded && (
          <span className="text-[12px] font-semibold tracking-[0.06em] text-jarvis-ink">JARVIS</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {ITEMS.map(({ id, label, Icon }) => (
          <NavBtn key={id} id={id} label={label} Icon={Icon} isActive={id === active} expanded={expanded} onSelect={onSelect} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="pt-3 border-t border-jarvis-border space-y-0.5">
        <NavBtn id="settings" label="Settings" Icon={Settings} isActive={active === "settings"} expanded={expanded} onSelect={onSelect} />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx vite build 2>&1 | grep "built in"`

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.jsx
git commit -m "design: collapsible sidebar (56px ↔ 180px on hover)"
```

---

### Task 5: Simplified Header + StatusStrip

**Files:**
- Modify: `src/components/StatusStrip.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Rewrite StatusStrip — 3 items only**

```jsx
import { useSocketStatus } from "../hooks/useJarvisSocket.js";

function Indicator({ label, value, color = "text-jarvis-muted" }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-jarvis-muted">{label}</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  );
}

export function StatusStrip({ vaultLocked, cost }) {
  const connected = useSocketStatus();
  const spent = cost?.spentUsd != null ? `$${cost.spentUsd.toFixed(2)}` : "—";
  const budget = cost?.budgetUsd != null ? `$${cost.budgetUsd}` : "—";
  const frac = (cost?.spentUsd && cost?.budgetUsd) ? cost.spentUsd / cost.budgetUsd : 0;
  const costColor = frac < 0.5 ? "text-jarvis-success" : frac < 0.9 ? "text-jarvis-warning" : "text-jarvis-danger";

  return (
    <div className="flex items-center gap-5">
      <Indicator label="Spend" value={`${spent} / ${budget}`} color={costColor} />
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-jarvis-success" : "bg-jarvis-danger"}`} />
        <span className="text-[10px] text-jarvis-muted">{connected ? "Live" : "Off"}</span>
      </div>
      <span className={`text-[10px] ${vaultLocked ? "text-jarvis-warning" : "text-jarvis-muted"}`}>
        {vaultLocked ? "Locked" : "Vault open"}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Simplify App.jsx header — remove segmented control, clean header**

In `src/App.jsx`, replace the entire `<header>` block (lines ~73-119) with:

```jsx
<header className="relative flex items-center justify-between gap-4 px-6 py-3 border-b border-jarvis-border">
  <h1 className="font-display text-[18px] font-semibold tracking-[0.02em] text-jarvis-ink">
    {active === "home" ? "Home" : active === "today" ? "Today" : active === "work" ? "Work" : active === "money" ? "Money" : active === "life" ? "Home Life" : active === "health" ? "Health" : active === "brain" ? "Brain" : active === "skills" ? "Skills" : active === "settings" ? "Settings" : ""}
  </h1>
  <StatusStrip vaultLocked={health?.vaultLocked ?? true} cost={cost} />
</header>
```

Also remove the `SegmentedControl` import, `JarvisHalo` import from the header (keep it for loading screen), the `mode` state, and the Regenerate button from the header. The regenerate button moves into the MorningBrief component itself.

- [ ] **Step 3: Verify build**

Run: `npx vite build 2>&1 | grep "built in"`

- [ ] **Step 4: Commit**

```bash
git add src/components/StatusStrip.jsx src/App.jsx
git commit -m "design: simplified header with 3 status indicators"
```

---

### Task 6: MorningBrief — Ghost Surfaces + Stagger

**Files:**
- Modify: `src/components/MorningBrief.jsx`

- [ ] **Step 1: Add Framer Motion + ghost surfaces**

At the top, add:
```jsx
import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";
```

Replace the `TONE` object colors — swap `cyan` key to use `primary`:
```js
const TONE = {
  primary: { text: "text-jarvis-primary", dot: "bg-jarvis-primary", border: "border-jarvis-primary/15", bg: "bg-jarvis-primary/[0.03]" },
  amber:   { text: "text-jarvis-warning", dot: "bg-jarvis-warning", border: "border-jarvis-warning/15", bg: "bg-jarvis-warning/[0.03]" },
  red:     { text: "text-jarvis-danger",  dot: "bg-jarvis-danger",  border: "border-jarvis-danger/15",  bg: "bg-jarvis-danger/[0.03]" },
  green:   { text: "text-jarvis-success", dot: "bg-jarvis-success", border: "border-jarvis-success/15", bg: "bg-jarvis-success/[0.03]" },
  purple:  { text: "text-jarvis-purple",  dot: "bg-jarvis-purple",  border: "border-jarvis-purple/15",  bg: "bg-jarvis-purple/[0.03]" },
};
```

Replace the `Section` component — ghost surface + motion:
```jsx
function Section({ Icon, title, tone = "primary", children }) {
  const t = TONE[tone];
  return (
    <motion.div variants={stagger.item} className={`surface p-4 ${t.bg} border-${t.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={13} className={t.text} />
        <span className={`label ${t.text}`}>{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </motion.div>
  );
}
```

Wrap the outer container in MorningBrief with stagger:
```jsx
<motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
```

Replace the hero `glass` class with `surface`:
```jsx
<motion.div variants={stagger.item} className="surface p-5">
```

- [ ] **Step 2: Verify build**

Run: `npx vite build 2>&1 | grep "built in"`

- [ ] **Step 3: Commit**

```bash
git add src/components/MorningBrief.jsx
git commit -m "design: MorningBrief with ghost surfaces + cinematic stagger"
```

---

### Task 7: RightRail + Composer — Ghost Surfaces

**Files:**
- Modify: `src/components/RightRail.jsx`
- Modify: `src/components/Composer.jsx`

- [ ] **Step 1: Update RightRail**

Add `import { motion } from "framer-motion";` and `import { stagger } from "../lib/motion.js";`

Replace all `glass` classes with `surface`. Replace `text-jarvis-cyan` with `text-jarvis-primary`. Replace `text-jarvis-blue` with `text-jarvis-primary`. Replace `bg-jarvis-cyan` with `bg-jarvis-primary`. Replace `shadow-glow-cyan` with nothing (remove glow shadows).

Wrap the card list in `<motion.div variants={stagger.container} initial="hidden" animate="show">` and each card in `<motion.div variants={stagger.item}>`.

- [ ] **Step 2: Update Composer**

Replace input styling:
```jsx
className="w-full bg-jarvis-surface border border-jarvis-border rounded-xl px-4 py-3 text-[13px] text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-primary/25 focus:outline-none transition-all"
```

Replace button styling — use `text-jarvis-primary hover:bg-jarvis-primary-muted` instead of cyan.

- [ ] **Step 3: Verify build + Commit**

```bash
npx vite build 2>&1 | grep "built in"
git add src/components/RightRail.jsx src/components/Composer.jsx
git commit -m "design: RightRail + Composer ghost surfaces"
```

---

### Task 8: Views Sweep — Today, Brain, Skills

**Files:**
- Modify: `src/views/Today.jsx`
- Modify: `src/views/Brain.jsx`
- Modify: `src/views/Skills.jsx`

- [ ] **Step 1: For each file, apply these replacements (use replace_all):**

| Find | Replace |
|------|---------|
| `glass` | `surface` |
| `text-jarvis-cyan` | `text-jarvis-primary` |
| `bg-jarvis-cyan` | `bg-jarvis-primary` |
| `border-jarvis-cyan` | `border-jarvis-primary` |
| `shadow-glow-cyan` | (remove entirely) |
| `text-jarvis-blue` | `text-jarvis-primary` |
| `bg-jarvis-panel` | `bg-jarvis-surface` |
| `bg-jarvis-glass` | `bg-jarvis-surface` |

- [ ] **Step 2: Add stagger animation to each view**

At the top of each file, add:
```jsx
import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";
```

Wrap the main content container with:
```jsx
<motion.div variants={stagger.container} initial="hidden" animate="show" className="...existing classes...">
```

Wrap each card/section with:
```jsx
<motion.div variants={stagger.item}>
```

- [ ] **Step 3: Verify build + Commit**

```bash
npx vite build 2>&1 | grep "built in"
git add src/views/Today.jsx src/views/Brain.jsx src/views/Skills.jsx
git commit -m "design: Today + Brain + Skills ghost surfaces + stagger"
```

---

### Task 9: Views Sweep — Work, Money, HomeLife, Health

**Files:**
- Modify: `src/views/Work.jsx`
- Modify: `src/views/Money.jsx`
- Modify: `src/views/HomeLife.jsx`
- Modify: `src/views/Health.jsx`

- [ ] **Step 1: Apply the same replacement table from Task 8 to all four files.**

- [ ] **Step 2: Add stagger animation to each view (same pattern as Task 8).**

- [ ] **Step 3: Verify build + Commit**

```bash
npx vite build 2>&1 | grep "built in"
git add src/views/Work.jsx src/views/Money.jsx src/views/HomeLife.jsx src/views/Health.jsx
git commit -m "design: Work + Money + HomeLife + Health ghost surfaces + stagger"
```

---

### Task 10: Settings + Onboarding + Sub-components

**Files:**
- Modify: `src/views/Settings.jsx`
- Modify: `src/views/Onboarding.jsx`
- Modify: All files in `src/components/settings/*.jsx`
- Modify: All files in `src/components/onboarding/*.jsx`
- Modify: `src/components/skills/SkillRunResult.jsx`
- Modify: `src/components/skills/SkillsRailWidget.jsx`

- [ ] **Step 1: Apply the replacement table from Task 8 across all files.**

- [ ] **Step 2: In Settings.jsx, update the sidebar nav to use ghost styling** — replace `bg-jarvis-cyan/10 text-jarvis-cyan shadow-glow-cyan` with `bg-jarvis-primary-muted text-jarvis-primary`.

- [ ] **Step 3: Verify build + Commit**

```bash
npx vite build 2>&1 | grep "built in"
git add src/views/Settings.jsx src/views/Onboarding.jsx src/components/settings/ src/components/onboarding/ src/components/skills/
git commit -m "design: Settings + Onboarding + sub-components ghost surfaces"
```

---

### Task 11: Login Screen — Teal Update

**Files:**
- Modify: `src/views/Login.jsx`
- Modify: `src/components/login/HolographicHUD.jsx`

- [ ] **Step 1: Replace cyan references in Login.jsx**

| Find | Replace |
|------|---------|
| `text-jarvis-cyan` | `text-jarvis-primary` |
| `bg-jarvis-cyan` | `bg-jarvis-primary` |
| `border-jarvis-cyan` | `border-jarvis-primary` |
| `rgba(93,232,255` | `rgba(0,224,208` |

- [ ] **Step 2: Same replacements in HolographicHUD.jsx**

- [ ] **Step 3: Verify build + Commit**

```bash
npx vite build 2>&1 | grep "built in"
git add src/views/Login.jsx src/components/login/HolographicHUD.jsx
git commit -m "design: login screen updated to teal palette"
```

---

### Task 12: App.jsx Background + Final Cleanup

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Update the app background**

Replace the body ambient background blurs:
```jsx
{/* Ambient background */}
<div className="absolute inset-0 pointer-events-none">
  <div className="absolute -top-20 left-1/3 w-[500px] h-[500px] rounded-full bg-jarvis-primary/[0.04] blur-[150px]" />
  <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-jarvis-purple/[0.03] blur-[120px]" />
</div>
```

- [ ] **Step 2: Replace all remaining `glass` with `surface`, all `jarvis-cyan` with `jarvis-primary` in App.jsx**

- [ ] **Step 3: Global search for any remaining `jarvis-cyan` or `glass` references**

Run: `grep -r "jarvis-cyan\|jarvis-blue\|shadow-glow-cyan\|\"glass\"" src/ --include="*.jsx" --include="*.js" -l`

Fix any remaining files.

- [ ] **Step 4: Final build verification**

Run: `npx vite build 2>&1 | tail -10`
Expected: clean build, no errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "design: Titanium Cinematic facelift complete — teal ghost surfaces + cinematic motion"
```

---

### Summary

| Task | What | Files |
|------|------|-------|
| 1 | Tailwind tokens | tailwind.config.js |
| 2 | Base CSS | src/index.css |
| 3 | Motion presets | src/lib/motion.js |
| 4 | Collapsible sidebar | Sidebar.jsx |
| 5 | Header + StatusStrip | StatusStrip.jsx, App.jsx |
| 6 | MorningBrief | MorningBrief.jsx |
| 7 | RightRail + Composer | RightRail.jsx, Composer.jsx |
| 8 | Views: Today, Brain, Skills | 3 view files |
| 9 | Views: Work, Money, HomeLife, Health | 4 view files |
| 10 | Settings + sub-components | ~15 files |
| 11 | Login teal update | 2 files |
| 12 | Final cleanup | App.jsx + sweep |
