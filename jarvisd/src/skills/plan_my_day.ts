// plan_my_day — builds a time-boxed plan from open tasks + today's calendar.
// Runs at 7am daily (cron) or on manual trigger.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "plan_my_day",
  title: "Plan My Day",
  description:
    "Pulls open tasks from memory and today's calendar events, then proposes a time-boxed plan.",
  version: "0.1.0",
  scopes: ["memory.read", "llm.cloud"],
  routerHint: "chat",
  triggers: [
    { kind: "cron", expr: "0 7 * * *" },
    { kind: "manual" },
  ],
};

export const planMyDay: Skill = {
  manifest,
  async run(ctx) {
    const tasks = ctx.memory.list("task", 20);

    let events: Awaited<ReturnType<typeof ctx.apple.getTodayEvents>> = [];
    try {
      const calStatus = await ctx.apple.calendarStatus();
      if (calStatus.available) {
        events = await ctx.apple.getTodayEvents();
      }
    } catch (err: any) {
      ctx.log("plan.calendar.fail", { error: err?.message ?? String(err) });
    }

    const taskLines = tasks.length
      ? tasks
          .map((t) => `- ${t.label}${t.body ? ` — ${t.body}` : ""} (trust=${t.trust.toFixed(2)})`)
          .join("\n")
      : "(no open tasks)";

    const eventLines = events.length
      ? events
          .map((e) => `- ${e.start.slice(11, 16)}-${e.end.slice(11, 16)} ${e.title}${e.location ? ` @ ${e.location}` : ""}`)
          .join("\n")
      : "(no calendar events today)";

    const prompt = [
      "Open tasks:",
      taskLines,
      "",
      "Today's calendar:",
      eventLines,
      "",
      "Produce a time-boxed plan for today. Group the plan into morning / midday / afternoon blocks. Respect existing calendar events. Be concrete — name each task. Keep it under 12 lines total.",
    ].join("\n");

    try {
      const out = await ctx.callModel({
        kind: "chat",
        system:
          "You are JARVIS, the user's chief of staff. Build tight, realistic daily plans. No fluff.",
        prompt,
        maxTokens: 500,
      });
      return {
        text: out.text.trim(),
        taskCount: tasks.length,
        eventCount: events.length,
        model: out.model,
        costUsd: out.costUsd,
      };
    } catch (err: any) {
      ctx.log("plan.model.fail", { error: err?.message ?? String(err) });
      const fallback = [
        `Morning: tackle the top task (${tasks[0]?.label ?? "deep work block"}).`,
        `Midday: handle meetings (${events.length} on the calendar).`,
        `Afternoon: clear remaining tasks (${Math.max(0, tasks.length - 1)} left).`,
      ].join("\n");
      return {
        text: fallback,
        taskCount: tasks.length,
        eventCount: events.length,
        fallback: true,
      };
    }
  },
};
