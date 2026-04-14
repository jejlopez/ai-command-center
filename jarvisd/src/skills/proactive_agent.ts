// proactive_agent — scans CRM deals, calendar, email, and tasks every 2 hours
// during work hours and surfaces suggestions to the UI via jarvis_outputs.
// Cron: every even hour 8am–6pm, weekdays only.

import { randomUUID } from "node:crypto";
import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import { memory } from "../lib/memory.js";
import { bus } from "../lib/events.js";
import { gcalStatus, listEvents as gcalListEvents } from "../lib/providers/gcal.js";
import {
  calendarStatus as appleCalendarStatus,
  mailStatus as appleMailStatus,
  getTodayEvents as appleTodayEvents,
  getRecentUnread as appleRecentUnread,
} from "../lib/providers/apple.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "proactive_agent",
  title: "Proactive Agent",
  description:
    "Every 2 hours during work hours: surfaces stale CRM deals, upcoming calendar events, unread emails, and overdue follow-ups.",
  version: "0.1.0",
  scopes: ["memory.read", "gcal.read", "gmail.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 8,10,12,14,16,18 * * 1-5" },
    { kind: "manual" },
  ],
};

// ---------------------------------------------------------------------------
// CRM: stale deals (no activity in 5+ days)
// ---------------------------------------------------------------------------

interface StaleDeal {
  id: string;
  title: string;
  orgName: string;
  stage: string;
  lastActivity: string;
  daysSinceActivity: number;
}

function checkStaleDeals(): StaleDeal[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 5);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  type DealRow = {
    id: string;
    title: string;
    org_name: string;
    stage: string;
    last_activity: string;
  };

  const rows = db
    .prepare(
      `SELECT id, title, org_name, stage, last_activity
       FROM crm_deals
       WHERE status = 'open'
         AND (last_activity = '' OR last_activity < ?)
       ORDER BY last_activity ASC
       LIMIT 10`
    )
    .all(cutoffStr) as DealRow[];

  return rows.map((r) => {
    const last = r.last_activity || "2000-01-01";
    const ageMs = Date.now() - Date.parse(last);
    const daysSince = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    return {
      id: r.id,
      title: r.title,
      orgName: r.org_name,
      stage: r.stage,
      lastActivity: r.last_activity,
      daysSinceActivity: daysSince,
    };
  });
}

// ---------------------------------------------------------------------------
// Calendar: events in the next 2 hours
// ---------------------------------------------------------------------------

interface UpcomingEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
}

async function checkUpcomingEvents(): Promise<UpcomingEvent[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Try Apple Calendar first.
  try {
    const s = await appleCalendarStatus();
    if (s.available) {
      const events = await appleTodayEvents();
      return events
        .filter((e) => {
          if (e.allDay) return false;
          const start = Date.parse(e.start);
          return start >= now.getTime() && start <= horizon.getTime();
        })
        .slice(0, 5)
        .map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end, location: e.location }));
    }
  } catch (err: any) {
    audit({ actor: "skill:proactive_agent", action: "apple_calendar.fetch.fail", reason: err?.message ?? String(err) });
  }

  // Fallback: Google Calendar.
  const gcal = gcalStatus();
  if (gcal.linked) {
    try {
      const events = await gcalListEvents(1);
      return events
        .filter((e) => {
          const start = Date.parse(e.start);
          return start >= now.getTime() && start <= horizon.getTime();
        })
        .slice(0, 5)
        .map((e) => ({ id: e.id, title: e.summary, start: e.start, end: e.end, location: e.location }));
    } catch (err: any) {
      audit({ actor: "skill:proactive_agent", action: "gcal.fetch.fail", reason: err?.message ?? String(err) });
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Email: unread important messages
// ---------------------------------------------------------------------------

interface UnreadEmail {
  id: string;
  subject: string;
  sender: string;
}

async function checkUnreadEmail(): Promise<UnreadEmail[]> {
  try {
    const s = await appleMailStatus();
    if (!s.available) return [];
    const msgs = await appleRecentUnread(5);
    return msgs.map((m) => ({
      id: m.id,
      subject: m.subject || "(no subject)",
      sender: m.sender || "unknown",
    }));
  } catch (err: any) {
    audit({ actor: "skill:proactive_agent", action: "apple_mail.fetch.fail", reason: err?.message ?? String(err) });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Tasks: overdue follow-ups from memory
// ---------------------------------------------------------------------------

interface OverdueTask {
  id: string;
  label: string;
  updatedAt: string;
  daysOld: number;
}

function checkOverdueTasks(): OverdueTask[] {
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days
  return memory
    .list("task", 50)
    .filter((n) => Date.parse(n.updatedAt) < cutoff)
    .slice(0, 5)
    .map((n) => ({
      id: n.id,
      label: n.label,
      updatedAt: n.updatedAt,
      daysOld: Math.floor((Date.now() - Date.parse(n.updatedAt)) / (1000 * 60 * 60 * 24)),
    }));
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

export const proactiveAgent: Skill = {
  manifest,
  async run(ctx) {
    const runId = randomUUID();
    audit({ actor: "skill:proactive_agent", action: "proactive_agent.run.start", subject: runId });

    const [staleDeals, upcomingEvents, unreadEmails, overdueTasks] = await Promise.all([
      Promise.resolve(checkStaleDeals()),
      checkUpcomingEvents(),
      checkUnreadEmail(),
      Promise.resolve(checkOverdueTasks()),
    ]);

    const suggestions: Array<{ type: string; title: string; detail: string; urgency: "high" | "medium" | "low" }> = [];

    for (const deal of staleDeals) {
      suggestions.push({
        type: "crm_follow_up",
        title: `Follow up on "${deal.title}"`,
        detail: `${deal.orgName} — stage: ${deal.stage}. No activity for ${deal.daysSinceActivity} days.`,
        urgency: deal.daysSinceActivity >= 10 ? "high" : "medium",
      });
    }

    for (const event of upcomingEvents) {
      const startMins = Math.round((Date.parse(event.start) - Date.now()) / 60_000);
      suggestions.push({
        type: "calendar_prep",
        title: `Upcoming: "${event.title}"`,
        detail: `Starts in ~${startMins} min${event.location ? ` · ${event.location}` : ""}.`,
        urgency: startMins <= 30 ? "high" : "medium",
      });
    }

    for (const email of unreadEmails) {
      suggestions.push({
        type: "email_surface",
        title: `Unread: "${email.subject}"`,
        detail: `From ${email.sender}`,
        urgency: "low",
      });
    }

    for (const task of overdueTasks) {
      suggestions.push({
        type: "overdue_task",
        title: `Overdue task: "${task.label}"`,
        detail: `Last updated ${task.daysOld} days ago — needs attention.`,
        urgency: task.daysOld >= 7 ? "high" : "medium",
      });
    }

    const now = new Date().toISOString();
    const outputId = randomUUID();

    if (suggestions.length > 0) {
      db.prepare(
        `INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
         VALUES (?, 'nudge', ?, ?, ?, 'proactive_agent')`
      ).run(
        outputId,
        `Proactive Suggestions — ${now.slice(0, 16).replace("T", " ")}`,
        JSON.stringify({ runId, suggestions, generatedAt: now }),
        now
      );
    }

    audit({
      actor: "skill:proactive_agent",
      action: "proactive_agent.run.complete",
      subject: runId,
      metadata: {
        staleDeals: staleDeals.length,
        upcomingEvents: upcomingEvents.length,
        unreadEmails: unreadEmails.length,
        overdueTasks: overdueTasks.length,
        suggestions: suggestions.length,
      },
    });

    if (suggestions.length > 0) {
      bus.emit("proactive_agent.suggestions", { runId, count: suggestions.length, outputId });
      ctx.log("proactive_agent.complete", { suggestions: suggestions.length });
    }

    return {
      runId,
      suggestions: suggestions.length,
      staleDeals: staleDeals.length,
      upcomingEvents: upcomingEvents.length,
      unreadEmails: unreadEmails.length,
      overdueTasks: overdueTasks.length,
    };
  },
};
