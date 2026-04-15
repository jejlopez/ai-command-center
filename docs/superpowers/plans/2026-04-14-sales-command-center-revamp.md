# Sales Command Center Revamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Sales tab as a clean 3-column layout with proper data wiring, deal scoring, and a separate Playbook tab — zero functionality lost.

**Architecture:** Rewrite `SalesDashboard.jsx` as a 3-column grid (Pipeline | Proposals+Emails | Calendar+Actions). Add `jarvis.emailTriage()` API call, compute deal age/score client-side, create `PlaybookTab.jsx` to hold all strategic panels. Keep all slide-out panels (DealRoom, LeadDetail) unchanged.

**Tech Stack:** React, Framer Motion, Tailwind CSS, jarvisd REST API (localhost:9999), Supabase, useCRM/useOpsSupa hooks

**Spec:** `docs/superpowers/specs/2026-04-14-sales-command-center-revamp.md`

---

### Task 1: Add emailTriage API method to jarvis.js

**Files:**
- Modify: `src/lib/jarvis.js:181-187`

- [ ] **Step 1: Add emailTriage and emailTriageStats methods**

In `src/lib/jarvis.js`, after the existing email methods (around line 187), add:

```javascript
  // Email triage (classified inbox from daemon)
  emailTriage:      (limit)             => get(`/email/triage?limit=${limit ?? 50}`),
  emailTriageStats: ()                  => get("/email/triage/stats"),
```

- [ ] **Step 2: Verify the daemon endpoint responds**

Run: `curl -s http://localhost:9999/email/triage?limit=5 | head -c 200`
Expected: JSON array of email triage objects (or empty array if daemon isn't running — that's fine)

- [ ] **Step 3: Commit**

```bash
git add src/lib/jarvis.js
git commit -m "feat: add emailTriage API methods to jarvis client"
```

---

### Task 2: Create deal scoring utility

**Files:**
- Create: `src/lib/dealScore.js`

- [ ] **Step 1: Create the scoring and age utility**

```javascript
// Deal age and engagement score utilities.
// Score formula: base stage points + engagement signals - silence penalty.

const STAGE_BASE = {
  "Signing Contract": 30,
  "Demo Scheduled/Site Visit": 25,
  "Negotiations Started": 20,
  "Follow up on proposal": 10,
  "Proposal": 5,
};

export function dealAge(deal) {
  const added = deal.add_time || deal.created_at;
  if (!added) return null;
  return Math.floor((Date.now() - new Date(added).getTime()) / 86_400_000);
}

export function ageColor(days) {
  if (days == null) return "ghost";
  if (days <= 7) return "success";
  if (days <= 21) return "warning";
  return "danger";
}

export function dealScore(deal) {
  let score = 0;

  // Base by stage (normalize trimmed keys)
  const stage = (deal.stage_name || deal.stage || "").trim();
  for (const [key, pts] of Object.entries(STAGE_BASE)) {
    if (stage.startsWith(key) || stage === key) {
      score += pts;
      break;
    }
  }

  // Engagement signals
  if (deal.email_replied) score += 20;
  if (deal.pandadoc_viewed) score += Math.min((deal.pandadoc_view_count || 1) * 15, 30);
  if (deal.next_activity && new Date(deal.next_activity) >= new Date()) score += 15;
  if (deal.meeting_attended) score += 10;
  if (deal.responded_within_24h) score += 10;
  if (deal.stage_advanced_recently) score += 10;

  // Silence penalty
  const lastActivity = deal.last_activity_date || deal.update_time;
  if (lastActivity) {
    const silentDays = Math.floor((Date.now() - new Date(lastActivity).getTime()) / 86_400_000);
    const silentWeeks = Math.floor(silentDays / 7);
    score -= silentWeeks * 5;
  }

  return Math.max(0, Math.min(100, score));
}

export function scoreColor(score) {
  if (score >= 70) return "success";
  if (score >= 40) return "warning";
  return "danger";
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dealScore.js
git commit -m "feat: add deal age and scoring utility"
```

---

### Task 3: Create StatsBar component

**Files:**
- Create: `src/components/sales/StatsBar.jsx`

- [ ] **Step 1: Build the stats bar**

```jsx
// StatsBar — top metrics strip for the Sales tab.

import { motion } from "framer-motion";
import { fadeIn } from "../../lib/motion.js";

function Stat({ label, value, color }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-jarvis-muted uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${color || "text-jarvis-ink"}`}>{value}</span>
    </div>
  );
}

export function StatsBar({ deals = [], proposals = [], followUps = [], activeTab, onTabChange }) {
  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);
  const overdue = followUps.filter(f => f.due_date && new Date(f.due_date) < new Date()).length;
  const proposalsOut = proposals.filter(p => p.status === "sent" || p.status === "review_needed").length;

  // Estimate close this month: deals in signing/negotiation
  const closingStages = ["Signing Contract", "Negotiations Started"];
  const closingValue = deals
    .filter(d => closingStages.some(s => (d.stage_name || d.stage || "").trim().startsWith(s)))
    .reduce((s, d) => s + (d.value || 0), 0);

  const fmt = (v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="show"
      className="flex items-center justify-between px-5 py-3 border-b border-jarvis-border bg-jarvis-surface/50"
    >
      <div className="flex gap-7">
        <Stat label="Pipeline" value={fmt(totalValue)} />
        <Stat label="Deals" value={deals.length} />
        <Stat label="Overdue" value={overdue} color={overdue > 0 ? "text-jarvis-danger" : undefined} />
        <Stat label="Proposals" value={proposalsOut} color="text-jarvis-primary" />
        <Stat label="Closing" value={fmt(closingValue)} color="text-jarvis-success" />
      </div>

      <div className="flex gap-1.5 items-center">
        <button
          onClick={() => onTabChange("sales")}
          className={`text-[11px] px-3.5 py-1.5 rounded-lg transition font-medium ${
            activeTab === "sales"
              ? "bg-jarvis-primary/15 text-jarvis-primary"
              : "text-jarvis-muted hover:text-jarvis-ink"
          }`}
        >
          Sales
        </button>
        <button
          onClick={() => onTabChange("playbook")}
          className={`text-[11px] px-3.5 py-1.5 rounded-lg transition font-medium ${
            activeTab === "playbook"
              ? "bg-jarvis-warning/15 text-jarvis-warning"
              : "text-jarvis-muted hover:text-jarvis-ink"
          }`}
        >
          Playbook
        </button>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sales/StatsBar.jsx
git commit -m "feat: add StatsBar component for Sales page"
```

---

### Task 4: Rewrite PipelineBoard as vertical list with age + score

**Files:**
- Modify: `src/components/sales/PipelineBoard.jsx` (full rewrite)

- [ ] **Step 1: Rewrite PipelineBoard**

```jsx
// Pipeline — deals grouped by stage, vertical list. Each deal shows age + score.

import { motion, AnimatePresence } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { dealAge, ageColor, dealScore, scoreColor } from "../../lib/dealScore.js";

const STAGE_ORDER = [
  { key: "Proposal",                  label: "Proposal",    border: "border-blue-400"   },
  { key: "Follow up on proposal",     label: "Follow-up",   border: "border-jarvis-warning" },
  { key: "Negotiations Started",      label: "Negotiation", border: "border-yellow-400" },
  { key: "Demo Scheduled/Site Visit", label: "Demo/Visit",  border: "border-green-400"  },
  { key: "Signing Contract",          label: "Signing",     border: "border-jarvis-success" },
];

const COLOR_MAP = {
  success: "text-jarvis-success bg-jarvis-success/10",
  warning: "text-jarvis-warning bg-jarvis-warning/10",
  danger:  "text-jarvis-danger bg-jarvis-danger/10",
  ghost:   "text-jarvis-muted bg-white/5",
};

function Badge({ label, value, colorKey }) {
  return (
    <div className={`text-center px-1.5 py-0.5 rounded ${COLOR_MAP[colorKey] || COLOR_MAP.ghost}`}>
      <div className="text-[8px] text-jarvis-muted/60 uppercase">{label}</div>
      <div className="text-[11px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function DealCard({ deal, onClick }) {
  const age = dealAge(deal);
  const score = dealScore(deal);
  const isOverdue = deal.next_activity && deal.next_activity < new Date().toISOString().slice(0, 10);

  // Collect signal chips
  const signals = [];
  if (deal.pandadoc_viewed) signals.push({ text: `Proposal viewed${deal.pandadoc_view_count > 1 ? ` ${deal.pandadoc_view_count}x` : ""}`, color: "text-jarvis-primary bg-jarvis-primary/10" });
  if (deal.email_replied) signals.push({ text: "Email replied", color: "text-jarvis-success bg-jarvis-success/10" });
  if (isOverdue) signals.push({ text: "Overdue", color: "text-jarvis-danger bg-jarvis-danger/10" });
  if (deal.engagement === "hot") signals.push({ text: "Hot", color: "text-jarvis-warning bg-jarvis-warning/10" });

  // Next activity signal
  if (deal.next_activity && !isOverdue) {
    const actDate = new Date(deal.next_activity);
    const today = new Date();
    if (actDate.toDateString() === today.toDateString()) {
      signals.push({ text: `Today ${actDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`, color: "text-jarvis-warning bg-jarvis-warning/10" });
    }
  }

  // Silence signal
  const lastAct = deal.last_activity_date || deal.update_time;
  if (lastAct) {
    const silent = Math.floor((Date.now() - new Date(lastAct).getTime()) / 86_400_000);
    if (silent >= 5) signals.push({ text: `No response ${silent}d`, color: "text-jarvis-danger bg-jarvis-danger/10" });
  }

  return (
    <motion.button
      variants={stagger.item}
      onClick={() => onClick?.(deal)}
      className="w-full text-left p-2.5 rounded-lg border border-jarvis-border bg-jarvis-surface hover:bg-jarvis-surface-hover transition-all"
    >
      <div className="flex justify-between items-center">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-jarvis-ink font-medium truncate">{deal.title || deal.org_name}</div>
          <div className="text-[10px] text-jarvis-muted truncate">
            {deal.contact_name || deal.person_name}{deal.org_name && deal.title ? ` · ${deal.org_name}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-sm font-bold text-jarvis-ink tabular-nums">
            {deal.value > 0 ? `$${(deal.value / 1000).toFixed(0)}K` : "—"}
          </span>
          {age != null && <Badge label="AGE" value={`${age}d`} colorKey={ageColor(age)} />}
          <Badge label="SCORE" value={score} colorKey={scoreColor(score)} />
        </div>
      </div>
      {signals.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {signals.map((s, i) => (
            <span key={i} className={`text-[8px] px-1.5 py-0.5 rounded ${s.color}`}>{s.text}</span>
          ))}
        </div>
      )}
    </motion.button>
  );
}

function StageGroup({ stage, deals, onOpenDeal }) {
  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div className="mb-3">
      <div className={`flex justify-between items-center mb-1.5 pb-1 border-b-2 ${stage.border}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-jarvis-muted">{stage.label}</span>
        <span className="text-[10px] text-jarvis-muted/50">{deals.length} · ${(totalValue / 1000).toFixed(0)}K</span>
      </div>
      <div className="flex flex-col gap-1">
        {deals.map(d => (
          <DealCard key={d.id} deal={d} onClick={onOpenDeal} />
        ))}
        {deals.length === 0 && (
          <div className="text-[9px] text-jarvis-muted/30 text-center py-3">No deals</div>
        )}
      </div>
    </div>
  );
}

export function PipelineBoard({ pipeline, onOpenDeal }) {
  if (!pipeline || Object.keys(pipeline).length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-xs text-jarvis-muted">No pipeline data. Connect Pipedrive in Settings.</div>
      </div>
    );
  }

  // Normalize stage keys (Pipedrive trailing spaces)
  const normalized = {};
  for (const [key, deals] of Object.entries(pipeline)) {
    const trimmed = key.trim();
    normalized[trimmed] = [...(normalized[trimmed] || []), ...(deals || [])];
  }

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      {STAGE_ORDER.map(stage => (
        <StageGroup key={stage.key} stage={stage} deals={normalized[stage.key] ?? []} onOpenDeal={onOpenDeal} />
      ))}
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sales/PipelineBoard.jsx
git commit -m "feat: rewrite PipelineBoard — vertical list with deal age + score"
```

---

### Task 5: Rewrite EmailInbox to read from email_triage with IN/OUT

**Files:**
- Modify: `src/components/ops/EmailInbox.jsx` (full rewrite)

- [ ] **Step 1: Rewrite EmailInbox**

```jsx
// EmailInbox — reads from jarvisd email_triage table (15-min Gmail sync).
// Shows IN/OUT direction, auto-links to deals by contact email.

import { useEffect, useState } from "react";
import { Mail, ChevronDown, ChevronUp } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const USER_DOMAINS = ["3plcenter.com", "eddisammy@gmail.com"];

function isOutbound(fromAddr) {
  if (!fromAddr) return false;
  const lower = fromAddr.toLowerCase();
  return USER_DOMAINS.some(d => lower.includes(d));
}

function linkToDeal(email, deals) {
  if (!email.from_addr || !deals?.length) return null;
  const addr = email.from_addr.toLowerCase();
  return deals.find(d => {
    const ce = (d.contact_email || d.person_email || "").toLowerCase();
    return ce && addr.includes(ce);
  });
}

const fmtDate = (s) => {
  if (!s) return "";
  const d = new Date(s);
  const now = new Date();
  const diffH = (now - d) / 3_600_000;
  if (diffH < 1) return `${Math.floor(diffH * 60)}m ago`;
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function EmailRow({ email, deal }) {
  const [expanded, setExpanded] = useState(false);
  const out = isOutbound(email.from_addr);

  return (
    <div className="border-b border-jarvis-border/30 last:border-0">
      <button
        className="w-full text-left py-2 px-1 hover:bg-jarvis-ghost/20 rounded transition"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-1.5">
          <span className={`text-[8px] font-semibold px-1 py-0.5 rounded mt-0.5 shrink-0 ${
            out
              ? "bg-jarvis-primary/15 text-jarvis-primary"
              : "bg-jarvis-success/15 text-jarvis-success"
          }`}>
            {out ? "OUT" : "IN"}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-jarvis-ink truncate flex-1">{email.subject || "(no subject)"}</span>
              <span className="text-[9px] text-jarvis-ghost shrink-0 ml-2">{fmtDate(email.created_at)}</span>
            </div>
            <div className="text-[10px] text-jarvis-muted truncate">{email.from_addr} — {email.snippet}</div>
            {deal && (
              <div className="text-[9px] text-jarvis-primary mt-0.5">→ {deal.title || deal.org_name} · ${(deal.value / 1000).toFixed(0)}K</div>
            )}
            {!deal && !out && email.category !== "newsletter" && email.category !== "junk" && (
              <div className="text-[9px] text-jarvis-warning mt-0.5">→ New Lead (unmatched)</div>
            )}
          </div>
          {expanded ? <ChevronUp size={10} className="text-jarvis-ghost shrink-0 mt-1" /> : <ChevronDown size={10} className="text-jarvis-ghost shrink-0 mt-1" />}
        </div>
      </button>
      {expanded && (
        <div className="pb-2 px-1">
          <div className="flex gap-1 mb-1">
            <span className={`text-[8px] px-1.5 py-0.5 rounded ${
              email.category === "urgent" ? "bg-jarvis-danger/10 text-jarvis-danger"
              : email.category === "action_needed" ? "bg-jarvis-warning/10 text-jarvis-warning"
              : "bg-white/5 text-jarvis-muted"
            }`}>
              {email.category}
            </span>
            {email.confidence > 0 && (
              <span className="text-[8px] text-jarvis-ghost">{Math.round(email.confidence * 100)}% conf</span>
            )}
          </div>
          <p className="text-[10px] text-jarvis-body leading-relaxed">{email.snippet}</p>
        </div>
      )}
    </div>
  );
}

export function EmailInbox({ deals = [] }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await jarvis.emailTriage(30);
        setEmails(Array.isArray(data) ? data : []);
      } catch {
        setEmails([]);
      } finally {
        setLoading(false);
      }
    }
    load();
    // Refresh every 5 minutes
    const interval = setInterval(load, 300_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Mail size={12} className="text-jarvis-primary" />
          <span className="text-[13px] font-semibold text-jarvis-ink">Emails</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-jarvis-success" />
          <span className="text-[10px] text-jarvis-muted">Live · 15m sync</span>
        </div>
      </div>

      {loading && <div className="text-[10px] text-jarvis-ghost animate-pulse">Loading emails…</div>}

      {!loading && emails.length === 0 && (
        <div className="text-[10px] text-jarvis-ghost">No emails synced yet. Connect Gmail in Settings.</div>
      )}

      {!loading && emails.length > 0 && (
        <div>
          {emails.map(e => (
            <EmailRow key={e.id} email={e} deal={linkToDeal(e, deals)} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ops/EmailInbox.jsx
git commit -m "feat: rewrite EmailInbox — reads email_triage, IN/OUT badges, deal linking"
```

---

### Task 6: Create PlaybookTab component

**Files:**
- Create: `src/components/sales/PlaybookTab.jsx`

- [ ] **Step 1: Create PlaybookTab**

```jsx
// PlaybookTab — strategic intelligence panels, viewed weekly.

import { motion } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { RevenueGoal } from "../ops/RevenueGoal.jsx";
import { RevenueForecast } from "../ops/RevenueForecast.jsx";
import { ActivityScoring } from "../ops/ActivityScoring.jsx";
import { WinLossJournal } from "../ops/WinLossJournal.jsx";
import { WeeklyReport } from "../ops/WeeklyReport.jsx";
import { BriefingsPanel } from "../ops/BriefingsPanel.jsx";
import { EmailTemplates } from "../ops/EmailTemplates.jsx";

export function PlaybookTab({ deals = [] }) {
  return (
    <motion.div
      className="p-5 overflow-y-auto h-full space-y-4"
      variants={stagger.container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueGoal deals={deals} />
        <RevenueForecast deals={deals} />
      </motion.div>

      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityScoring deals={deals} />
        <WinLossJournal deals={deals} />
      </motion.div>

      <motion.div variants={stagger.item}>
        <WeeklyReport />
      </motion.div>

      <motion.div variants={stagger.item}>
        <BriefingsPanel />
      </motion.div>

      <motion.div variants={stagger.item}>
        <EmailTemplates />
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sales/PlaybookTab.jsx
git commit -m "feat: add PlaybookTab — strategic panels for weekly review"
```

---

### Task 7: Rewrite SalesDashboard as 3-column layout

**Files:**
- Modify: `src/components/ops/SalesDashboard.jsx` (full rewrite)

This is the core task. The new SalesDashboard replaces the 17-panel vertical scroll with a 3-column grid.

- [ ] **Step 1: Rewrite SalesDashboard**

```jsx
// SalesDashboard — 3-column layout: Pipeline | Proposals+Email | Calendar+Actions.
// All existing functionality preserved, reorganized for visibility.

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { stagger, fadeIn } from "../../lib/motion.js";
import { PipelineBoard } from "../sales/PipelineBoard.jsx";
import { DealRoomPanel } from "../sales/DealRoomPanel.jsx";
import { LeadsSection } from "../sales/LeadsSection.jsx";
import { DealComparison } from "./DealComparison.jsx";
import { DealRoom } from "./DealRoom.jsx";
import { EmailInbox } from "./EmailInbox.jsx";
import { ProposalList } from "./ProposalList.jsx";
import { Calendar, Clock, Plus } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

// ---- Right column sub-components (inline, small) ----

function CalendarToday({ calendarEvents = [] }) {
  if (calendarEvents.length === 0) {
    return (
      <div className="text-[10px] text-jarvis-ghost py-2">No events today.</div>
    );
  }

  const borderColors = [
    "border-l-blue-400", "border-l-jarvis-warning", "border-l-jarvis-success",
    "border-l-jarvis-purple", "border-l-cyan-400",
  ];

  return (
    <div className="flex flex-col gap-1.5">
      {calendarEvents.map((ev, i) => {
        const time = ev.start_h != null
          ? `${ev.start_h}:${String(ev.start_m ?? 0).padStart(2, "0")}`
          : ev.start_time || "";
        return (
          <div key={i} className={`border-l-2 ${borderColors[i % borderColors.length]} pl-2`}>
            <div className="text-[11px] text-jarvis-ink">{time && `${time} — `}{ev.title || ev.summary}</div>
            {ev.location && <div className="text-[9px] text-jarvis-muted">{ev.location}</div>}
          </div>
        );
      })}
    </div>
  );
}

function FollowUpsColumn({ followUps = [], deals = [], onOpenDeal }) {
  const now = new Date();
  const due = followUps.filter(f => f.due_date && new Date(f.due_date) <= new Date(now.toDateString() + " 23:59:59"));
  const overdue = due.filter(f => new Date(f.due_date) < new Date(now.toDateString()));
  const today = due.filter(f => !overdue.includes(f));

  if (due.length === 0) {
    return <div className="text-[10px] text-jarvis-ghost py-2">No follow-ups due. Clear.</div>;
  }

  function FollowUpRow({ f, isOverdue }) {
    const linkedDeal = f.deal_id ? deals.find(d => d.id === f.deal_id) : null;
    return (
      <div
        className={`rounded-md px-2 py-1.5 border cursor-pointer transition hover:bg-jarvis-surface-hover ${
          isOverdue
            ? "border-jarvis-danger/20 bg-jarvis-danger/[0.03]"
            : "border-jarvis-warning/20 bg-jarvis-warning/[0.03]"
        }`}
        onClick={() => linkedDeal && onOpenDeal?.(linkedDeal)}
      >
        <div className="text-[10px] text-jarvis-ink">{f.contact_name || f.subject || "Follow-up"}</div>
        <div className={`text-[9px] ${isOverdue ? "text-jarvis-danger" : "text-jarvis-warning"}`}>
          {isOverdue ? `${Math.floor((now - new Date(f.due_date)) / 86_400_000)} days overdue` : "Due today"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {overdue.map(f => <FollowUpRow key={f.id} f={f} isOverdue />)}
      {today.map(f => <FollowUpRow key={f.id} f={f} isOverdue={false} />)}
    </div>
  );
}

function LeadsCompact({ leads = [], onRefresh }) {
  if (!leads || leads.length === 0) return null;

  const hot = leads.filter(l => l.fit_score === "hot");
  const warm = leads.filter(l => l.fit_score === "warm");
  const cold = leads.filter(l => l.fit_score === "cold" || !l.fit_score);

  const dotColor = (fit) => fit === "hot" ? "bg-jarvis-success" : fit === "warm" ? "bg-jarvis-warning" : "bg-jarvis-muted/30";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[12px] font-semibold text-jarvis-ink">Leads</span>
        <span className="text-[9px] text-jarvis-muted">
          <span className="text-jarvis-success">{hot.length}</span> ·{" "}
          <span className="text-jarvis-warning">{warm.length}</span> ·{" "}
          <span>{cold.length}</span>
        </span>
      </div>
      {[...hot, ...warm, ...cold].slice(0, 5).map(l => (
        <div key={l.id} className="flex items-center gap-1.5 py-1 cursor-pointer hover:bg-jarvis-ghost/20 rounded px-1 -mx-1 transition">
          <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${dotColor(l.fit_score)}`} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-jarvis-ink truncate">{l.title || l.org_name}</div>
            <div className="text-[9px] text-jarvis-muted truncate">
              {l.source || "New inbound"}
              {l.research && <span className="text-jarvis-primary ml-1">· Researched</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Main SalesDashboard ----

export function SalesDashboard({ ops, onRefresh }) {
  const { deals = [], followUps = [], proposals = [], comms = [], docs = [], intelligence, crm } = ops;
  const [crmDealOpen, setCrmDealOpen] = useState(null);
  const [openDeal, setOpenDeal] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const hasCRM = crm?.connected && (crm.deals?.length > 0 || Object.keys(crm.pipeline || {}).length > 0);
  const allDeals = hasCRM ? crm.deals : deals;
  const calendarEvents = ops.calendarEvents || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 3-column grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_280px] overflow-hidden">

        {/* COLUMN 1: Pipeline */}
        <div className="border-r border-jarvis-border/50 p-4 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-jarvis-ink">Pipeline</span>
            <button
              onClick={() => setCompareOpen(true)}
              className="text-[10px] text-jarvis-muted hover:text-jarvis-ink transition"
              title="Compare deals"
            >
              Compare
            </button>
          </div>

          {hasCRM ? (
            <PipelineBoard pipeline={crm.pipeline} onOpenDeal={setCrmDealOpen} />
          ) : (
            <div className="text-xs text-jarvis-muted text-center py-8">Connect Pipedrive to see pipeline.</div>
          )}
        </div>

        {/* COLUMN 2: Proposals + Emails */}
        <div className="border-r border-jarvis-border/50 p-4 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {/* Proposals */}
          <div className="mb-5">
            <ProposalList proposals={proposals} onRefresh={onRefresh} />
          </div>

          {/* Emails */}
          <EmailInbox deals={allDeals} />
        </div>

        {/* COLUMN 3: Calendar + Follow-ups + Leads */}
        <div className="p-4 overflow-y-auto bg-jarvis-surface/30" style={{ scrollbarWidth: "thin" }}>
          {/* Calendar */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar size={12} className="text-jarvis-muted" />
              <span className="text-[12px] font-semibold text-jarvis-ink">Today</span>
            </div>
            <CalendarToday calendarEvents={calendarEvents} />
          </div>

          {/* Follow-ups */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-jarvis-muted" />
                <span className="text-[12px] font-semibold text-jarvis-ink">Follow-ups</span>
              </div>
              {followUps.filter(f => f.due_date && new Date(f.due_date) <= new Date()).length > 0 && (
                <span className="text-[9px] bg-jarvis-danger/10 text-jarvis-danger px-1.5 py-0.5 rounded">
                  {followUps.filter(f => f.due_date && new Date(f.due_date) <= new Date()).length} due
                </span>
              )}
            </div>
            <FollowUpsColumn followUps={followUps} deals={allDeals} onOpenDeal={hasCRM ? setCrmDealOpen : setOpenDeal} />
          </div>

          {/* Leads */}
          {crm?.leads?.length > 0 && (
            <LeadsCompact leads={crm.leads} onRefresh={crm.refresh} />
          )}
        </div>
      </div>

      {/* Deal Comparison Modal */}
      {compareOpen && <DealComparison deals={allDeals} onClose={() => setCompareOpen(false)} />}

      {/* Deal Room — Supabase fallback */}
      {openDeal && <DealRoom dealId={openDeal.id} deal={openDeal} onClose={() => setOpenDeal(null)} />}

      {/* Deal Room Panel — CRM slide-out */}
      <AnimatePresence>
        {crmDealOpen && <DealRoomPanel deal={crmDealOpen} onClose={() => setCrmDealOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ops/SalesDashboard.jsx
git commit -m "feat: rewrite SalesDashboard — 3-column layout, all functionality preserved"
```

---

### Task 8: Update Work.jsx — integrate StatsBar and Playbook tab

**Files:**
- Modify: `src/views/Work.jsx`

- [ ] **Step 1: Update Work.jsx**

Replace the entire content of `src/views/Work.jsx`:

```jsx
import { useState } from "react";
import { useOpsSupa } from "../hooks/useOpsSupa.js";
import { useCRM } from "../hooks/useCRM.js";
import { ModeBar } from "../components/ops/ModeBar.jsx";
import { QuickAddOps } from "../components/ops/QuickAddOps.jsx";
import { SalesDashboard } from "../components/ops/SalesDashboard.jsx";
import { PlaybookTab } from "../components/sales/PlaybookTab.jsx";
import { StatsBar } from "../components/sales/StatsBar.jsx";
import { TradingDashboard } from "../components/ops/TradingDashboard.jsx";
import { BuildDashboard } from "../components/ops/BuildDashboard.jsx";

export default function Work() {
  const [mode, setMode] = useState("sales");
  const [salesTab, setSalesTab] = useState("sales");
  const crm = useCRM();

  const {
    deals, followUps, proposals, comms, docs,
    positions, watchlist, tradeJournal,
    projects, ships, tasks,
    calendarEvents, intelligence,
    loading, refresh,
    salesCtx, tradingCtx, buildCtx, badges,
  } = useOpsSupa();

  const mergedDeals = crm.deals.length > 0 ? crm.deals : deals;

  const ops = {
    deals: mergedDeals, followUps, proposals, comms, docs,
    positions, watchlist, tradeJournal,
    projects, ships, tasks,
    calendarEvents, intelligence, crm,
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Mode bar — Work page modes */}
      <ModeBar mode={mode} setMode={setMode} badges={badges} />

      {/* Sales sub-header: StatsBar with Sales/Playbook toggle */}
      {mode === "sales" && (
        <StatsBar
          deals={mergedDeals}
          proposals={proposals}
          followUps={followUps}
          activeTab={salesTab}
          onTabChange={setSalesTab}
        />
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-jarvis-muted animate-pulse">Loading…</div>
          </div>
        )}

        {!loading && mode === "sales" && salesTab === "sales" && (
          <SalesDashboard ops={ops} onRefresh={refresh} />
        )}
        {!loading && mode === "sales" && salesTab === "playbook" && (
          <PlaybookTab deals={mergedDeals} />
        )}
        {!loading && mode === "trading" && (
          <TradingDashboard ops={ops} onRefresh={refresh} />
        )}
        {!loading && mode === "build" && (
          <BuildDashboard ops={ops} onRefresh={refresh} />
        )}
      </div>

      {/* Quick add bar */}
      <QuickAddOps mode={mode} onRefresh={refresh} />
    </div>
  );
}
```

Note: `CalendarRail` and `ContextStrip` are removed from Work.jsx — calendar is now inside column 3 of SalesDashboard, and the context strip is replaced by StatsBar.

- [ ] **Step 2: Commit**

```bash
git add src/views/Work.jsx
git commit -m "feat: update Work — StatsBar, Playbook tab, remove CalendarRail/ContextStrip"
```

---

### Task 9: Visual polish pass — verify and test

**Files:**
- No new files — test existing changes

- [ ] **Step 1: Start dev server**

Run: `npm run dev` (or `bun dev` depending on project setup)

Verify:
1. Sales page loads with 3-column layout
2. StatsBar shows at top with correct numbers
3. Pipeline column shows deals with AGE and SCORE badges
4. Proposals section shows proposal list
5. Emails section shows classified emails from email_triage with IN/OUT badges
6. Calendar shows today's events in right column
7. Follow-ups show with overdue highlighting
8. Leads show with fit score dots
9. Sales/Playbook tab toggle works
10. Clicking a deal opens DealRoomPanel slide-out
11. All existing modals (DealComparison, ProposalGenerator) still work

- [ ] **Step 2: Test responsive behavior**

Resize browser:
- Desktop (>1280px): 3 columns visible
- Below 1024px: should collapse to single column (Tailwind `lg:` breakpoint)

- [ ] **Step 3: Fix any visual issues found during testing**

Common things to check:
- Column widths feel balanced
- Text is readable at all column widths
- Deal cards don't overflow
- Email rows don't overflow
- Scroll works independently in each column

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "polish: Sales Command Center visual fixes after testing"
```

---

### Task 10: Cleanup — remove unused imports from old layout

**Files:**
- Modify: `src/components/ops/SalesDashboard.jsx` (verify no dead imports)

- [ ] **Step 1: Check that all removed panels are still importable**

The following panels were MOVED to PlaybookTab, not deleted:
- `RevenueGoal` — imported in PlaybookTab
- `RevenueForecast` — imported in PlaybookTab
- `ActivityScoring` — imported in PlaybookTab
- `WinLossJournal` — imported in PlaybookTab
- `WeeklyReport` — imported in PlaybookTab
- `BriefingsPanel` — imported in PlaybookTab
- `EmailTemplates` — imported in PlaybookTab

The following are STILL used in SalesDashboard or DealRoom:
- `ProposalList` — used in column 2
- `EmailInbox` — used in column 2
- `DealRoom` — Supabase fallback
- `DealRoomPanel` — CRM slide-out
- `DealComparison` — modal
- `PipelineBoard` — column 1
- `LeadsSection` — referenced in LeadsCompact (compact version inline)

The following are NO LONGER imported in SalesDashboard (they were moved):
- `CommandBriefing` — signals absorbed into deal cards
- `CommunicationLog` — only in DealRoom
- `DocumentVault` — only in DealRoom
- `QuoteCalculator` — only in DealRoom

Verify no import errors:
Run: `npm run dev` — confirm no console errors about missing modules.

- [ ] **Step 2: Commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup unused imports after Sales revamp"
```
