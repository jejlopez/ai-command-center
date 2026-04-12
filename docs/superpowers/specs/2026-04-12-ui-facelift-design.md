# JARVIS OS — UI Facelift Design Spec

**Direction:** Titanium Cinematic
**Date:** 2026-04-12
**Status:** Approved

---

## 1. Color System

Replace the current cyan-heavy navy palette with a warmer, cleaner system.

### Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `bg` | `#08080a` | App background — warm near-black |
| `surface` | `rgba(255,255,255,0.015)` | Card/panel fill — barely visible |
| `surface-hover` | `rgba(255,255,255,0.03)` | Hover state on surfaces |
| `border` | `rgba(255,255,255,0.04)` | Hairline borders — ghost edges |
| `border-hover` | `rgba(255,255,255,0.08)` | Borders on hover/focus |
| `primary` | `#00E0D0` | Teal — core accent, active states, orb |
| `primary-muted` | `rgba(0,224,208,0.15)` | Teal backgrounds, subtle highlights |
| `text` | `rgba(255,255,255,0.85)` | Primary text |
| `text-secondary` | `rgba(255,255,255,0.45)` | Body text |
| `text-muted` | `rgba(255,255,255,0.2)` | Labels, captions |
| `text-ghost` | `rgba(255,255,255,0.08)` | Barely-visible text |
| `success` | `#00E0A0` | Completed, healthy |
| `warning` | `#FFB340` | Pending, caution (warm amber, not yellow) |
| `danger` | `#FF5577` | Error, blocked |
| `accent-purple` | `#A78BFA` | Brain/memory |

### Rules
- No blue (`#4b9dff`) anywhere in the UI. Replace with teal or white.
- Cyan (`#5de8ff`) replaced by teal (`#00E0D0`) globally.
- Navy backgrounds (`#05070d`, `#0a0f1a`) replaced by warm near-black (`#08080a`).
- Panel backgrounds are 1.5% white, not colored. No `bg-jarvis-glass`.
- Glow shadows removed from most elements. Only the active sidebar item and the reactor orb glow.

---

## 2. Typography

| Role | Font | Weight | Size | Tracking |
|------|------|--------|------|----------|
| Display (page titles) | Sora | 600 | 22px | 0.02em |
| Heading (card titles) | Inter | 500 | 14px | 0em |
| Body | Inter | 400 | 13px | 0em |
| Mono (data, code) | JetBrains Mono | 400 | 12px | 0.02em |
| Label | Inter | 500 | 9px | 0.18em uppercase |
| Metric (large numbers) | Inter | 300 | 24px | -0.02em |

### Rules
- Numbers use weight 300 (light) — confidence, not shouting.
- Labels are always uppercase, 9px, 0.18em tracking.
- No bold body text. Hierarchy comes from size and opacity, not weight.
- Line-height: 1.6 for body, 1.2 for headings, 1.0 for metrics.

---

## 3. Layout

### Sidebar (Collapsible)
- **Collapsed:** 56px wide, icon-only, rounded icon buttons (36x36px)
- **Expanded:** 180px wide, icons + labels, smooth 200ms transition
- **Trigger:** hover on sidebar area OR click toggle button at bottom
- **Active item:** teal background at 6% opacity, teal icon, left accent bar (3px)
- **Brand:** small orb (24px) + "JARVIS" text (expanded) / orb only (collapsed)
- **Settings + Sign Out:** pinned to bottom, separated by hairline border

### Header
- Remove the segmented control (Morning Brief / Output). Brief is the default home view.
- Simplify to: page title (left) + status indicators (right)
- Status indicators: just 3 items max — cost pill, connection dot, vault state
- Height: 52px
- No JarvisHalo in the header — the login screen owns the orb

### Content Area
- Full width, no right rail on most views. Right rail only on Home.
- Max content width: 720px centered (except full-width views like Today, Brain)
- Padding: 24px horizontal, 20px vertical
- Scroll: content only, header + sidebar fixed

### Right Rail (Home only)
- Width: 280px
- Contains: pending approvals, recent skill runs
- Separated by hairline border

---

## 4. Surface Treatment — Ghost Panels

### Card Component
```
background: rgba(255,255,255, 0.015)
border: 1px solid rgba(255,255,255, 0.04)
border-radius: 14px
padding: 18px
shadow: none (no box-shadow on cards)
```

### Card Hover
```
background: rgba(255,255,255, 0.025)
border-color: rgba(255,255,255, 0.06)
transition: 200ms
```

### Input Fields
```
background: rgba(255,255,255, 0.02)
border: 1px solid rgba(255,255,255, 0.05)
border-radius: 10px
padding: 10px 14px
focus: border-color rgba(0,224,208, 0.25)
```

### Buttons
- **Primary:** bg teal at 8%, border teal at 15%, text teal. Hover: bg 12%.
- **Secondary:** bg white at 3%, border white at 5%, text white/60. Hover: bg 5%.
- **Danger:** bg red at 8%, border red at 15%, text red.
- All buttons: border-radius 10px, padding 8px 16px, font-weight 500, 12px.

### Chips / Badges
```
background: rgba(255,255,255, 0.04)
border-radius: 20px
padding: 3px 10px
font-size: 9px
text-transform: uppercase
letter-spacing: 0.12em
```
Color variants: teal chip, amber chip, red chip, green chip — using the semantic colors at 10% bg + 60% text.

---

## 5. Motion — Cinematic & Theatrical

### Page Transitions
- Elements enter with staggered cascade: 50ms delay between each card/section
- Entry: `opacity 0 → 1`, `translateY 12px → 0`, duration 400ms
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`
- Exit: `opacity 1 → 0`, duration 150ms (fast out)

### Numbers
- Large metrics count up from 0 on view enter (duration 800ms, ease-out)
- Use `requestAnimationFrame` or Framer Motion `animate`

### Hover States
- Cards: background opacity shift, 200ms, no scale change
- Buttons: subtle bg shift, 150ms
- Sidebar items: bg appears, 150ms

### Skeleton Loading
- Ghost shimmer: a subtle gradient sweep across the card area
- Color: `rgba(255,255,255, 0.02)` → `rgba(255,255,255, 0.04)` → `rgba(255,255,255, 0.02)`
- Duration: 1.5s loop
- No spinners. Loading states are shimmer surfaces shaped like the content they replace.

### Micro-interactions
- Skill run complete: card border briefly flashes teal (300ms fade)
- Approval decided: card slides out to the right (250ms)
- Memory remembered: brief teal pulse on the Brain sidebar icon

---

## 6. Component Changes

### Sidebar.jsx
- Rewrite to collapsible pattern
- Remove `shadow-glow-cyan` on active item
- Add hover-expand behavior with 200ms transition
- Icon-only at 56px, full labels at 180px

### StatusStrip.jsx
- Reduce to 3 indicators: cost, connection, vault
- Remove "Mode: Deep Work" chip (not functional)
- Remove "Open: Xm" uptime chip (not useful to user)
- Simpler layout: inline text, no glass panels per chip

### MorningBrief.jsx
- Ghost surface cards
- Staggered entrance animation
- Metric numbers count up
- Remove explicit "Morning Brief" header — the content speaks for itself

### All Views
- Replace `glass` class with new ghost surface
- Replace `text-jarvis-cyan` with `text-jarvis-primary`
- Replace `bg-jarvis-panel` with `bg-jarvis-surface`
- Replace all `shadow-glow-*` with clean borders only
- Add Framer Motion `staggerChildren` to card containers

### Login Screen
- Keep the 3D reactor + starfield (already built)
- Update form colors to match Titanium palette
- Teal accents instead of cyan

---

## 7. Files to Modify

| File | Change |
|------|--------|
| `tailwind.config.js` | New color tokens |
| `src/index.css` | New base styles, remove old `.glass` |
| `src/components/Sidebar.jsx` | Collapsible rewrite |
| `src/components/StatusStrip.jsx` | Simplify to 3 items |
| `src/App.jsx` | Remove segmented control, simplify header |
| `src/components/MorningBrief.jsx` | Ghost surfaces + stagger |
| `src/components/RightRail.jsx` | Ghost surfaces |
| `src/components/Composer.jsx` | Updated input style |
| `src/views/Today.jsx` | Ghost surfaces + stagger |
| `src/views/Brain.jsx` | Ghost surfaces + stagger |
| `src/views/Work.jsx` | Ghost surfaces + stagger |
| `src/views/Money.jsx` | Ghost surfaces + stagger |
| `src/views/HomeLife.jsx` | Ghost surfaces + stagger |
| `src/views/Health.jsx` | Ghost surfaces + stagger |
| `src/views/Skills.jsx` | Ghost surfaces + stagger |
| `src/views/Settings.jsx` | Ghost surfaces |
| `src/views/Login.jsx` | Teal accent update |
| All `src/components/settings/*.jsx` | Ghost surfaces |
| All `src/components/skills/*.jsx` | Ghost surfaces |

---

## 8. What NOT to Change

- Login screen 3D reactor — keep as-is (already built, user likes it)
- Starfield + floating dots — keep as-is
- Audio system — keep as-is
- Daemon, skills, memory, all backend — untouched
- Functional behavior of any view — only visual treatment changes
