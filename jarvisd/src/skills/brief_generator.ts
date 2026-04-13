// Morning Brief generator — registered as a proper Skill.
// Pulls structured items from the memory graph, then asks the router for a
// short narrative. Falls back to a deterministic narrative if the model call
// can't happen (vault locked, no key, budget exceeded, etc.).

import { randomUUID } from "node:crypto";
import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import { memory, type MemoryNode } from "../lib/memory.js";
import { route, estimateCostUsd } from "../lib/router.js";
import { callAnthropic } from "../lib/providers/anthropic.js";
import { recordCost, spentTodayUsd, dailyBudgetUsd } from "../lib/cost.js";
import { vault } from "../lib/vault.js";
import { episodic } from "../lib/episodic.js";
import { bus } from "../lib/events.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { gcalStatus, listEvents as gcalListEvents } from "../lib/providers/gcal.js";
import {
  calendarStatus as appleCalendarStatus,
  mailStatus as appleMailStatus,
  getTodayEvents as appleTodayEvents,
  getRecentUnread as appleRecentUnread,
  type AppleCalendarEvent,
  type AppleMailMessage,
} from "../lib/providers/apple.js";
import type {
  MorningBrief,
  BriefItem,
  BudgetSummary,
  CalendarEvent,
  ScheduleBlock,
} from "../../../shared/types.js";

function toBriefItem(n: MemoryNode, priority: BriefItem["priority"] = "normal"): BriefItem {
  return {
    id: n.id,
    title: n.label,
    detail: n.body ?? undefined,
    priority,
    source: "memory",
  };
}

function gatherFromMemory() {
  const critical = memory.list("task").filter((n) => n.trust >= 0.8).slice(0, 3);
  const followUps = memory.list("task").filter((n) => n.trust < 0.8).slice(0, 5);
  const events = memory.list("event").slice(0, 5);
  return { critical, followUps, events };
}

function todayBudget(): BudgetSummary {
  return {
    spentToday: Number(spentTodayUsd().toFixed(4)),
    budgetToday: dailyBudgetUsd(),
    topCategory: "llm",
    currency: "USD",
  };
}

function scheduleFromEvents(events: MemoryNode[]): ScheduleBlock[] {
  const now = Date.now();
  return events.slice(0, 4).map((e, i) => ({
    id: e.id,
    title: e.label,
    start: new Date(now + (i + 1) * 60 * 60 * 1000).toISOString(),
    end: new Date(now + (i + 1.5) * 60 * 60 * 1000).toISOString(),
  }));
}

function scheduleFromCalendar(events: CalendarEvent[]): ScheduleBlock[] {
  return events.slice(0, 6).map((e) => ({
    id: e.id,
    title: e.summary,
    start: e.start,
    end: e.end,
    location: e.location,
  }));
}

function scheduleFromApple(events: AppleCalendarEvent[]): ScheduleBlock[] {
  return events
    .filter((e) => !e.allDay)
    .slice(0, 6)
    .map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start,
      end: e.end,
      location: e.location,
    }));
}

async function scheduleFromAppleIfAvailable(): Promise<ScheduleBlock[] | null> {
  try {
    const s = await appleCalendarStatus();
    if (!s.available) return null;
    const events = await appleTodayEvents();
    if (events.length === 0) return [];
    return scheduleFromApple(events);
  } catch (err: any) {
    audit({
      actor: "skill:brief_generator",
      action: "apple_calendar.fetch.fail",
      reason: err?.message ?? String(err),
    });
    return null;
  }
}

async function scheduleFromGcalIfLinked(): Promise<ScheduleBlock[] | null> {
  const status = gcalStatus();
  if (!status.linked) return null;
  try {
    const events = await gcalListEvents(1);
    return scheduleFromCalendar(events);
  } catch (err: any) {
    audit({
      actor: "skill:brief_generator",
      action: "gcal.fetch.fail",
      reason: err?.message ?? String(err),
    });
    return null;
  }
}

async function waitingOnFromAppleMail(): Promise<BriefItem[]> {
  try {
    const s = await appleMailStatus();
    if (!s.available) return [];
    const msgs: AppleMailMessage[] = await appleRecentUnread(5);
    return msgs.map((m) => ({
      id: `mail:${m.id}`,
      title: m.subject || "(no subject)",
      detail: m.sender ? `From ${m.sender}` : undefined,
      priority: "normal" as const,
      source: m.account ? `mail:${m.account}` : "mail",
    }));
  } catch (err: any) {
    audit({
      actor: "skill:brief_generator",
      action: "apple_mail.fetch.fail",
      reason: err?.message ?? String(err),
    });
    return [];
  }
}

async function narrativeFromModel(args: {
  critical: BriefItem[];
  waitingOn: BriefItem[];
  followUps: BriefItem[];
}): Promise<{ text: string; model: string; costUsd: number } | null> {
  const decision = route({ kind: "summary" });
  const facts = [
    `Critical: ${args.critical.map((i) => i.title).join(" · ") || "none"}`,
    `Waiting on: ${args.waitingOn.map((i) => i.title).join(" · ") || "none"}`,
    `Follow-ups: ${args.followUps.map((i) => i.title).join(" · ") || "none"}`,
  ].join("\n");

  try {
    // Prefer CLI (subscription, $0) → fallback to API
    const { isCliAvailable, callClaudeCli } = await import("../lib/providers/claude_cli.js");
    const cliOk = await isCliAvailable();
    const callFn = cliOk ? callClaudeCli : callAnthropic;
    const provider = cliOk ? "claude-cli" : "anthropic";

    if (!cliOk && (!vault.get("anthropic_api_key") || vault.isLocked())) {
      return null; // no CLI and no API key — use fallback narrative
    }

    const result = await callFn({
      model: decision.model,
      maxTokens: 220,
      system:
        "You are JARVIS. Write a 2-sentence morning briefing for the user. Crisp, calm, no preamble, no bullet points. Address them directly.",
      prompt: facts,
    });
    const costUsd = cliOk ? 0 : estimateCostUsd(decision.model, result.tokensIn, result.tokensOut);
    recordCost({
      provider,
      model: decision.model,
      taskKind: "summary",
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd,
      skill: "brief_generator",
    });
    return { text: result.text.trim(), model: decision.model, costUsd };
  } catch (err: any) {
    audit({ actor: "skill:brief_generator", action: "narrative.fail", reason: err.message });
    return null;
  }
}

function fallbackNarrative(critical: BriefItem[], waitingOn: BriefItem[]): string {
  if (critical.length === 0 && waitingOn.length === 0) {
    return "Good morning. The board looks clean. I'd focus on deep work today — nothing urgent is waiting on you.";
  }
  const c = critical.length;
  const w = waitingOn.length;
  return `Good morning. ${c} critical item${c === 1 ? "" : "s"} on deck and ${w} thread${w === 1 ? "" : "s"} waiting on others. I'd clear the critical list first, then check back on the waiting items.`;
}

export async function generateBrief(): Promise<MorningBrief> {
  const runId = randomUUID();
  audit({ actor: "skill:brief_generator", action: "brief.generate.start", subject: runId });

  const { critical, followUps, events } = gatherFromMemory();

  const criticalItems: BriefItem[] = critical.map((n) => toBriefItem(n, "critical"));
  const followUpItems: BriefItem[] = followUps.map((n) => toBriefItem(n, "normal"));

  // Try Apple Calendar first, then gcal, then memory.
  // Use gcal if Apple returns empty (not just null).
  const appleSchedule = await scheduleFromAppleIfAvailable();
  const gcalSchedule = await scheduleFromGcalIfLinked();
  const schedule =
    (appleSchedule && appleSchedule.length > 0) ? appleSchedule :
    (gcalSchedule && gcalSchedule.length > 0) ? gcalSchedule :
    scheduleFromEvents(events);

  // Unread mail becomes "waiting on" items.
  const waitingOn: BriefItem[] = await waitingOnFromAppleMail();

  const nextBestMove: BriefItem | null =
    criticalItems[0] ??
    followUpItems[0] ??
    (events[0] ? toBriefItem(events[0], "high") : null);

  const narrative = await narrativeFromModel({
    critical: criticalItems,
    waitingOn,
    followUps: followUpItems,
  });

  const todayBriefing = narrative?.text ?? fallbackNarrative(criticalItems, waitingOn);

  const brief: MorningBrief = {
    generatedAt: new Date().toISOString(),
    todayBriefing,
    criticalItems,
    nextBestMove,
    waitingOn,
    followUps: followUpItems,
    schedule,
    budget: todayBudget(),
    focus:
      criticalItems.length > 0
        ? `Clear "${criticalItems[0].title}" before anything else.`
        : "Protect deep work. No fires today.",
  };

  // Persist to daily_briefs (latest wins) and jarvis_outputs.
  db.prepare(
    `INSERT INTO daily_briefs(id, generated_at, body) VALUES (?, ?, ?)`
  ).run(runId, brief.generatedAt, JSON.stringify(brief));

  db.prepare(
    `INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
     VALUES (?, 'brief', ?, ?, ?, 'brief_generator')`
  ).run(
    randomUUID(),
    `Morning Brief — ${brief.generatedAt.slice(0, 10)}`,
    JSON.stringify(brief),
    brief.generatedAt
  );

  audit({
    actor: "skill:brief_generator",
    action: "brief.generate.complete",
    subject: runId,
    metadata: {
      narrative: narrative ? "model" : "fallback",
      critical: criticalItems.length,
      followUps: followUpItems.length,
    },
  });

  // Episodic snapshot for the Brain timeline.
  episodic.snapshot({
    kind: "brief",
    title: `Morning brief — ${brief.generatedAt.slice(0, 10)}`,
    body: brief,
    actor: "skill:brief_generator",
  });

  bus.emit("brief.generated", { runId });

  return brief;
}

export function latestBrief(): MorningBrief | null {
  const row = db
    .prepare("SELECT body FROM daily_briefs ORDER BY generated_at DESC LIMIT 1")
    .get() as { body: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.body) as MorningBrief;
}

// Skill interface wrapper — so brief_generator appears in the registry.
const briefManifest: SkillManifest = {
  name: "brief_generator",
  title: "Morning Brief",
  description: "Generate the morning brief: calendar, mail, tasks, budget, and a narrative summary.",
  version: "0.2.0",
  scopes: ["memory.read", "llm.cloud", "gcal.read", "gmail.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 7 * * *" },  // 7am daily
    { kind: "manual" },
  ],
};

export const briefGeneratorSkill: Skill = {
  manifest: briefManifest,
  async run(_ctx) {
    const brief = await generateBrief();
    return {
      text: brief.todayBriefing,
      critical: brief.criticalItems.length,
      followUps: brief.followUps.length,
      schedule: brief.schedule.length,
      waitingOn: brief.waitingOn.length,
    };
  },
};
