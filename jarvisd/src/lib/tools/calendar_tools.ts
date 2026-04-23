import { z } from "zod";
import { getEventsInRange, calendarStatus } from "../providers/apple.js";
import { defineTool, type ToolResult } from "./types.js";

const RANGE = ["today", "tomorrow", "this_week", "next_week"] as const;

// "this_week" / "next_week" use a rolling 7-day window (simpler + predictable)
// rather than calendar-week boundaries. Explained in the description so Claude
// doesn't get confused when the user says "this week" literally.
const WINDOWS: Record<(typeof RANGE)[number], { startDays: number; spanDays: number }> = {
  today: { startDays: 0, spanDays: 1 },
  tomorrow: { startDays: 1, spanDays: 1 },
  this_week: { startDays: 0, spanDays: 7 },
  next_week: { startDays: 7, spanDays: 7 },
};

function daysBetweenMidnights(targetIso: string): number | null {
  const target = new Date(`${targetIso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - todayMidnight.getTime()) / 86400000);
  return diff;
}

export const getCalendar = defineTool({
  name: "get_calendar",
  description:
    "Read the user's calendar (Apple Calendar native integration). Supports four named ranges (today, tomorrow, this_week = next 7 days, next_week = 7 days starting a week from today) or a specific_date in YYYY-MM-DD. Returns events with start/end/title/location. Use before scheduling, for morning briefings, or when the user asks what's on their calendar.",
  inputSchema: z.object({
    range: z
      .enum(RANGE)
      .optional()
      .describe("Named time range. Defaults to 'today'. Ignored when specific_date is set."),
    specific_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
      .optional()
      .describe("A specific calendar date in YYYY-MM-DD format. When set, overrides `range`."),
  }),
  anthropicSchema: {
    type: "object",
    properties: {
      range: {
        type: "string",
        enum: [...RANGE],
        description: "today | tomorrow | this_week | next_week (default today)",
      },
      specific_date: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "YYYY-MM-DD — overrides `range` when provided",
      },
    },
    additionalProperties: false,
  },
  requiresApproval: false,
  riskLevel: "low",
  async run(input, ctx): Promise<ToolResult> {
    const status = await calendarStatus();
    if (!status.available) {
      return { content: `Calendar not available: ${status.error ?? "unknown"}`, isError: true };
    }

    let startDays: number;
    let spanDays: number;
    let label: string;

    if (input.specific_date) {
      const offset = daysBetweenMidnights(input.specific_date);
      if (offset === null) {
        return { content: `Invalid date: ${input.specific_date}`, isError: true };
      }
      startDays = offset;
      spanDays = 1;
      label = input.specific_date;
    } else {
      const range = input.range ?? "today";
      const w = WINDOWS[range];
      startDays = w.startDays;
      spanDays = w.spanDays;
      label = range;
    }

    ctx.log("tool.get_calendar", { label, startDays, spanDays });
    const events = await getEventsInRange(startDays, spanDays);
    if (!events.length) return { content: `No events for ${label}.` };
    const lines = events.map(
      (e) => `- ${e.start}–${e.end} · ${e.title}${e.location ? ` @ ${e.location}` : ""}`
    );
    return { content: `${label}:\n${lines.join("\n")}`, meta: { count: events.length, window: label } };
  },
});
