# CRM Phase 3: Approvals Layer + Sales Command Briefing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Draft → Review → Approve → Send workflow, an approval queue, audit trail viewer, and the Sales Command Briefing. Every Jarvis-generated email/proposal goes through approval before sending.

**Architecture:** The `approvals` table already exists from Phase 1+2. This phase builds the UI components to list, review, edit, and decide on approvals. The audit_log table gets a viewer. The Sales Command Briefing aggregates NBA priorities + pending approvals into a daily stack at the top of the Sales mode.

**Tech Stack:** React JSX, Supabase, Tailwind CSS jarvis tokens, Framer Motion, lucide-react.

**Spec:** `docs/superpowers/specs/2026-04-15-crm-sales-operating-system-design.md` — Sections 6, 8 (Command Briefing)

---

## File Structure

### New files

```
src/hooks/useApprovalsSupa.js               — approvals CRUD + realtime
src/components/sales/ApprovalQueue.jsx       — list of pending approvals with preview
src/components/sales/ApprovalReview.jsx      — full review panel: draft, edit, comment, decide
src/components/sales/SalesCommandBriefing.jsx — daily priority stack at top of Sales mode
src/components/sales/AuditLogViewer.jsx      — audit trail display for a lead/deal
```

### Modified files

```
src/views/Work.jsx                           — add SalesCommandBriefing above tab content
src/components/sales/LeadDetailPanel.jsx     — wire Approvals tab to AuditLogViewer
src/components/sales/DealRoomPanel.jsx       — wire Approvals tab to AuditLogViewer
src/components/shared/NBAModule.jsx          — "Draft Email" creates an approval record
```

---

## Task 1: Approvals Data Hook

**Files:**
- Create: `src/hooks/useApprovalsSupa.js`

- [ ] **Step 1: Create the hook**

Fetches approvals from Supabase, sorted by created_at desc. Provides: list (pending first), counts by status, createApproval, decideApproval (approve/reject with edits + comment), refresh. Realtime subscription on approvals table.

```js
import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";

export function useApprovalsSupa({ leadId, dealId, statusFilter } = {}) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    let query = supabase.from("approvals").select("*").order("created_at", { ascending: false }).limit(100);
    if (leadId) query = query.eq("lead_id", leadId);
    if (dealId) query = query.eq("deal_id", dealId);
    if (statusFilter) query = query.eq("status", statusFilter);

    const { data, error } = await query;
    if (!error) setApprovals(data || []);
    setLoading(false);
  }, [leadId, dealId, statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel("approvals_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () => refresh())
      .subscribe();
    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [refresh]);

  const pending = approvals.filter(a => a.status === "pending");

  const createApproval = useCallback(async (fields) => {
    if (!supabase) return null;
    const { data, error } = await supabase.from("approvals").insert(fields).select().single();
    if (error) throw error;
    refresh();
    return data;
  }, [refresh]);

  const decideApproval = useCallback(async (id, { status, finalContent, userEdits, userComment }) => {
    if (!supabase) return;
    await supabase.from("approvals").update({
      status,
      final_content: finalContent,
      user_edits: userEdits,
      user_comment: userComment,
      decided_at: new Date().toISOString(),
    }).eq("id", id);

    // Log to audit_log
    const approval = approvals.find(a => a.id === id);
    if (approval) {
      await supabase.from("audit_log").insert({
        actor: "user",
        action: "approval_decided",
        entity_type: approval.type,
        entity_id: id,
        before_state: { status: "pending", draft: approval.draft_content },
        after_state: { status, final: finalContent },
        reason: userComment,
      });

      // Create learning_event if edits were made
      if (userEdits && Object.keys(userEdits).length > 0) {
        await supabase.from("learning_events").insert({
          approval_id: id,
          lead_id: approval.lead_id,
          deal_id: approval.deal_id,
          event_type: status === "approved" ? "draft_edited" : "draft_rejected",
          ai_draft: approval.draft_content,
          final_version: finalContent,
          diff_summary: userEdits,
        });
      }
    }
    refresh();
  }, [refresh, approvals]);

  return { approvals, pending, loading, refresh, createApproval, decideApproval };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useApprovalsSupa.js
git commit -m "feat: useApprovalsSupa hook — approvals CRUD, audit log, learning events"
```

---

## Task 2: Approval Queue + Review Components

**Files:**
- Create: `src/components/sales/ApprovalQueue.jsx`
- Create: `src/components/sales/ApprovalReview.jsx`

- [ ] **Step 1: Create ApprovalQueue.jsx**

List of pending approvals. Each row shows: type icon (email/proposal/stage_change), target (lead/deal company name from draft_content), source agent, created time, preview of draft. Click opens ApprovalReview. Also shows recently decided approvals below (approved/rejected).

- [ ] **Step 2: Create ApprovalReview.jsx**

Full review panel (modal or slide-over). Shows:
- Draft content in an editable textarea
- Original AI draft displayed read-only for comparison
- Comment field (why are you changing this?)
- Three buttons: Approve (sends as-is), Approve with Edits (sends edited version), Reject
- On approve: computes diff between original and edited, stores as user_edits
- Creates learning_event and audit_log entry via the hook

- [ ] **Step 3: Commit**

```bash
git add src/components/sales/ApprovalQueue.jsx src/components/sales/ApprovalReview.jsx
git commit -m "feat: ApprovalQueue + ApprovalReview — draft review and decide workflow"
```

---

## Task 3: Sales Command Briefing

**Files:**
- Create: `src/components/sales/SalesCommandBriefing.jsx`

- [ ] **Step 1: Create the briefing component**

Collapsible strip below StatsBar. Generates a priority stack from:
- Hot leads with NBA action (from useLeadsSupa)
- Deals needing follow-up (from useOpsSupa deals where attention = at_risk or NBA = follow_up)
- Pending approvals count (from useApprovalsSupa)
- Calendar events today (from ops.calendarEvents)
- Stale leads count

Format: each item has a colored left border (red=urgent, yellow=action needed, blue=info, gray=low priority) with action text and reason. Pipeline value, hot count, at-risk deals, pending approvals, win rate summary at bottom.

Expandable/collapsible with a chevron. Defaults expanded on first load, remembers state.

- [ ] **Step 2: Commit**

```bash
git add src/components/sales/SalesCommandBriefing.jsx
git commit -m "feat: Sales Command Briefing — daily priority stack"
```

---

## Task 4: Audit Log Viewer

**Files:**
- Create: `src/components/sales/AuditLogViewer.jsx`

- [ ] **Step 1: Create the viewer**

Fetches from audit_log where entity_id matches (for a specific lead or deal) or all recent entries. Shows each entry as a timeline row: actor badge (jarvis/user/system), action label, entity type, before→after state diff (if present), reason, timestamp. Color-coded by actor.

- [ ] **Step 2: Commit**

```bash
git add src/components/sales/AuditLogViewer.jsx
git commit -m "feat: AuditLogViewer — audit trail display"
```

---

## Task 5: Wire Everything Together

**Files:**
- Modify: `src/views/Work.jsx` — add SalesCommandBriefing
- Modify: `src/components/sales/LeadDetailPanel.jsx` — wire Approvals tab
- Modify: `src/components/sales/DealRoomPanel.jsx` — wire Approvals tab
- Modify: `src/components/shared/NBAModule.jsx` — Draft Email creates approval

- [ ] **Step 1: Add SalesCommandBriefing to Work.jsx**

Import and render below StatsBar, above tab content, only in sales mode.

- [ ] **Step 2: Wire Approvals tab in LeadDetailPanel**

Replace the placeholder text in the "approvals" tab with ApprovalQueue filtered by leadId + AuditLogViewer.

- [ ] **Step 3: Wire Approvals tab in DealRoomPanel**

Same pattern — ApprovalQueue filtered by dealId + AuditLogViewer.

- [ ] **Step 4: Wire NBAModule "Draft Email" to create approval**

When user clicks "Draft Email" in NBAModule, create an approval record with type="email", draft_content from context, status="pending". This makes it appear in the ApprovalQueue.

- [ ] **Step 5: Commit**

```bash
git add src/views/Work.jsx src/components/sales/LeadDetailPanel.jsx src/components/sales/DealRoomPanel.jsx src/components/shared/NBAModule.jsx
git commit -m "feat: wire approvals — command briefing, panel tabs, NBA draft action"
```

---

## Summary

| Task | What it delivers |
|------|-----------------|
| 1 | Approvals hook with CRUD, audit logging, learning event capture |
| 2 | ApprovalQueue list + ApprovalReview panel (draft/edit/approve/reject) |
| 3 | Sales Command Briefing — daily priority stack |
| 4 | AuditLogViewer — audit trail display |
| 5 | Wire into Work view, Lead/Deal panels, NBA actions |
