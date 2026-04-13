# JARVIS Autonomous Agent — Full Roadmap

**Vision:** JARVIS operates like Tony Stark's AI — a real personal agent that can search, buy, book, email, manage, research, and take action 24/7 without downtime. Every person from a CEO to a McDonald's worker can use it to make their life easier.

**Date:** 2026-04-12

---

## What You Have Today

| Capability | Status | How |
|---|---|---|
| Chat with AI | Working | Claude CLI ($0 subscription) |
| Web search | Working | CLI `--allowedTools WebSearch` |
| Browse websites | Built, not wired to chat | Playwright headless browser |
| Read email (Gmail) | Working | Google OAuth connector |
| Read calendar | Working | Google Calendar API |
| Read Google Drive | Working | Google Drive API |
| CRM data (Pipedrive) | Connected | API key |
| Local AI (Ollama) | Running | 7 models including custom jarvis model |
| Approval gateway | Built | High-risk actions require user approval |
| n8n workflows | Connected | Automation platform |
| Scheduled agents | Built | Cron triggers in jarvisd |

---

## Phase 1: JARVIS Can Search & Research (DONE)

- Web search via CLI ✅
- Browse specific URLs via Playwright ✅
- Extract content from pages ✅

---

## Phase 2: JARVIS Can Communicate

**Goal:** JARVIS sends emails, replies to threads, drafts proposals — with approval for anything going out.

### 2A: Send Emails
- **What:** "JARVIS, email Alex the contract update"
- **How:** Gmail API already connected with compose scope. Wire `jarvis.sendEmail()` → drafts in Gmail, shows in approval gateway, sends on approval.
- **Files:** `jarvisd/src/skills/email_drafter.ts` (exists), wire to chat intent
- **Approval:** All outbound emails require approval unless sender rule says otherwise

### 2B: Reply to Email Threads
- **What:** "JARVIS, reply to Alex's last email saying we'll have the contract by Friday"
- **How:** Gmail API `threads.get()` → draft reply → approval → send
- **Files:** Extend email_drafter skill with thread context

### 2C: Slack/SMS Integration
- **What:** "JARVIS, text my wife I'm running late" / "JARVIS, send the team a Slack update"
- **How:** Twilio for SMS, Slack webhook for messages. Both via n8n workflows.
- **n8n:** Create "Send SMS" and "Send Slack" workflows, trigger from jarvisd

---

## Phase 3: JARVIS Can Manage Your Schedule

**Goal:** JARVIS creates, moves, cancels events and manages your time.

### 3A: Create Calendar Events
- **What:** "JARVIS, schedule a call with Alex tomorrow at 2pm"
- **How:** Google Calendar API `events.insert()`. Needs `calendar.events` write scope (re-auth once).
- **Smart:** JARVIS checks your calendar for conflicts before booking.

### 3B: Reschedule & Cancel
- **What:** "JARVIS, push my 2pm to 3pm" / "Cancel the site visit"
- **How:** `events.patch()` / `events.delete()` via Calendar API

### 3C: Smart Scheduling
- **What:** "JARVIS, find a 30-minute slot this week for a call with the Beyond Oil team"
- **How:** Query free/busy API → propose options → user picks → create event + send invites

---

## Phase 4: JARVIS Can Sell (CRM Actions)

**Goal:** JARVIS manages your Pipedrive pipeline — creates deals, logs activities, moves stages, researches leads.

### 4A: Create & Update Deals
- **What:** "JARVIS, add a new deal for GreenJeeva, $50k, just had the site visit"
- **How:** Pipedrive API `deals.create()` / `deals.update()`. Already connected.
- **Files:** `jarvisd/src/lib/providers/pipedrive.ts` (exists)

### 4B: Log Activities & Notes
- **What:** "JARVIS, log that I called Alex today and he's interested"
- **How:** Pipedrive `activities.create()` + `notes.create()`

### 4C: Lead Research
- **What:** "JARVIS, research this company: Beyond Oil"
- **How:** Web search → extract company info → create Pipedrive contact with notes
- **Files:** `jarvisd/src/skills/lead_research.ts` (exists)

### 4D: Auto Follow-up Reminders
- **What:** JARVIS proactively says "You haven't followed up with GreenJeeva in 5 days. Want me to draft an email?"
- **How:** Cron job checks Pipedrive for stale deals → generates reminder → approval → send

---

## Phase 5: JARVIS Can Book Reservations

**Goal:** JARVIS books restaurants, flights, hotels, appointments.

### 5A: Restaurant Reservations
- **What:** "JARVIS, book a table for 2 at Nobu on Friday at 7pm"
- **How:** OpenTable/Resy API if available, OR Playwright browser agent fills the booking form automatically.
- **Fallback:** If no API, JARVIS uses Playwright to navigate OpenTable → search → select → fill form → screenshot for confirmation.

### 5B: Flight & Hotel Search
- **What:** "JARVIS, find me a flight to LA next Tuesday, return Friday"
- **How:** Google Flights via Playwright scraping, or Skyscanner API. Present options, user picks, JARVIS books.
- **Phase 1:** Search and present options
- **Phase 2:** Complete booking with stored payment

### 5C: Appointment Booking
- **What:** "JARVIS, book a haircut at the usual place for Saturday morning"
- **How:** If business has online booking (Calendly, Acuity, etc.) → Playwright fills form. Otherwise, JARVIS drafts a text/email to the business.

---

## Phase 6: JARVIS Can Buy Things

**Goal:** JARVIS handles purchases with your approval.

### 6A: Online Shopping
- **What:** "JARVIS, order more printer paper from Amazon"
- **How:** Playwright → Amazon → search → add to cart → screenshot cart → approval → checkout
- **Safety:** ALWAYS requires approval before any payment. Shows screenshot of cart + total.

### 6B: Reorder & Subscriptions
- **What:** "JARVIS, reorder my usual coffee from last month"
- **How:** Memory stores past orders. Playwright replays the order flow. Approval before checkout.

### 6C: Price Monitoring
- **What:** "JARVIS, watch this item and buy it when it drops below $50"
- **How:** Cron job checks price via Playwright scrape → triggers purchase workflow when condition met → approval.

---

## Phase 7: JARVIS Runs 24/7

**Goal:** JARVIS doesn't sleep. It monitors, acts, and alerts around the clock.

### 7A: Scheduled Intelligence
- **What:** Morning brief (6am), midday check (12pm), end-of-day review (6pm)
- **How:** Cron triggers in jarvisd (partially built). Extend with more schedules.

### 7B: Event-Driven Actions
- **What:** New email arrives → JARVIS triages. Deal stage changes → JARVIS logs. Calendar conflict detected → JARVIS alerts.
- **How:** Webhooks from Gmail (push notifications), Pipedrive webhooks, Calendar watch API. Route through n8n → jarvisd event bus.

### 7C: Proactive Suggestions
- **What:** JARVIS notices patterns and suggests actions: "You have 3 stale deals. Want me to follow up?"
- **How:** Nightly cron analyzes CRM + calendar + email data → generates suggestions → queues for morning brief.

### 7D: Mobile Access
- **What:** Talk to JARVIS from your phone
- **How:** Deploy jarvisd to a cloud server (Fly.io/Railway) + expose via API. Build a simple mobile web app or Telegram/WhatsApp bot.

---

## Phase 8: JARVIS Learns & Adapts

**Goal:** JARVIS gets smarter over time.

### 8A: Preference Learning
- **What:** JARVIS remembers you prefer window seats, your usual coffee order, your preferred meeting times
- **How:** Memory graph (already built) + episodic memory. Every action stores context.

### 8B: Workflow Recording
- **What:** "JARVIS, watch how I do this, then do it yourself next time"
- **How:** Playwright records user actions as a replayable script. Stored in skills registry.

### 8C: Decision Patterns
- **What:** JARVIS learns which approvals you always accept → auto-approves low-risk repeats
- **How:** Approval history analysis. After N consecutive approvals of same type → suggest auto-approve rule.

---

## Implementation Priority

| Priority | Phase | Effort | Impact |
|---|---|---|---|
| **NOW** | 2A: Send emails | 1 session | High — most requested action |
| **NOW** | 3A: Create calendar events | 1 session | High — schedule management |
| **NEXT** | 4A-B: CRM create/update/log | 1 session | High — sales workflow |
| **NEXT** | 2C: SMS/Slack | 1 session | Medium — communication |
| **SOON** | 5A: Restaurant bookings | 2 sessions | Medium — lifestyle |
| **SOON** | 7A-B: 24/7 scheduled + webhooks | 2 sessions | High — autonomy |
| **LATER** | 5B: Flights/hotels | 2-3 sessions | Medium — complex |
| **LATER** | 6A-C: Purchasing | 2-3 sessions | Medium — needs payment security |
| **LATER** | 7D: Mobile access | 1 session | High — access everywhere |
| **FUTURE** | 8A-C: Learning | Ongoing | High — compounds over time |

---

## Architecture: How It All Connects

```
User (Home page chat / Mobile / Voice)
        ↓
   JarvisChat (intent parser)
        ↓
   jarvisd /ask endpoint
        ↓
   Claude CLI (subscription, $0)
    ├── WebSearch tool (web queries)
    ├── Browser tool (Playwright — book, buy, fill forms)
    ├── Gmail tool (read/send/reply)
    ├── Calendar tool (read/create/modify)
    ├── CRM tool (Pipedrive CRUD)
    ├── SMS tool (Twilio via n8n)
    └── Slack tool (webhook via n8n)
        ↓
   Approval Gateway (high-risk actions)
        ↓
   Action Executed → Result shown in chat
```

Every capability is a "tool" that Claude CLI can call. The more tools we wire, the more JARVIS can do. All on your subscription.

---

## The Iron Man Standard

Every feature should pass this test:

> "Could Tony Stark ask JARVIS to do this while walking through his lab?"

If yes, build it. If JARVIS would say "I can't do that, sir" — that's a gap to fill.
