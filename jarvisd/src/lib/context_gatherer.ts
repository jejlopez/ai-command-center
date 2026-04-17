// Context gatherer — fetches live data from connected systems
// and injects it into the prompt so JARVIS has real-time awareness.
// Also detects intent to route to specific skills.

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
    const { db } = await import("../db/db.js");

    // Top deals by value
    const topDeals = db.prepare(`
      SELECT org_name, title, stage, value, contact_name, engagement, days_in_stage, total_activities
      FROM crm_deals
      WHERE status = 'open'
      ORDER BY value DESC LIMIT 15
    `).all() as any[];

    if (!topDeals || topDeals.length === 0) return "No open deals in pipeline.";

    // Pipeline stats
    const stats = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN value > 0 THEN value ELSE 0 END) as total_value,
             SUM(CASE WHEN engagement = 'hot' THEN 1 ELSE 0 END) as hot_count
      FROM crm_deals WHERE status = 'open'
    `).get() as any;

    // Overdue deals
    const overdue = db.prepare(`
      SELECT COUNT(*) as cnt FROM crm_deals
      WHERE status = 'open' AND days_in_stage > 14
    `).get() as any;

    // Recent leads
    const leads = db.prepare(`
      SELECT org_name, title, contact_name, status
      FROM crm_leads
      WHERE status = 'active'
      ORDER BY created_at DESC LIMIT 5
    `).all() as any[];

    const lines: string[] = [];
    lines.push(`Pipeline: ${stats?.total || 0} open deals, $${(stats?.total_value || 0).toLocaleString()} total value, ${stats?.hot_count || 0} hot`);
    if (overdue?.cnt > 0) lines.push(`${overdue.cnt} deals overdue (stuck >14 days)`);
    lines.push("");
    lines.push("TOP DEALS BY VALUE:");
    for (const d of topDeals) {
      const name = d.org_name || d.title;
      const val = d.value || 0;
      const eng = d.engagement ? ` [${d.engagement}]` : "";
      const days = d.days_in_stage ? ` (${d.days_in_stage}d in stage)` : "";
      const acts = d.total_activities ? `, ${d.total_activities} activities` : "";
      lines.push(`  ${name} — ${d.stage}, $${val.toLocaleString()}${eng}${days}${acts}, contact: ${d.contact_name || "?"}`);
    }

    if (leads.length > 0) {
      lines.push("");
      lines.push("RECENT LEADS:");
      for (const l of leads) {
        lines.push(`  ${l.org_name || l.title} — ${l.status}, contact: ${l.contact_name || "?"}`);
      }
    }

    return lines.join("\n");
  } catch (err: any) {
    audit({ actor: "context_gatherer", action: "crm.fail", reason: err.message });
    return "CRM data unavailable.";
  }
}

async function getEmailSummary(): Promise<string> {
  try {
    const { db } = await import("../db/db.js");
    const urgent = db.prepare(
      "SELECT from_addr, subject FROM email_triage WHERE category IN ('urgent', 'action_needed') ORDER BY created_at DESC LIMIT 5"
    ).all() as any[];
    if (urgent.length === 0) return "No urgent emails.";
    return urgent.map((e: any) => `${e.from_addr}: ${e.subject}`).join("\n");
  } catch {
    return "Email data unavailable.";
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

// Detect skill routing intent — returns skill name + args if matched
export function detectSkillIntent(prompt: string): { skill: string; args: Record<string, string> } | null {
  const lower = prompt.toLowerCase();

  // "research [company]" → lead_research
  const researchMatch = lower.match(/research\s+(.+)/);
  if (researchMatch) {
    return { skill: "lead_research", args: { company: researchMatch[1].trim() } };
  }

  // "follow up [name]" or "draft reply to [name]" → master_email_agent
  const followUpMatch = lower.match(/(?:follow\s*up|draft\s*(?:reply|email))\s+(?:with\s+|to\s+)?(.+)/);
  if (followUpMatch) {
    return { skill: "master_email_agent", args: { mode: "draft_reply", contactName: followUpMatch[1].trim() } };
  }

  // "my day" or "plan my day" → plan_my_day
  if (/\b(my day|plan.?my.?day|what.?should.?i.?do|priorities)\b/.test(lower)) {
    return { skill: "plan_my_day", args: {} };
  }

  // "pipeline" or "morning brief" → crm_morning_brief
  if (/\b(pipeline\s*(?:report|summary|status|brief)?|morning\s*brief|pipeline\s*review)\b/.test(lower)) {
    return { skill: "crm_morning_brief", args: {} };
  }

  return null;
}

export async function gatherContext(prompt: string): Promise<string> {
  const lower = prompt.toLowerCase();
  const parts: string[] = [];

  // Broad keyword matching — catch more natural language
  const needsCalendar = /\b(schedule|calendar|meeting|tomorrow|today|this week|free|busy|event|appointment|booked)\b/i.test(lower);
  const needsCRM = /\b(deal|pipeline|sales|client|prospect|lead|crm|pipedrive|revenue|contact|best|biggest|top|close|won|lost|work\s*on|priority|negotiate|proposal|stage|value|company|account)\b/i.test(lower);
  const needsTasks = /\b(task|todo|priority|focus|critical|follow.?up|waiting|overdue|action)\b/i.test(lower);
  const needsEmail = /\b(email|inbox|unread|urgent|reply|draft|message|mail)\b/i.test(lower);

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

  if (needsEmail) {
    const email = await getEmailSummary();
    parts.push(`URGENT EMAILS:\n${email}`);
  }

  // Detect skill intent
  const intent = detectSkillIntent(prompt);
  if (intent) {
    parts.push(`SKILL INTENT DETECTED: Run "${intent.skill}" with args ${JSON.stringify(intent.args)}`);
  }

  if (parts.length === 0) return "";
  return "\n\n--- LIVE DATA (use this to answer, do not say data is unavailable) ---\n" + parts.join("\n\n");
}
