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
// ── Core skills (kept) ──
import { planMyDay } from "./skills/plan_my_day.js";
import { budgetWatch } from "./skills/budget_watch.js";
import { contactEnrich } from "./skills/contact_enrich.js";
import { followUpSuggest } from "./skills/follow_up_suggest.js";
import { emailTriage } from "./skills/email_triage.js";
import { emailDealSync } from "./skills/email_deal_sync.js";
import { leadResearch } from "./skills/lead_research.js";
import { proposalGenerator } from "./skills/proposal_generator.js";
import { proactiveAgent } from "./skills/proactive_agent.js";
import { crmMorningBrief } from "./skills/crm_morning_brief.js";
import { crmEodRecap } from "./skills/crm_eod_recap.js";
import { crmMeetingPrep } from "./skills/crm_meeting_prep.js";
import { crmDealPlaybook } from "./skills/crm_deal_playbook.js";
import { crmFollowupSequences } from "./skills/crm_followup_sequences.js";
import { crmPipelineGap } from "./skills/crm_pipeline_gap.js";
import { proposalExpiry } from "./skills/proposal_expiry.js";
import { dealStageAutomation } from "./skills/deal_stage_automation.js";
import { pipelineSnapshot } from "./skills/pipeline_snapshot.js";
import { rateOptimizer } from "./skills/rate_optimizer.js";
import { proposalFollowup } from "./skills/proposal_followup.js";
// ── New/consolidated skills ──
import { masterEmailAgent } from "./skills/master_email_agent.js";
import { meetingIntelligence } from "./skills/meeting_intelligence.js";
import { winLossAnalyzer } from "./skills/win_loss_analyzer.js";
import { whaleDetector } from "./skills/whale_detector.js";
import { objectionCoach } from "./skills/objection_coach.js";
import { inboundCapture } from "./skills/inbound_capture.js";
import { nurtureEngine } from "./skills/nurture_engine.js";
import { crmRoutes } from "./routes/crm.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { learningRoutes } from "./routes/learning.js";
import { orchestrateRoutes } from "./routes/orchestrate.js";
import { emailRoutes } from "./routes/email.js";
import { emailSearchRoutes } from "./routes/email_search.js";
import { emailActionsRoutes } from "./routes/email_actions.js";
import { emailDraftRoutes } from "./routes/email_draft.js";
import { calendarActionRoutes } from "./routes/calendar_actions.js";
import { crmActionsRoutes } from "./routes/crm_actions.js";
import { browserActionsRoutes } from "./routes/browser_actions.js";
import { vault } from "./lib/vault.js";
import { policyEngine } from "./lib/policy.js";
import { policyRoutes } from "./routes/policy.js";
import { panicRoutes } from "./routes/panic.js";
import { auditRoutes } from "./routes/audit.js";
import { voiceRoutes } from "./routes/voice.js";
import { proposalPageRoutes } from "./routes/proposal_page.js";
import { registerRateLimiter, registerRateLimitResetRoute } from "./lib/rate_limit.js";
import type { HealthResponse } from "../../shared/types.js";

const VERSION = "0.0.1";
const startedAt = Date.now();

async function main() {
  runMigrations(); // idempotent; also ran at db module load
  await policyEngine.init();
  audit({ actor: "system", action: "daemon.start", metadata: { version: VERSION, home: JARVIS_HOME } });

  const app = Fastify({ logger: { transport: { target: "pino-pretty" } } as any });

  await app.register(cors, {
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/]
  });
  await app.register(import("@fastify/multipart"));

  registerRateLimiter(app);
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
  await policyRoutes(app);
  await learningRoutes(app);
  await orchestrateRoutes(app);
  await emailRoutes(app);
  await emailSearchRoutes(app);
  await emailActionsRoutes(app);
  await emailDraftRoutes(app);
  await calendarActionRoutes(app);
  await crmActionsRoutes(app);
  await browserActionsRoutes(app);
  await crmRoutes(app);
  await webhookRoutes(app);
  await panicRoutes(app);
  await auditRoutes(app);
  await voiceRoutes(app);
  await proposalPageRoutes(app);

  // Test-only helpers (safe — only exposed when tests set LOG_LEVEL=error).
  if (process.env.LOG_LEVEL === "error") {
    registerRateLimitResetRoute(app);
  }

  // Register built-in skills before the scheduler starts.
  // ── Core skills ──
  registry.register(planMyDay);
  registry.register(budgetWatch);
  registry.register(contactEnrich);
  registry.register(followUpSuggest);
  registry.register(emailTriage);
  registry.register(emailDealSync);
  registry.register(leadResearch);
  registry.register(proposalGenerator);
  registry.register(proactiveAgent);
  registry.register(crmMorningBrief);
  registry.register(crmEodRecap);
  registry.register(crmMeetingPrep);
  registry.register(crmDealPlaybook);
  registry.register(crmFollowupSequences);
  registry.register(crmPipelineGap);
  registry.register(proposalExpiry);
  registry.register(dealStageAutomation);
  registry.register(pipelineSnapshot);
  registry.register(rateOptimizer);
  registry.register(proposalFollowup);
  // ── New/consolidated skills ──
  registry.register(masterEmailAgent);
  registry.register(meetingIntelligence);
  registry.register(winLossAnalyzer);
  registry.register(whaleDetector);
  registry.register(objectionCoach);
  registry.register(inboundCapture);
  registry.register(nurtureEngine);

  // Wire the event bus after skills are registered so subscriptions pick up
  // every manifest with an event trigger.
  initEventBus();

  // Check Claude CLI availability and enable if found
  const { isCliAvailable } = await import("./lib/providers/claude_cli.js");
  const { setCliEnabled } = await import("./lib/router.js");
  const cliOk = await isCliAvailable();
  setCliEnabled(cliOk);
  if (cliOk) {
    app.log.info("Claude CLI detected — using subscription (CLI-first, API fallback)");
  } else {
    app.log.info("Claude CLI not found — using API keys only");
  }

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
