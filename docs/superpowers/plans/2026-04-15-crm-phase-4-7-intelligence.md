# CRM Phase 4-7: Scoring + Jarvis Assist + Operator + Learning

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the CRM operating system with quick actions, pipeline economics, voice-to-CRM, win/loss post-mortem, email draft flow, call prep, and learning dashboard.

**Architecture:** Frontend components that use existing Supabase tables and scoring utilities. Jarvisd skill integration points are stubbed where the daemon skill doesn't exist yet — the UI creates the right data structures so skills can plug in later.

**Tech Stack:** React JSX, Supabase, Tailwind CSS jarvis tokens, Framer Motion, lucide-react.

---

## Task 1: Quick Actions — Hover Row Buttons

Create `src/components/sales/QuickActions.jsx` — hover overlay on lead/deal rows with action buttons (Call, Email, Log Call, Note, Approve, Snooze, Convert). Integrate into LeadRow and PipelineBoard DealCard.

## Task 2: Pipeline Economics Strip

Create `src/components/sales/PipelineEconomics.jsx` — shows est. monthly revenue, annual value, est. margin, time-to-close on DealRoomPanel header. Computed from deal.volumes + proposal pricing.

## Task 3: Win/Loss Post-Mortem

Create `src/components/sales/WinLossForm.jsx` — structured form when deal marked Won/Lost. Primary reason, what worked, what didn't, lost to whom, what you'd change. Saves to win_loss_reviews table.

## Task 4: Email Draft Flow

Create `src/components/sales/EmailDraftFlow.jsx` — when NBA says "Draft Email", creates an approval record with AI-generated draft content (using jarvis.runSkill or template). Shows inline in the Approvals tab. Wire into NBAModule onAction.

## Task 5: Call Prep Panel

Create `src/components/sales/CallPrepPanel.jsx` — pre-call summary pulled from research packet + deal data + recent activity. Shows key talking points, unanswered questions, objections to address. Triggered from NBA "PREP FOR CALL".

## Task 6: Voice-to-CRM Integration

Add mic button to LeadDetailPanel and DealRoomPanel headers. Uses existing VoiceButton/useVoice. On transcription complete, creates an activity (type=call, body=transcript) and a note. Wire to jarvis.runSkill("call_summary") for structured extraction.

## Task 7: Learning Dashboard

Create `src/components/sales/LearningDashboard.jsx` — new panel in PlaybookTab. Shows: edit patterns (what you change most), win rate by competitor, win rate by lead source, avg deal cycle, close rate by stage, proposal edit frequency. Reads from learning_events + win_loss_reviews + deals.

## Task 8: Build Verification + Polish

Full build test, fix any issues, verify all tabs and modes work.
