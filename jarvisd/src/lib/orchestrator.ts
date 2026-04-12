// JARVIS Orchestrator — decomposes tasks, dispatches sub-agents, collects results.
//
// Cost cascade: start cheap, escalate on failure.
// Tier mapping:
//   cheap    → local Ollama or Haiku
//   standard → Sonnet
//   premium  → Opus
//
// The orchestrator never calls models directly — it dispatches skills
// from the registry and collects their typed outputs.

import { randomUUID } from "node:crypto";
import { db } from "../db/db.js";
import { audit } from "./audit.js";
import { bus } from "./events.js";
import { runSkill } from "./workflow.js";
import { registry } from "./skills.js";
import { learnedRoute } from "./router_learning.js";
import { episodic } from "./episodic.js";
import type {
  OrchestrationPlan,
  OrchestrationStep,
  SubAgentOutput,
} from "../../../shared/types.js";

// Cost tier → router kind mapping
const TIER_TO_KIND: Record<string, string> = {
  cheap: "classification",     // routes to local/Haiku
  standard: "chat",            // routes to Sonnet
  premium: "complex_reasoning", // routes to Opus
};

const ESCALATION: Record<string, string> = {
  cheap: "standard",
  standard: "premium",
};

export interface OrchestrateOpts {
  goal: string;
  steps: Array<{
    skill: string;
    instruction: string;
    payload?: Record<string, unknown>;
    dependsOn?: string[];
  }>;
  budgetUsd?: number;
}

export async function orchestrate(opts: OrchestrateOpts): Promise<OrchestrationPlan> {
  const planId = randomUUID();
  let spentUsd = 0;
  const budget = opts.budgetUsd ?? 5.0;

  const plan: OrchestrationPlan = {
    id: planId,
    goal: opts.goal,
    steps: opts.steps.map((s, i) => ({
      id: `step-${i}`,
      skill: s.skill,
      instruction: s.instruction,
      payload: s.payload ?? {},
      dependsOn: s.dependsOn,
      status: "pending" as const,
    })),
    totalBudgetUsd: budget,
    createdAt: new Date().toISOString(),
  };

  audit({
    actor: "orchestrator",
    action: "orchestration.start",
    subject: planId,
    metadata: { goal: opts.goal, stepCount: plan.steps.length, budget },
  });

  bus.emit("orchestration.started", { planId, goal: opts.goal, steps: plan.steps.length });

  // Execute steps respecting dependencies
  const completed = new Set<string>();

  while (true) {
    // Find next runnable steps (deps satisfied, not yet run)
    const runnable = plan.steps.filter(
      (s) =>
        s.status === "pending" &&
        (!s.dependsOn || s.dependsOn.every((d) => completed.has(d)))
    );

    if (runnable.length === 0) break;

    // Budget check
    if (spentUsd >= budget) {
      audit({
        actor: "orchestrator",
        action: "orchestration.budget_exceeded",
        subject: planId,
        metadata: { spent: spentUsd, budget },
      });
      // Mark remaining as skipped
      for (const s of plan.steps) {
        if (s.status === "pending") s.status = "skipped";
      }
      break;
    }

    // Run steps sequentially (parallel would need file locking for Coder)
    for (const step of runnable) {
      step.status = "running";

      const skill = registry.get(step.skill);
      if (!skill) {
        step.status = "failed";
        step.output = {
          taskId: step.id,
          status: "failed",
          result: { error: `Skill "${step.skill}" not found` },
          model: "none",
          costUsd: 0,
          tokensIn: 0,
          tokensOut: 0,
          durationMs: 0,
        };
        continue;
      }

      // Determine cost tier from manifest
      const manifest = skill.manifest as any;
      const tier = manifest.costTier ?? "standard";
      const escalationTier = manifest.escalationTier ?? ESCALATION[tier];
      const maxRetries = manifest.maxRetries ?? 1;

      let attempt = 0;
      let currentTier = tier;
      let success = false;

      while (attempt <= maxRetries && !success) {
        const startMs = Date.now();

        try {
          const run = await runSkill(step.skill, {
            inputs: {
              ...step.payload,
              _instruction: step.instruction,
              _tier: currentTier,
              _planId: planId,
              _stepId: step.id,
            },
            triggeredBy: "event",
          });

          const durationMs = Date.now() - startMs;
          const cost = run.costUsd ?? 0;
          spentUsd += cost;

          if (run.status === "completed") {
            step.status = "completed";
            step.output = {
              taskId: step.id,
              status: "completed",
              result: (run.output as Record<string, unknown>) ?? {},
              model: (run.output as any)?.model ?? "unknown",
              costUsd: cost,
              tokensIn: run.tokensIn ?? 0,
              tokensOut: run.tokensOut ?? 0,
              durationMs,
              escalated: attempt > 0,
              escalationReason: attempt > 0 ? `Escalated from ${tier} to ${currentTier}` : undefined,
            };
            completed.add(step.id);
            success = true;
          } else {
            // Failed — try escalation
            attempt++;
            if (attempt <= maxRetries && escalationTier) {
              currentTier = escalationTier;
              audit({
                actor: "orchestrator",
                action: "orchestration.escalate",
                subject: step.id,
                metadata: { from: tier, to: currentTier, attempt },
              });
            }
          }
        } catch (err: any) {
          attempt++;
          if (attempt <= maxRetries && escalationTier) {
            currentTier = escalationTier;
          } else {
            step.status = "failed";
            step.output = {
              taskId: step.id,
              status: "failed",
              result: { error: err?.message ?? String(err) },
              model: "unknown",
              costUsd: 0,
              tokensIn: 0,
              tokensOut: 0,
              durationMs: Date.now() - startMs,
            };
          }
        }
      }
    }
  }

  // Summary
  const completedCount = plan.steps.filter((s) => s.status === "completed").length;
  const failedCount = plan.steps.filter((s) => s.status === "failed").length;

  audit({
    actor: "orchestrator",
    action: "orchestration.complete",
    subject: planId,
    metadata: {
      goal: opts.goal,
      completed: completedCount,
      failed: failedCount,
      totalCostUsd: spentUsd,
    },
  });

  episodic.snapshot({
    kind: "custom",
    title: `Orchestration: ${opts.goal}`,
    body: {
      planId,
      steps: plan.steps.length,
      completed: completedCount,
      failed: failedCount,
      costUsd: spentUsd,
    },
    actor: "orchestrator",
  });

  bus.emit("orchestration.completed", {
    planId,
    completed: completedCount,
    failed: failedCount,
    costUsd: spentUsd,
  });

  return plan;
}

/** Quick single-skill dispatch with cost cascade. */
export async function dispatch(
  skillName: string,
  instruction: string,
  payload: Record<string, unknown> = {},
  budgetUsd = 1.0
): Promise<SubAgentOutput> {
  const plan = await orchestrate({
    goal: instruction,
    steps: [{ skill: skillName, instruction, payload }],
    budgetUsd,
  });

  const step = plan.steps[0];
  return step.output ?? {
    taskId: step.id,
    status: "failed",
    result: { error: "No output" },
    model: "none",
    costUsd: 0,
    tokensIn: 0,
    tokensOut: 0,
    durationMs: 0,
  };
}
