# Sales Command Center Revamp

**Date:** 2026-04-14
**Status:** Approved
**Branch:** codex/jarvis-phase-3

## Problem

The Sales tab has 17+ panels in a vertical scroll — cluttered, unfocused, and hard to parse. Email data is wired to the wrong table. Deal age and scoring don't exist. The page is functional but not usable as a daily command center.

## Solution

Rebuild the Sales tab as a 3-column layout where pipeline, proposals, emails, calendar, follow-ups, and leads are all visible at once. Fix data wiring so everything that's connected actually shows up. Move strategic/analytics panels to a Playbook tab. Tony Stark aesthetic — dark, clean, precise, 2026-grade UI.

## Architecture

### Sales Tab — 3-Column Layout

**Stats Bar (top):** Pipeline value, active deals, overdue count, proposals out, close forecast, sync status indicator. Sales/Playbook tab switcher on the right.

**Column 1 — Pipeline:** Deals grouped by stage (Proposal → Follow-up → Negotiation → Demo/Visit → Signing). Each stage has a colored top border and deal/value count. Each deal card shows:
- Company name + contact name + industry
- Deal value (prominent)
- AGE badge: days since `deal.add_time`, color-coded (green <7d, amber 7-21d, red >21d)
- SCORE badge: 0-100, computed from engagement signals
- Signal chips: "Proposal viewed 2x", "Email replied", "No response 5d", "Demo today", etc.
- Click → opens DealRoomPanel slide-out (unchanged)

**Column 2 — Proposals + Emails:**

Proposals section:
- List of all proposals from Supabase `proposals` table
- Each row: deal name, sent date, annual value, status badge (Draft/Sent/Viewed/Accepted/Rejected)
- View count when available
- "+ New" button opens ProposalGenerator modal

Emails section:
- **Read from `email_triage` table** (NOT `communications` — this is the fix)
- Each email shows IN/OUT direction badge (derived: from your domain = OUT, else IN)
- Auto-link to deal by matching contact email to deal contacts
- Unmatched inbound emails flagged as "New Lead (unmatched)"
- Green dot + "Live · syncs every 15m" indicator
- Click email → expand preview, draft reply, open linked deal

**Column 3 — Calendar + Follow-ups + Leads:**

Calendar:
- Today's events from Google Calendar (via jarvisd `/connectors/gcal/events`)
- Color-coded left border per event type
- Shows meeting link, contact, deal value when linked

Follow-ups:
- From Supabase `follow_ups` table, ordered by due date
- Red = overdue, amber = due today, green = upcoming
- Badge showing count due

Leads:
- From Pipedrive via CRM hook
- Dot color: green (hot) / amber (warm) / gray (cold)
- Shows order volume, location, research status
- Click → LeadDetailPanel slide-out (unchanged)

### Deal Room Slide-Out (Unchanged)

Triggered by clicking any deal card. Contains all 8 existing panels:
1. Proposals — generate, preview, send, track
2. Quote Calculator — pricing from playbook rates
3. Communications — full email/call history
4. Email Templates — quick-access drafts
5. Documents — contracts, attachments
6. Deal Comparison — side-by-side analysis
7. Timeline — stage history + milestones
8. Follow-ups — scheduled actions for this deal

### Playbook Tab (New)

Strategic panels moved here from the Sales scroll:
1. Revenue Goal — monthly/quarterly targets + progress
2. Revenue Forecast — probability-weighted pipeline
3. Activity Scoring — engagement heatmap
4. Win/Loss Journal — closed deal analysis
5. Weekly Report — auto-generated summary
6. JARVIS Briefings — intelligence insights
7. Pricing Patterns — won deal rate analysis (from 3PL pricing playbook)
8. Email Effectiveness — open/reply rates by template

## Data Wiring Fixes

### 1. Email Source Fix
- **Current:** `EmailInbox.jsx` reads from `communications` table
- **Fix:** Read from `email_triage` table (where the `email_triage` skill writes every 15 min)
- Derive direction: compare `from` field against user's domain (`3plcenter.com`, `eddisammy@gmail.com`)

### 2. Deal Age
- Compute from Pipedrive `add_time` field (already available in CRM data)
- `age = Math.floor((now - add_time) / 86400000)` days
- Color: green <7d, amber 7-21d, red >21d

### 3. Deal Score
- Formula: weighted sum of engagement signals
  - Email reply received: +20
  - Proposal viewed: +15 per view (cap 30)
  - Meeting scheduled: +15
  - Meeting attended: +10
  - Response within 24h: +10
  - Stage advanced recently: +10
  - Base by stage: Signing=30, Negotiation=20, Follow-up=10, Proposal=5
  - Penalty: -5 per week of silence
- Normalize to 0-100
- Color: green ≥70, amber 40-69, red <40

### 4. Calendar Caching
- Currently: on-demand fetch, no persistence
- Fix: Add calendar event fetch to the existing data flow in `useOpsSupa` or `useCRM`
- Calendar data already comes from jarvisd `/today` endpoint — just needs to render properly in the right column

## Component Changes

| Component | Action | Notes |
|-----------|--------|-------|
| `SalesDashboard.jsx` | **Rewrite** | 3-column grid layout, stats bar |
| `PipelineBoard.jsx` | **Rewrite** | Vertical list by stage, deal cards with age+score |
| `EmailInbox.jsx` | **Rewrite** | Read email_triage, IN/OUT badges, deal linking |
| `StatsBar.jsx` | **New** | Top metrics strip |
| `PlaybookTab.jsx` | **New** | Container for 8 strategic panels |
| `DealRoomPanel.jsx` | **Keep** | No changes |
| `LeadDetailPanel.jsx` | **Keep** | No changes |
| `ProposalGenerator.jsx` | **Keep** | No changes |
| `CommandBriefing.jsx` | **Remove from Sales** | Absorbed into Pipeline view (signals on deal cards) |
| `RevenueGoal.jsx` | **Move** | → Playbook tab |
| `RevenueForecast.jsx` | **Move** | → Playbook tab |
| `ActivityScoring.jsx` | **Move** | → Playbook tab |
| `WinLossJournal.jsx` | **Move** | → Playbook tab |
| `WeeklyReport.jsx` | **Move** | → Playbook tab |
| `BriefingsPanel.jsx` | **Move** | → Playbook tab |
| `ProposalList.jsx` | **Absorb** | Into column 2 proposals section |
| `CommunicationLog.jsx` | **Keep** | Inside Deal Room only |
| `DocumentVault.jsx` | **Keep** | Inside Deal Room only |
| `EmailTemplates.jsx` | **Keep** | Inside Deal Room only |
| `DealComparison.jsx` | **Keep** | Inside Deal Room only |
| `DealTimeline.jsx` | **Keep** | Inside Deal Room only |
| `QuoteCalculator.jsx` | **Keep** | Inside Deal Room only |
| `CalendarRail.jsx` | **Absorb** | Into column 3 calendar section |
| `FollowUpStrip` | **Absorb** | Into column 3 follow-ups section |
| `ModeBar.jsx` | **Keep** | Sales/Playbook tabs (remove Trading/Build — those are separate pages) |
| `QuickAddOps.jsx` | **Keep** | Bottom bar, + Deal / + Follow-up |

## Visual Design

- Dark base: `#0d1117` → `#131820` gradient
- Stage colors: Proposal=#42a5f5, Follow-up=#ffa726, Negotiation=#ffd54f, Demo=#81c784, Signing=#4caf50
- Cards: `rgba(255,255,255,0.025)` background, `rgba(255,255,255,0.05)` border, 8px radius
- Hover: subtle background lift to `rgba(255,255,255,0.05)`
- Text: white for primary, `rgba(255,255,255,0.35)` for secondary
- Badges: colored background at 10-15% opacity with matching text
- No glitch effects, no scan lines — smooth, clean, flowing transitions
- Tony Stark aesthetic: precision, information density without clutter, subtle glow accents

## Responsive

- Desktop (>1280px): full 3-column layout
- Tablet (768-1280px): 2 columns (pipeline + proposals/email), calendar below
- Mobile (<768px): single column stack, collapsible sections

## What's NOT Changing

- Data hooks: `useCRM.js`, `useOpsSupa.js` — same API, just reading additional fields
- JARVIS daemon: no backend changes needed
- Pipedrive sync: already working
- Gmail sync: already running every 15 min
- Google Calendar: already connected
- Approval gateway: unchanged
- All slide-out panels: DealRoom, LeadDetail — unchanged
- ProposalGenerator modal: unchanged

## Mockups

Visual mockups saved to: `.superpowers/brainstorm/88001-1776214435/content/final-design.html`
