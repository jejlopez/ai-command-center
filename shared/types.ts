// Shared contracts between jarvisd and web/mobile clients.
// Keep this file dependency-free.

// ---------------------------------------------------------------------------
// WebSocket push messages (daemon → client)
// ---------------------------------------------------------------------------

export type WsMessageType =
  | "skill.started"
  | "skill.progress"
  | "skill.completed"
  | "skill.failed"
  | "brief.generated"
  | "cost.alert"
  | "approval.new"
  | "approval.decided"
  | "memory.remembered"
  | "connected";

export interface WsMessage {
  type: WsMessageType;
  ts: string;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Feedback + Learning Loops
// ---------------------------------------------------------------------------

export type FeedbackRating = "positive" | "negative" | "neutral";

export interface FeedbackEntry {
  id: string;
  runId: string | null;
  kind: "skill_run" | "ask" | "brief" | "general";
  rating: FeedbackRating;
  reason?: string;
  createdAt: string;
}

export interface CreateFeedbackBody {
  runId?: string;
  kind: FeedbackEntry["kind"];
  rating: FeedbackRating;
  reason?: string;
}

export interface RoutingRecord {
  id: number;
  taskKind: string;
  provider: string;
  model: string;
  success: boolean;
  feedbackRating?: FeedbackRating;
  costUsd: number;
  durationMs: number;
  createdAt: string;
}

export interface RouteExplanation {
  provider: string;
  model: string;
  reason: string;
  learned?: string;
  consecutiveSuccesses?: number;
  memoryCited?: number;
}

// ---------------------------------------------------------------------------
// Sub-Agent Orchestration — typed skill contracts
// ---------------------------------------------------------------------------

/** Every sub-agent skill declares its input/output schemas. */
export interface SubAgentManifest extends SkillManifest {
  role: "planner" | "coder" | "reviewer" | "researcher" | "operator";
  inputSchema: Record<string, { type: string; required?: boolean; description: string }>;
  outputSchema: Record<string, { type: string; description: string }>;
  costTier: "cheap" | "standard" | "premium";  // default model tier
  escalationTier?: "standard" | "premium";      // escalate to on failure
  maxRetries?: number;
  timeoutMs?: number;
}

/** Typed payload sent to a sub-agent. */
export interface SubAgentInput {
  taskId: string;
  parentRunId?: string;
  instruction: string;
  payload: Record<string, unknown>;
  costBudgetUsd?: number;
  modelOverride?: string;
}

/** Typed result from a sub-agent. */
export interface SubAgentOutput {
  taskId: string;
  status: "completed" | "failed" | "escalated";
  result: Record<string, unknown>;
  model: string;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
  escalated?: boolean;
  escalationReason?: string;
}

/** Orchestration plan — how JARVIS decomposes a task. */
export interface OrchestrationPlan {
  id: string;
  goal: string;
  steps: OrchestrationStep[];
  totalBudgetUsd?: number;
  createdAt: string;
}

export interface OrchestrationStep {
  id: string;
  skill: string;
  instruction: string;
  payload: Record<string, unknown>;
  dependsOn?: string[];  // step IDs that must complete first
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  output?: SubAgentOutput;
}

export type TrustLevel = "low" | "medium" | "high" | "verified";
export type Priority = "critical" | "high" | "normal" | "low";

export interface BriefItem {
  id: string;
  title: string;
  detail?: string;
  priority: Priority;
  source?: string;
}

export interface ScheduleBlock {
  id: string;
  start: string; // ISO
  end: string;   // ISO
  title: string;
  location?: string;
}

export interface BudgetSummary {
  spentToday: number;
  budgetToday: number;
  topCategory?: string;
  currency: string;
}

export interface MorningBrief {
  generatedAt: string;
  todayBriefing: string;
  criticalItems: BriefItem[];
  nextBestMove: BriefItem | null;
  waitingOn: BriefItem[];
  followUps: BriefItem[];
  schedule: ScheduleBlock[];
  budget: BudgetSummary;
  focus: string;
}

export interface Approval {
  id: string;
  title: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
  requestedAt: string;
  skill: string;
  payload: Record<string, unknown>;
}

export interface Reminder {
  id: string;
  title: string;
  dueAt: string;
}

export interface BlockedItem {
  id: string;
  title: string;
  blockedBy: string;
}

export interface CompletedItem {
  id: string;
  title: string;
  completedAt: string;
}

export interface RightRail {
  approvals: Approval[];
  reminders: Reminder[];
  blocked: BlockedItem[];
  completed: CompletedItem[];
}

export interface AskRequest {
  prompt: string;
  context?: string;
  privacy?: "public" | "personal" | "sensitive" | "secret";
}

export interface AskResponse {
  id: string;
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  version: string;
  uptimeSec: number;
  vaultLocked: boolean;
}

// -----------------------------------------------------------------------------
// Onboarding + Settings contract (M1)
// -----------------------------------------------------------------------------

export type ProviderId = "anthropic" | "openai" | "google" | "groq" | "ollama";

export interface ProviderStatus {
  id: ProviderId;
  linked: boolean;       // creds present in vault (cloud) or reachable (local)
  available: boolean;    // able to make a real call right now
  models?: string[];     // populated for local (ollama)
  lastError?: string;
  authMode?: "api_key" | "oauth"; // google supports both
}

export interface ProviderTestResult {
  ok: boolean;
  latencyMs: number;
  model?: string;
  error?: string;
}

export type PrivacyDomain = "finance" | "health" | "work" | "personal";

export interface JarvisConfig {
  dailyBudgetUsd: number;
  currency: string;                    // ISO 4217, default "USD"
  privacyLocalOnly: PrivacyDomain[];   // these domains route local-only
  allowedLocalModels: string[];        // which ollama models are allowed
  preferredCloudModel?: string;        // default cloud model name
}

export type OnboardingStepId = "vault" | "providers" | "local" | "privacy" | "budget";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  done: boolean;
  required: boolean;
}

export interface OnboardingStatus {
  complete: boolean;
  steps: OnboardingStep[];
}

// Request bodies

export interface SetProviderKeyBody {
  key: string;
}

export interface ConfigPatchBody {
  dailyBudgetUsd?: number;
  currency?: string;
  privacyLocalOnly?: PrivacyDomain[];
  allowedLocalModels?: string[];
  preferredCloudModel?: string;
}

// Endpoint map (for client + tests):
//
//   GET    /onboarding/status        -> OnboardingStatus
//   POST   /onboarding/complete      -> { ok: true }
//   POST   /onboarding/reset         -> { ok: true }    (dev only)
//
//   GET    /providers                -> ProviderStatus[]
//   POST   /providers/:id/key        body SetProviderKeyBody -> { ok: true }
//   DELETE /providers/:id/key        -> { ok: true }
//   POST   /providers/:id/test       -> ProviderTestResult
//   GET    /providers/local/detect   -> { up: boolean; models: string[] }
//
//   GET    /config                   -> JarvisConfig
//   POST   /config                   body ConfigPatchBody -> JarvisConfig  (merged)
//
// Behavior notes:
// - All endpoints require an unlocked vault EXCEPT:
//     GET /onboarding/status, POST /onboarding/complete, GET /providers/local/detect,
//     GET /providers/google/oauth/callback (must be reachable from browser redirect)
// - POST /providers/:id/key for id='ollama' is a 400 error (local has no key).
// - POST /providers/:id/test for a cloud provider without a key OR oauth is a 400 error.
// - Config is stored in a single JSON blob in the new `jarvis_config` table (key='singleton').
// - Onboarding steps are computed from state each call (vault unlocked?, >=1 cloud key set?, ollama reachable?, config saved with privacy + budget?).
// - Every state-changing endpoint writes an audit row.

// Google provider OAuth (Gemini via OAuth bearer token instead of API key)
//
//   POST /providers/google/oauth/creds  body SetConnectorCredsBody -> { ok, authUrl }
//   GET  /providers/google/oauth/start                             -> 302 redirect
//   GET  /providers/google/oauth/callback                          -> HTML success page
//   POST /providers/google/oauth/unlink                            -> { ok: true }
//
// Google provider `linked` = (google_api_key OR google.oauth_refresh_token is present)
// Google provider `available` = same as linked in list (eager test isn't run on every list call)
// When OAuth is present, the google provider's testFn exchanges the refresh_token for
// an access token as proof of auth; the adapter for actual inference calls is a later slice.

// -----------------------------------------------------------------------------
// M4 batch 2 + surfaces — event bus, more skills, cost events, filled pages
// -----------------------------------------------------------------------------

export interface CostEventRow {
  id: number;
  ts: string;
  provider: string;
  model: string;
  taskKind: string | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  skill: string | null;
  runId: string | null;
}

export interface CostSeriesPoint {
  day: string;      // YYYY-MM-DD (local)
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
}

export interface CostSummary {
  today: CostToday;
  last7Days: CostSeriesPoint[];
  topModels: Array<{ model: string; costUsd: number; runs: number }>;
}

// Endpoints:
//   GET /cost/events?since=ISO&limit=N  -> CostEventRow[]
//   GET /cost/summary                     -> CostSummary
//
// Event bus (internal to daemon, no HTTP):
//   emit("approval.decided",   { id, decision, skill, payload })
//   emit("memory.remembered",  { nodeId, kind, label })
//   emit("brief.generated",    { runId })
//   emit("skill.completed",    { runId, skill })
//
// Skills subscribe via SkillManifest.triggers: { kind: "event", event: "<name>" }.
// When an event fires, the workflow engine runs every subscribed skill with
// the event payload merged into `inputs.event`. Skill runs from events get
// `triggeredBy: "event"`.

// -----------------------------------------------------------------------------
// M4 — Skill registry + workflow engine (batch 1)
//
// A skill is a self-contained unit of work JARVIS can run on demand or on a
// trigger. Each skill declares a manifest (scopes, router hints, triggers)
// and an entrypoint. The workflow engine runs skills from three sources:
// manual (user command), cron (scheduled), or event (daemon-emitted).
// -----------------------------------------------------------------------------

export type SkillScope =
  | "memory.read"
  | "memory.write"
  | "gmail.read"
  | "gcal.read"
  | "drive.read"
  | "vault.read"
  | "llm.cloud"
  | "llm.local"
  | "net.out"
  | "fs.vault.read"
  | "fs.vault.write";

export type SkillTrigger =
  | { kind: "manual" }
  | { kind: "cron"; expr: string }          // e.g. "0 8 * * *" — daily 8am
  | { kind: "event"; event: string };       // e.g. "approval.decided"

export interface SkillManifest {
  name: string;                  // unique id, e.g. "daily_recap"
  title: string;                 // human title
  description: string;
  version: string;               // semver
  author?: string;
  scopes: SkillScope[];
  routerHint?:
    | "classification"
    | "extraction"
    | "summary"
    | "routine_code"
    | "complex_reasoning"
    | "long_context"
    | "high_risk"
    | "vision"
    | "chat";
  triggers: SkillTrigger[];
  inputs?: Array<{ name: string; type: "string" | "number" | "boolean"; required?: boolean; default?: unknown; description?: string }>;
}

export type SkillRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface SkillRun {
  id: string;
  skill: string;
  status: SkillRunStatus;
  triggeredBy: "manual" | "cron" | "event";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  inputs?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
}

export interface SkillRunRequest {
  inputs?: Record<string, unknown>;
}

// Endpoints:
//   GET    /skills                             -> SkillManifest[]
//   GET    /skills/:name                       -> SkillManifest | 404
//   POST   /skills/:name/run   body SkillRunRequest -> SkillRun (synchronous, blocks until done for MVP)
//   GET    /skills/:name/runs?limit=20         -> SkillRun[]
//   GET    /runs?limit=20                      -> SkillRun[]   (recent across all skills)
//   GET    /runs/:id                           -> SkillRun | 404
//   GET    /workflows                          -> { skill, trigger, nextRun? }[]  (active cron triggers)
//
// Behavior:
// - Skills are registered in code at daemon boot (M4 batch 1 has no dynamic
//   loader — that lands later).
// - The workflow engine owns a single in-process scheduler for cron triggers.
//   Each cron tick calls the skill with no inputs and records a SkillRun.
// - Runs persist in a new `skill_runs` table and are snapshotted to episodic
//   memory as `kind: "skill_run"`.
// - Scopes are declared but NOT yet enforced at runtime — that lands in M5.

// -----------------------------------------------------------------------------
// M3 — Semantic memory upgrade (batch 1)
//
// Vectors via sqlite-vec, keyword fallback via SQLite FTS5, graph walk on top.
// Embeddings are computed locally via Ollama (default model: nomic-embed-text);
// if Ollama is unreachable or the model isn't installed, memory degrades
// gracefully to FTS5-only recall.
// -----------------------------------------------------------------------------

// Public wire shape for /memory/recall (matches the daemon's internal
// RecallResult but defined here so UI + tests can import one type).
export interface RecallMemoryNode {
  id: string;
  kind: string;
  label: string;
  body: string | null;
  filePath: string | null;
  trust: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecallResult {
  compiled: string;
  tokenEstimate: number;
  nodes: RecallMemoryNode[];
  related: Array<{ src: string; dst: string; relation: string }>;
  // --- M3 extensions (populated when ?enhanced=true) ---
  hits?: RecallHit[];
  embedStatus?: EmbedStatus;
}

export type RecallSource = "vector" | "fts" | "graph" | "hybrid";

export interface RecallHit {
  nodeId: string;
  score: number;          // 0..1 normalized
  via: RecallSource;
}

export interface EmbedStatus {
  ok: boolean;
  provider: "ollama";
  model: string;
  dims: number;           // embedding vector size
  error?: string;
}

export interface ObsidianImportBody {
  path: string;           // absolute path to a vault folder
  kind?: "person" | "project" | "task" | "fact" | "event" | "pref";
  defaultTrust?: number;
  dryRun?: boolean;
}

export interface ObsidianImportResult {
  scanned: number;
  imported: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
}

// Endpoints:
//   GET  /memory/embed/status                -> EmbedStatus
//   POST /memory/import/obsidian             body ObsidianImportBody -> ObsidianImportResult
//   GET  /memory/recall?q=...&enhanced=true  -> RecallResult (with optional enhanced fields)
//
// The existing /memory/recall stays backward compatible. When `enhanced=true`,
// RecallResult populates `hits` (per-node scores + source) and `embedStatus`.
//
// When Ollama is down at read time, recall returns FTS5-only hits and
// `embedStatus.ok = false` with an error string. Writes still succeed, but the
// node's embedding column stays null until the next remember-or-rebuild call.
//
// memory.remember now additionally:
//   1. Writes a row to memory_fts5(label, body) — SQLite FTS5 virtual table
//   2. If Ollama is available, calls the embedding model and stores the
//      resulting blob in memory_vectors via sqlite-vec.

// -----------------------------------------------------------------------------
// M2 — Today surface (focus blocks) + Brain surface (memory)
// -----------------------------------------------------------------------------

export interface FocusBlock {
  id: string;
  title: string;
  start: string;    // ISO
  end: string;      // ISO
  notes?: string;
  createdAt: string;
}

export interface CreateFocusBlockBody {
  title: string;
  start: string;
  end: string;
  notes?: string;
}

// A combined "day" view: calendar events + focus blocks, ordered by start time,
// with conflict detection pre-computed server-side.
export type TodayItemKind = "event" | "focus";

export interface TodayItem {
  kind: TodayItemKind;
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  calendar?: string;
  notes?: string;
  conflictsWith: string[]; // ids of other TodayItems that overlap
}

export interface TodayView {
  date: string;          // ISO date (YYYY-MM-DD)
  events: TodayItem[];   // from Apple Calendar (or stub if unavailable)
  focusBlocks: TodayItem[];
  all: TodayItem[];      // merged + sorted
  conflictCount: number;
}

// Endpoints:
//   GET    /today                      -> TodayView
//   GET    /focus-blocks?day=YYYY-MM-DD -> FocusBlock[]
//   POST   /focus-blocks                body CreateFocusBlockBody -> FocusBlock
//   DELETE /focus-blocks/:id            -> { ok: true }
//
// Behavior:
// - /today merges Apple Calendar events + focus blocks. If Apple isn't
//   available, events = []; focusBlocks still render.
// - Conflict detection is transitive: any pair of items overlapping each other
//   list each other's ids in conflictsWith.
// - Focus blocks persist in a new `focus_blocks` table.

// -----------------------------------------------------------------------------
// Rest of M1 — Google connectors (Gmail + Calendar + Drive) + header polish
// -----------------------------------------------------------------------------

export type ConnectorId = "gmail" | "gcal" | "drive";

export interface ConnectorStatus {
  id: ConnectorId;
  linked: boolean;
  available: boolean;     // creds present + token refresh works
  account?: string;       // email address if known
  lastError?: string;
}

export interface ConnectorsStatus {
  gmail: ConnectorStatus;
  gcal: ConnectorStatus;
  drive: ConnectorStatus;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;          // ISO
  end: string;            // ISO
  location?: string;
  attendees?: string[];
  htmlLink?: string;
  allDay?: boolean;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;  // ISO
  iconLink?: string;
}

export interface SetConnectorCredsBody {
  client_id: string;
  client_secret: string;
}

export interface CostToday {
  spentUsd: number;
  budgetUsd: number;
}

// Endpoint map:
//
//   GET  /connectors                     -> ConnectorsStatus
//   POST /connectors/:id/creds            body SetConnectorCredsBody -> { ok: true, authUrl: string }
//                                         id in {gmail, gcal, drive}; stores client_id/secret in vault under `<id>.client_id` / `<id>.client_secret`
//                                         returns the OAuth start URL so UI can open it directly
//   GET  /connectors/:id/start            -> 302 redirect to Google OAuth consent URL (also usable directly in browser)
//   GET  /connectors/:id/callback         -> handles OAuth code, stores refresh_token in vault under `<id>.refresh_token`, returns HTML success page
//   POST /connectors/:id/unlink           -> removes refresh_token (keeps client_id/secret); { ok: true }
//   POST /connectors/:id/test             -> { ok: bool, latencyMs, error? } (makes a minimal API call)
//
//   GET  /connectors/gcal/events?days=1   -> CalendarEvent[]  (events from now until now+days)
//   GET  /connectors/drive/search?q=foo   -> DriveFile[]       (max 20 results)
//
//   GET  /cost/today                      -> CostToday (already exists, re-declare here for UI contract)
//
// Behavior:
// - All connector endpoints require vault unlocked (423 if not), EXCEPT GET /connectors/:id/callback (must be reachable from browser redirect).
// - Each connector has its own OAuth scope:
//     gmail  = https://www.googleapis.com/auth/gmail.readonly
//     gcal   = https://www.googleapis.com/auth/calendar.readonly
//     drive  = https://www.googleapis.com/auth/drive.readonly
// - Redirect URI is always http://127.0.0.1:8787/connectors/<id>/callback — UI instructs user to add all three in their Google OAuth client.
// - Brief generator, when gcal is linked, uses gcal events as the `schedule` block on the next `POST /brief/generate`.
// - If connector test or refresh fails, `available=false` and `lastError` set; `linked` stays true (creds are there, just broken).
