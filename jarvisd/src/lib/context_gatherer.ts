// Context gatherer — fetches live data from connected systems
// and injects it into the prompt so JARVIS has real-time awareness.

import { audit } from "./audit.js";
import { memory } from "./memory.js";

// Dynamic imports to avoid circular deps — these are optional
async function getCalendarEvents(): Promise<string> {
  try {
    const { listEvents } = await import("./providers/gcal.js");
    const events = await listEvents(2); // next 2 days
    if (!events || events.length === 0) return "No upcoming calendar events.";
    const timed = events.filter((e: any) => !e.allDay).slice(0, 10);
    const allDay = events.filter((e: any) => e.allDay).slice(0, 5);
    const lines: string[] = [];
    for (const e of timed) {
      const start = new Date(e.start);
      const time = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const day = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      lines.push(`${day} ${time}: ${e.summary}${e.location ? ` (${e.location})` : ""}`);
    }
    if (allDay.length > 0) {
      lines.push(`All-day tasks: ${allDay.map((e: any) => e.summary).join(", ")}`);
    }
    return lines.join("\n");
  } catch (err: any) {
    audit({ actor: "context_gatherer", action: "gcal.fail", reason: err.message });
    return "Calendar unavailable right now.";
  }
}

async function getCRMSummary(): Promise<string> {
  try {
    const { syncDeals } = await import("./providers/pipedrive.js");
    // Just describe what's in the local DB
    const { db } = await import("../db/db.js");
    const deals = db.prepare("SELECT title, stage, value_usd, person_name FROM crm_deals WHERE status = 'open' ORDER BY value_usd DESC LIMIT 10").all() as any[];
    if (!deals || deals.length === 0) return "No open deals in pipeline.";
    return deals.map((d: any) => `${d.title} — ${d.stage ?? "?"}, $${d.value_usd ?? 0}${d.person_name ? `, ${d.person_name}` : ""}`).join("\n");
  } catch {
    return "CRM data unavailable.";
  }
}

function getMemoryContext(): string {
  try {
    const tasks = memory.list("task").slice(0, 10);
    if (tasks.length === 0) return "No active tasks in memory.";
    return tasks.map((t) => `${t.label}${t.body ? `: ${t.body}` : ""}`).join("\n");
  } catch {
    return "";
  }
}

export async function gatherContext(prompt: string): Promise<string> {
  const lower = prompt.toLowerCase();
  const parts: string[] = [];

  // Always include calendar if user asks about schedule, meetings, today, tomorrow
  const needsCalendar = /\b(schedule|calendar|meeting|tomorrow|today|this week|free|busy|event|appointment)\b/i.test(lower);
  // Include CRM if user asks about deals, pipeline, sales, clients
  const needsCRM = /\b(deal|pipeline|sales|client|prospect|lead|crm|pipedrive|revenue|contact)\b/i.test(lower);
  // Include tasks/memory if user asks about tasks, todo, priorities
  const needsTasks = /\b(task|todo|priority|focus|critical|follow.?up|waiting)\b/i.test(lower);

  if (needsCalendar) {
    const cal = await getCalendarEvents();
    parts.push(`LIVE CALENDAR DATA:\n${cal}`);
  }

  if (needsCRM) {
    const crm = await getCRMSummary();
    parts.push(`LIVE CRM PIPELINE:\n${crm}`);
  }

  if (needsTasks) {
    const tasks = getMemoryContext();
    if (tasks) parts.push(`ACTIVE TASKS:\n${tasks}`);
  }

  if (parts.length === 0) return "";
  return "\n\n--- LIVE DATA (use this to answer, do not say you can't access it) ---\n" + parts.join("\n\n");
}
