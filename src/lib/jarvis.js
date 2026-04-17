const BASE = import.meta.env.VITE_JARVIS_URL ?? "http://127.0.0.1:8787";

// Don't auto-unlock-retry on these paths — they're the unlock primitives
// themselves, or we'd recurse.
const UNLOCK_RETRY_SKIP = new Set([
  "/vault/unlock",
  "/vault/lock",
  "/health",
]);

async function rawFetch(method, path, body) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function request(method, path, body) {
  let res = await rawFetch(method, path, body);

  // The daemon re-locks the vault on every restart (tsx watch reload, etc).
  // Transparently unlock + retry once so the UI doesn't crash on every edit.
  if (res.status === 423 && !UNLOCK_RETRY_SKIP.has(path)) {
    try {
      const unlockRes = await rawFetch("POST", "/vault/unlock");
      if (unlockRes.ok) {
        res = await rawFetch(method, path, body);
      }
    } catch {
      // fall through to the original 423 error
    }
  }

  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json())?.error ?? ""; } catch {}
    throw new Error(`${path} → ${res.status}${detail ? ` (${detail})` : ""}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const get  = (p)    => request("GET", p);
const post = (p, b) => request("POST", p, b);
const del  = (p)    => request("DELETE", p);

export const jarvis = {
  // Core
  health:          () => get("/health"),
  brief:           () => get("/brief"),
  rail:            () => get("/rail"),
  generateBrief:   () => post("/brief/generate"),
  approvals:       ()                      => get("/approvals"),
  decideApproval:  (id, decision, reason) =>
    post(`/approvals/${id}/decide`, { decision, reason }),
  ask: (prompt, opts = {}) => post("/ask", { prompt, ...opts }),

  // Vault
  vaultUnlock:     () => post("/vault/unlock"),
  vaultLock:       () => post("/vault/lock"),
  vaultList:       () => get("/vault/list"),

  // Providers
  getProviders:       ()        => get("/providers"),
  setProviderKey:     (id, key) => post(`/providers/${id}/key`, { key }),
  removeProviderKey:  (id)      => del(`/providers/${id}/key`),
  testProvider:       (id)      => post(`/providers/${id}/test`),
  detectLocalModels:  ()        => get("/providers/local/detect"),

  // Config
  getConfig:  ()      => get("/config"),
  setConfig:  (patch) => post("/config", patch),

  // Onboarding
  getOnboarding:      () => get("/onboarding/status"),
  completeOnboarding: () => post("/onboarding/complete"),

  // Audit
  auditVerify: () => get("/audit/verify"),

  // Connectors (Rest of M1 — Google)
  getConnectors:      ()                           => get("/connectors"),
  setConnectorCreds:  (id, { client_id, client_secret }) =>
    post(`/connectors/${id}/creds`, { client_id, client_secret }),
  startConnector:     (id)                         => `${BASE}/connectors/${id}/start`,
  unlinkConnector:    (id)                         => post(`/connectors/${id}/unlink`),
  testConnector:      (id)                         => post(`/connectors/${id}/test`),
  getCalendarEvents:  (days = 1)                   => get(`/connectors/gcal/events?days=${days}`),
  searchDrive:        (q)                          => get(`/connectors/drive/search?q=${encodeURIComponent(q)}`),

  // Cost
  costToday:          ()                           => get("/cost/today"),
  costSummary:        ()                           => get("/cost/summary"),
  costEvents:         ({ since, limit } = {})      => {
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    if (limit != null) params.set("limit", String(limit));
    const qs = params.toString();
    return get(`/cost/events${qs ? `?${qs}` : ""}`);
  },

  // Google provider OAuth ("Sign in with Google" for Gemini)
  googleOAuthSetCreds: ({ client_id, client_secret }) =>
    post("/providers/google/oauth/creds", { client_id, client_secret }),
  googleOAuthStart:    ()                           => `${BASE}/providers/google/oauth/start`,
  googleOAuthUnlink:   ()                           => post("/providers/google/oauth/unlink"),

  // Unified Google data OAuth (one sign-in = Gmail + Calendar + Drive)
  googleUnifiedStatus:  ()        => get("/connectors/google/unified/status"),
  googleUnifiedSetCreds: ({ client_id, client_secret }) =>
    post("/connectors/google/unified/creds", { client_id, client_secret }),
  googleUnifiedUnlink:  ()        => post("/connectors/google/unified/unlink"),

  // Apple native (macOS Mail.app + Calendar.app via AppleScript)
  appleStatus:        ()         => get("/connectors/apple/status"),
  appleConnect:       ()         => post("/connectors/apple/connect"),
  appleTodayEvents:   ()         => get("/connectors/apple/calendar/today"),
  appleUnreadMail:    (limit=10) => get(`/connectors/apple/mail/unread?limit=${limit}`),

  // M2 — Today (merged events + focus blocks)
  getToday:           ()         => get("/today"),
  listFocusBlocks:    (day)      => get(`/focus-blocks${day ? `?day=${encodeURIComponent(day)}` : ""}`),
  createFocusBlock:   ({ title, start, end, notes }) =>
    post("/focus-blocks", { title, start, end, notes }),
  deleteFocusBlock:   (id)       => del(`/focus-blocks/${encodeURIComponent(id)}`),

  // M2 — Brain (memory)
  memoryList:         (kind)     => get(`/memory${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`),
  memoryRecall:       (q, { enhanced = false } = {}) =>
    get(`/memory/recall?q=${encodeURIComponent(q)}${enhanced ? "&enhanced=true" : ""}`),
  memoryRemember:     (input)    => post("/memory/remember", input),
  memoryForget:       (id)       => del(`/memory/${encodeURIComponent(id)}`),
  memoryGet:          (id)       => get(`/memory/${encodeURIComponent(id)}`),

  // M3 — Semantic memory
  memoryEmbedStatus:  ()         => get("/memory/embed/status"),
  importObsidian:     (body)     => post("/memory/import/obsidian", body),

  // M4 — Skill registry + workflow engine
  listSkills:    ()                      => get("/skills"),
  getSkill:      (name)                  => get(`/skills/${encodeURIComponent(name)}`),
  runSkill:      (name, inputs = {})     => post(`/skills/${encodeURIComponent(name)}/run`, { inputs }),
  listSkillRuns: (name, limit = 20)      => get(`/skills/${encodeURIComponent(name)}/runs?limit=${limit}`),
  recentRuns:    (limit = 20)            => get(`/runs?limit=${limit}`),
  getRun:        (id)                    => get(`/runs/${encodeURIComponent(id)}`),
  listWorkflows: ()                      => get("/workflows"),

  // M5 — Security / Trust Protocol
  auditLog:        ({ limit, offset, action, actor, since } = {}) => {
    const p = new URLSearchParams();
    if (limit != null) p.set("limit", String(limit));
    if (offset != null) p.set("offset", String(offset));
    if (action) p.set("action", action);
    if (actor) p.set("actor", actor);
    if (since) p.set("since", since);
    const qs = p.toString();
    return get(`/audit/log${qs ? `?${qs}` : ""}`);
  },
  auditSummary:    (hours = 24) => get(`/audit/summary?hours=${hours}`),
  auditChain:      () => get("/audit/chain"),
  panic:           (reason) => post("/panic", { reason }),
  policyRules:     () => get("/policy/rules"),

  // Feedback + Learning Loops
  submitFeedback:  (body)                => post("/feedback", body),
  listFeedback:    (kind, limit)         => get(`/feedback${kind ? `?kind=${encodeURIComponent(kind)}&limit=${limit ?? 50}` : `?limit=${limit ?? 50}`}`),
  feedbackStats:   (skill)              => get(`/feedback/stats/${encodeURIComponent(skill)}`),
  routingStats:    (taskKind)           => get(`/routing/stats${taskKind ? `?taskKind=${encodeURIComponent(taskKind)}` : ""}`),
  routingExplain:  (kind)               => post("/routing/explain", { kind }),

  // M6 Learning polish
  recordEdit:      (outputId, original, edited) => post("/learning/edit", { outputId, original, edited }),
  recordSnooze:    (itemType, itemId, action, delayMs) => post("/learning/snooze", { itemType, itemId, action, delayMs }),
  snoozeStats:     (itemType) => get(`/learning/snooze/stats${itemType ? `?itemType=${encodeURIComponent(itemType)}` : ""}`),
  bestTiming:      (eventType) => get(`/learning/timing?eventType=${encodeURIComponent(eventType)}`),

  // Orchestration
  orchestrate:     (goal, steps, budgetUsd) => post("/orchestrate", { goal, steps, budgetUsd }),
  dispatch:        (skill, instruction, payload, budgetUsd) => post("/dispatch", { skill, instruction, payload, budgetUsd }),

  // Email search
  emailSearch:     (q, max)            => get(`/email/search?q=${encodeURIComponent(q)}&max=${max ?? 10}`),
  emailForContact: (email)             => get(`/email/for-contact?email=${encodeURIComponent(email)}&max=10`),

  // Email triage (classified inbox from daemon)
  emailTriage:      (limit)             => get(`/email/triage?limit=${limit ?? 50}`),
  emailTriageStats: ()                  => get("/email/triage/stats"),
  emailConnectionStatus: ()            => get("/email/connection-status"),
  emailMessage:     (messageId)         => get(`/email/message/${encodeURIComponent(messageId)}`),
  emailThread:      (threadId)          => get(`/email/thread/${encodeURIComponent(threadId)}`),
  emailMarkRead:    (messageId)         => post(`/email/message/${encodeURIComponent(messageId)}/read`, {}),
  emailSendNow:     (to, subject, body, threadId) => post("/email/send-now", { to, subject, body, threadId }),
  emailDrafts:      (limit)             => get(`/email/drafts?limit=${limit ?? 20}`),

  // Email intelligence
  emailAiDraft:    (dealId, type, context) => post("/email/ai-draft", { deal_id: dealId, type, context }),
  emailStyleLearn: (original, edited, dealId, contactId, context) => post("/email/style-learn", { original, edited, deal_id: dealId, contact_id: contactId, context }),

  // CRM / Sales
  crmStatus:       ()                  => get("/crm/status"),
  crmSync:         ()                  => post("/crm/sync"),
  crmPipeline:     ()                  => get("/crm/pipeline"),
  crmStats:        ()                  => get("/crm/stats"),
  crmDeals:        (pipeline, status)  => get(`/crm/deals?pipeline=${encodeURIComponent(pipeline ?? "New pipeline")}&status=${status ?? "open"}`),
  crmDeal:         (id)                => get(`/crm/deals/${encodeURIComponent(id)}`),
  crmUpdateDeal:   (id, data)          => post(`/crm/deals/${encodeURIComponent(id)}`, data),
  crmLeads:        (status)            => get(`/crm/leads?status=${status ?? "active"}`),
  crmCommand:      ()                  => get("/crm/command"),
};
