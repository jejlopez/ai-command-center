import type { FastifyInstance } from "fastify";
import type { MorningBrief, RightRail } from "../../../shared/types.js";
import { audit } from "../lib/audit.js";
import { generateBrief, latestBrief } from "../skills/brief_generator.js";
import { approvals } from "../lib/approvals.js";

function stubBrief(): MorningBrief {
  const now = new Date();
  return {
    generatedAt: now.toISOString(),
    todayBriefing:
      "Morning. No brief has been generated yet — ask JARVIS to run one or POST /brief/generate.",
    criticalItems: [],
    nextBestMove: null,
    waitingOn: [],
    followUps: [],
    schedule: [],
    budget: { spentToday: 0, budgetToday: 20, currency: "USD", topCategory: "llm" },
    focus: "Generate your first brief to see it here.",
  };
}

function buildRail(): RightRail {
  return {
    approvals: approvals.pending(),
    reminders: [{ id: "r1", title: "Standup at 10:00", dueAt: new Date().toISOString() }],
    blocked: [{ id: "b1", title: "Deploy staging", blockedBy: "Vault not unlocked" }],
    completed: [{ id: "d1", title: "Drafted slice plan", completedAt: new Date().toISOString() }],
  };
}

export async function briefRoutes(app: FastifyInstance): Promise<void> {
  app.get("/brief", async () => {
    audit({ actor: "system", action: "brief.read" });
    return latestBrief() ?? stubBrief();
  });

  app.post("/brief/generate", async () => {
    return generateBrief();
  });

  app.get("/rail", async () => {
    audit({ actor: "system", action: "rail.read" });
    return buildRail();
  });
}
