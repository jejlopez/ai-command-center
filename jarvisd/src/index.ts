import Fastify from "fastify";
import cors from "@fastify/cors";
import { runMigrations, JARVIS_HOME } from "./db/db.js";
import { audit, verifyAuditChain } from "./lib/audit.js";
import { registerWebSocket } from "./lib/ws.js";
import { briefRoutes } from "./routes/brief.js";
import { vaultRoutes } from "./routes/vault.js";
import { askRoutes } from "./routes/ask.js";
import { memoryRoutes } from "./routes/memory.js";
import { approvalsRoutes } from "./routes/approvals.js";
import { connectorRoutes } from "./routes/connectors.js";
import { appleRoutes } from "./routes/apple.js";
import { onboardingRoutes } from "./routes/onboarding.js";
import { providersRoutes } from "./routes/providers.js";
import { configRoutes } from "./routes/config.js";
import { focusBlocksRoutes } from "./routes/focus_blocks.js";
import { todayRoutes } from "./routes/today.js";
import { episodicRoutes } from "./routes/episodic.js";
import { skillsRoutes } from "./routes/skills.js";
import { costRoutes } from "./routes/cost.js";
import { feedbackRoutes } from "./routes/feedback.js";
import { registry } from "./lib/skills.js";
import { startScheduler, initEventBus } from "./lib/workflow.js";
import { dailyRecap } from "./skills/daily_recap.js";
import { planMyDay } from "./skills/plan_my_day.js";
import { budgetWatch } from "./skills/budget_watch.js";
import { meetingPrep } from "./skills/meeting_prep.js";
import { contactEnrich } from "./skills/contact_enrich.js";
import { docSummarize } from "./skills/doc_summarize.js";
import { weeklyReview } from "./skills/weekly_review.js";
import { draftReply } from "./skills/draft_reply.js";
import { followUpSuggest } from "./skills/follow_up_suggest.js";
import { researchBrief } from "./skills/research_brief.js";
import { vault } from "./lib/vault.js";
import type { HealthResponse } from "../../shared/types.js";

const VERSION = "0.0.1";
const startedAt = Date.now();

async function main() {
  runMigrations(); // idempotent; also ran at db module load
  audit({ actor: "system", action: "daemon.start", metadata: { version: VERSION, home: JARVIS_HOME } });

  const app = Fastify({ logger: { transport: { target: "pino-pretty" } } as any });

  await app.register(cors, {
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/]
  });

  await registerWebSocket(app);

  app.get("/health", async (): Promise<HealthResponse> => ({
    status: "ok",
    version: VERSION,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    vaultLocked: vault.isLocked()
  }));

  app.get("/audit/verify", async () => verifyAuditChain());

  await briefRoutes(app);
  await vaultRoutes(app);
  await askRoutes(app);
  await memoryRoutes(app);
  await approvalsRoutes(app);
  await connectorRoutes(app);
  await appleRoutes(app);
  await onboardingRoutes(app);
  await providersRoutes(app);
  await configRoutes(app);
  await focusBlocksRoutes(app);
  await todayRoutes(app);
  await episodicRoutes(app);
  await skillsRoutes(app);
  await costRoutes(app);
  await feedbackRoutes(app);

  // Register built-in skills before the scheduler starts.
  registry.register(dailyRecap);
  registry.register(planMyDay);
  registry.register(budgetWatch);
  registry.register(meetingPrep);
  registry.register(contactEnrich);
  registry.register(docSummarize);
  registry.register(weeklyReview);
  registry.register(draftReply);
  registry.register(followUpSuggest);
  registry.register(researchBrief);

  // Wire the event bus after skills are registered so subscriptions pick up
  // every manifest with an event trigger.
  initEventBus();

  const port = Number(process.env.JARVIS_PORT ?? 8787);
  await app.listen({ host: "127.0.0.1", port });
  app.log.info(`jarvisd v${VERSION} listening on http://127.0.0.1:${port}`);
  app.log.info(`jarvis home: ${JARVIS_HOME}`);

  startScheduler();
}

main().catch((err) => {
  console.error("[jarvisd] fatal:", err);
  process.exit(1);
});
