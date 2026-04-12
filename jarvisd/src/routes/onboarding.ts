import type { FastifyInstance } from "fastify";
import { vault } from "../lib/vault.js";
import { config } from "../lib/config.js";
import { audit } from "../lib/audit.js";
import { detectOllama, CLOUD_PROVIDER_IDS, providerRegistry } from "../lib/providers/registry.js";
import type { OnboardingStatus, OnboardingStep } from "../../../shared/types.js";

async function computeStatus(): Promise<OnboardingStatus> {
  const vaultDone = !vault.isLocked();

  let providersDone = false;
  let privacyDone = false;
  let budgetDone = false;
  let completeSentinel = false;
  if (vaultDone) {
    for (const id of CLOUD_PROVIDER_IDS) {
      const entry = providerRegistry[id];
      if (vault.get(entry.vaultKey) !== null) {
        providersDone = true;
        break;
      }
    }
    privacyDone = vault.get("onboarding.privacy_set") === "1";
    budgetDone = vault.get("onboarding.budget_set") === "1";
    completeSentinel = vault.get("onboarding.complete") === "1";
  }

  const ollama = await detectOllama();
  const cfg = config.get();
  const localDone = ollama.up && cfg.allowedLocalModels.length > 0;

  const steps: OnboardingStep[] = [
    { id: "vault", title: "Unlock vault", done: vaultDone, required: true },
    { id: "providers", title: "Link at least one cloud provider", done: providersDone, required: true },
    { id: "local", title: "Connect a local model (Ollama)", done: localDone, required: false },
    { id: "privacy", title: "Set privacy routing", done: privacyDone, required: true },
    { id: "budget", title: "Set daily budget", done: budgetDone, required: true },
  ];

  const requiredDone = steps.filter((s) => s.required).every((s) => s.done);
  const complete = completeSentinel || requiredDone;

  return { complete, steps };
}

export async function onboardingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/onboarding/status", async (): Promise<OnboardingStatus> => {
    return computeStatus();
  });

  app.post("/onboarding/complete", async (_req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    vault.set("onboarding.complete", "1");
    audit({ actor: "user", action: "onboarding.complete" });
    return { ok: true };
  });

  app.post("/onboarding/reset", async (_req, reply) => {
    if (vault.isLocked()) {
      reply.code(423);
      return { error: "vault locked" };
    }
    vault.delete("onboarding.complete");
    vault.delete("onboarding.privacy_set");
    vault.delete("onboarding.budget_set");
    config.reset();
    audit({ actor: "user", action: "onboarding.reset" });
    return { ok: true };
  });
}
