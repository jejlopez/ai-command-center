# Light Mode Readability Revival + Connections Page Redesign

**Date:** 2026-04-12
**Scope:** CSS variable fix, CalendarRail light-mode colors, unified Connections page with real brand icons

---

## Problem

Light mode is washed out and nearly unreadable:
- Body text at 60% opacity, muted text at 25% (invisible)
- Borders at 8% opacity (ghost-level)
- Surfaces at 70% white (too translucent)
- CalendarRail event text uses dark-mode-only color values (text-blue-300, text-cyan-300) that disappear on white backgrounds
- Settings has confusing split between "Providers" and "Connectors" tabs
- PandaDoc and Pipedrive connectors are missing
- Provider icons are not authentic brand icons

## Design

### 1. Global Light-Mode CSS Variables (`src/index.css`)

Update the `[data-theme="light"]` block:

| Variable | Current | New |
|---|---|---|
| `--jarvis-surface` | `rgba(255,255,255,0.7)` | `rgba(255,255,255,0.92)` |
| `--jarvis-surface-hover` | `rgba(255,255,255,0.85)` | `rgba(255,255,255,0.96)` |
| `--jarvis-border` | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.13)` |
| `--jarvis-border-hover` | `rgba(0,0,0,0.14)` | `rgba(0,0,0,0.20)` |
| `--jarvis-ink` | `rgba(0,0,0,0.85)` | `rgba(0,0,0,0.9)` |
| `--jarvis-body` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.72)` |
| `--jarvis-muted` | `rgba(0,0,0,0.25)` | `rgba(0,0,0,0.45)` |
| `--jarvis-ghost` | `rgba(0,0,0,0.06)` | `rgba(0,0,0,0.10)` |

Add a subtle box-shadow to `.surface` in light mode:
```css
[data-theme="light"] .surface {
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
```

Dark mode values remain unchanged.

### 2. CalendarRail Light-Mode Event Colors (`src/components/ops/CalendarRail.jsx`)

Current `KIND_STYLE` is dark-mode only. Add light-mode awareness with darker text + 3px left accent border:

**Dark mode (unchanged):**
- followup: `bg-blue-500/20 border-blue-500/50 text-blue-300`
- trading: `bg-jarvis-purple/20 border-jarvis-purple/50 text-jarvis-purple`
- focus: `bg-cyan-500/20 border-cyan-500/50 text-cyan-300`
- event: `bg-jarvis-primary/15 border-jarvis-primary/40 text-jarvis-primary`

**Light mode (new):**
- followup: `bg-blue-600/10 border-blue-600/35 text-blue-800 border-l-[3px] border-l-blue-600`
- trading: `bg-purple-600/10 border-purple-600/35 text-purple-800 border-l-[3px] border-l-purple-600`
- focus: `bg-cyan-600/10 border-cyan-600/35 text-cyan-800 border-l-[3px] border-l-cyan-600`
- event: `bg-teal-600/10 border-teal-600/35 text-teal-800 border-l-[3px] border-l-teal-600`

**Implementation:** Read the current theme from `document.documentElement.getAttribute("data-theme")`. Apply the appropriate style map based on the active theme. Also add the 3px left accent border on each event for visual scanning in both modes.

### 3. Unified Connections Page — Full Redesign

**Replace** the separate Providers tab and Connectors tab with a single **"Connections"** tab.

**New file:** `src/components/settings/ConnectionsPanel.jsx` (replaces both `ProvidersPanel.jsx` and `ConnectorsPanel.jsx` in the Settings tab list)

**Layout — Grouped Grid:**
- Header: "Connections" title + subtitle
- Status bar: green dot "N connected" + gray dot "N available"
- Three category sections, each with a label + horizontal rule + 2-column card grid:
  1. **AI Models** — Claude, Codex, Claude Code, Google, Groq
  2. **Data Sources** — Gmail, Google Calendar, Google Drive, Apple (native)
  3. **Sales & CRM Tools** — PandaDoc, Pipedrive

**Card behavior:**
- Connected cards: brand icon + name + subtitle + green CONNECTED pill + trash/disconnect button
- Unconnected cards: dimmed (opacity 0.7) + "+ Add key" text
- Click unconnected card → expand inline to show API key input + Connect button (for API key connectors) or OAuth flow (for Google services)
- Once connected: input hides, CONNECTED pill + trash button shown

**Real brand icons (inline SVGs):**

| Service | Icon | Background |
|---|---|---|
| Claude | Coral sunburst/asterisk (8 radiating lines + center dot) | `#D97757` |
| Claude Code | Same coral sunburst as Claude | `#D97757` |
| Codex (OpenAI) | Purple cloud with `>_` terminal prompt | `linear-gradient(135deg, #7B6BF0, #5B8DEF, #9B7BF7)` |
| Google | Multi-color G logo (existing SVG from ProvidersPanel) | `rgba(66,133,244,0.1)` |
| Groq | Existing icon | `rgba(244,120,52,0.1)` |
| Gmail | Multi-color envelope (existing) | `rgba(234,67,53,0.1)` |
| Google Calendar | Blue calendar with colored dots | `rgba(66,133,244,0.1)` |
| Google Drive | Multi-color triangle (existing) | `rgba(251,188,5,0.1)` |
| Apple | Apple logo path | `rgba(255,255,255,0.06)` |
| PandaDoc | Real brand SVG (green `#248567` square, white interlocking circles) | — (icon is self-contained) |
| Pipedrive | Black square with white centered "p" (margin-top: -4px for optical centering) | `#000000` |

**Backend wiring:**
- 9 of 11 integrations already fully wired via existing `jarvis.setProviderKey()` and `jarvis.getConnectors()` systems
- PandaDoc + Pipedrive: add as new entries to the provider system — same `setProviderKey()`/`removeProviderKey()`/`testProvider()` flow
- Claude Code: add as new entry to CLOUD_PROVIDERS array
- No new backend code needed — all use existing save/test/remove infrastructure

**Settings.jsx changes:**
- Remove separate `providers` and `connectors` tab entries
- Add single `connections` tab entry pointing to `ConnectionsPanel`

### 4. Light mode for Connections page

The unified Connections page must also look good in light mode. The global CSS variable fixes (section 1) handle most of it. Additionally:
- Brand icon backgrounds should work on both `#eaecf0` (light) and `#13141b` (dark) backgrounds
- The status bar, category dividers, and card borders all use CSS variables that will auto-adjust
- Pipedrive's black icon square works on both backgrounds
- PandaDoc's green square works on both backgrounds

## Out of Scope

- Backend API integration for PandaDoc/Pipedrive (calling their APIs — just key storage)
- Dark mode CSS variable changes (already readable)
- Redesigning card layouts or content on Work page
- Other pages beyond Work and Settings

## Testing

- Toggle between light and dark mode — verify all cards, text, borders are readable in both
- Verify CalendarRail events are readable in light mode with accent borders
- Verify all Connections page cards render correctly with real brand icons
- Verify API key input shows for unconnected cards and hides when connected
- Verify existing connected services (Anthropic, OpenAI, Google, Gmail, etc.) still work after the merge
- Verify PandaDoc/Pipedrive can save and test API keys
- Check that dark mode is not regressed
