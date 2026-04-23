# JARVIS OS — Master Implementation Plan

> Pivot: from web dashboard → **personal operating system**. Cross-surface (desktop shell + phone companion), multi-model (Claude, Codex, local LLMs), graph-based memory, hard security boundary. Two engineers working in parallel without merge conflicts.

---

## 0. North Star

JARVIS OS is a **local-first personal OS** that:

1. Opens every morning as your command center (desktop + mobile).
2. Orchestrates specialized agents across **multiple models** — routes to the right brain for the job.
3. Remembers everything through a **graph-based memory** (Graphiti-style temporal KG + Obsidian-style markdown vault) instead of stuffing raw history into context.
4. Treats security as the foundation, not a feature — vault, sandboxed local LLMs, scoped tool permissions, audit trail.
5. Can itself build/deploy websites and tools (it's a platform, not a page).

Design language: dark navy-black, cyan/teal JARVIS accent, glass panels, Stark-lab ambience. Semantic colors per master plan (cyan=core, blue=planning, amber=approval, red=blocked, green=done, purple=brain).

---

## 1. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                 │
│  Desktop Shell (Tauri/Electron)   Mobile Companion (Expo RN)   │
│  Web Dashboard (Vite+React)                                    │
└──────────────┬─────────────────────────────┬───────────────────┘
               │  gRPC/WebSocket              │
┌──────────────▼─────────────────────────────▼──────────────────┐
│                    JARVIS CORE (local daemon)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ Orchestrator │→ │ Model Router │→ │  Skill Registry  │    │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘    │
│         │                 │                   │              │
│  ┌──────▼─────────────────▼───────────────────▼────────┐     │
│  │           Memory Gateway  (the ONLY way in/out)     │     │
│  │  ┌───────────┐ ┌──────────────┐ ┌────────────────┐  │     │
│  │  │ Graph KG  │ │ MD Vault     │ │ Vector / SQL   │  │     │
│  │  │(Graphiti) │ │ (Obsidian)   │ │ (pgvector/SQLi)│  │     │
│  │  └───────────┘ └──────────────┘ └────────────────┘  │     │
│  └─────────────────────────────────────────────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │ Vault (age)  │  │ Policy/ACL   │  │ Audit Log (WORM) │    │
│  └──────────────┘  └──────────────┘  └──────────────────┘    │
└───────────────┬───────────────────────────────────────────────┘
                │
┌───────────────▼───────────────────────────────────────────────┐
│                    EXECUTION ZONES                            │
│  Cloud models: Claude · Codex · Gemini · OpenAI               │
│  Local sandbox: Ollama/llama.cpp in isolated VM (Lima/UTM)    │
│  Connectors:   Gmail · GCal · CRM · Drive · Browser · Shell   │
└───────────────────────────────────────────────────────────────┘
```

**Key choices:**
- **Local-first daemon** written in Rust or Node (TypeScript) running on the user's machine. All clients (desktop/mobile/web) are thin views over this core via WebSocket + REST.
- **Shell = Tauri** (tiny binary, system tray, native notifications, no Chromium bloat). Web build ships the same React code.
- **Mobile = Expo React Native** — shares design system with desktop; talks to the same daemon over LAN/Tailscale or a tunneled endpoint.
- **Database = SQLite + pgvector-compatible (sqlite-vec)** for local-first, with optional Supabase sync for multi-device.

---

## 2. Multi-Model Strategy

### Model Router
Every agent call goes through `ModelRouter.route(task)` which picks based on:

| Task class            | Default model              | Fallback          |
|-----------------------|----------------------------|-------------------|
| Classification/tag    | local (Llama 3.1 8B)       | Haiku             |
| Extraction/summary    | Haiku / Gemini Flash       | local             |
| Routine coding        | Codex (GPT-5)              | Sonnet            |
| Complex reasoning     | Claude Opus 4.6 1M         | Gemini 2.5 Pro    |
| Long context research | Gemini 2.5 Pro             | Opus 1M           |
| High-risk decisions   | Opus + human approval      | —                 |
| Vision/UI review      | Gemini / Claude Sonnet     | —                 |

Routing inputs: task type, estimated token budget, latency target, privacy flag (PII → local only), explicit user override.

### Onboarding Wizard
First launch detects available providers and asks the user to enable each:
1. API key entry (Claude, OpenAI, Gemini, Groq) — stored in vault, never in `.env`.
2. Local LLM detection (`ollama list`, `lm-studio`) → user picks which local models are "allowed."
3. Privacy tiers: user flags which domains (health, finance) are **local-only**.
4. Cost ceilings per provider per day.

### Local LLM Sandbox
- Local models run inside a **Lima VM** (macOS) or **Podman machine** — no direct host filesystem access.
- Daemon talks to sandbox via a single UNIX socket exposing `POST /chat`.
- Sandbox has no outbound internet except whitelisted model registry.
- Whisper.cpp / Ollama / llama.cpp installed inside the VM image.

---

## 3. Memory: Graph + Vault (the "Graphify + Karpathy" idea)

Two complementary stores, both behind the Memory Gateway:

### 3a. Graphiti-style Temporal Knowledge Graph
- Nodes: entities (people, projects, tasks, preferences, events).
- Edges: typed relations with **timestamps** (`met_with`, `approved`, `blocked_by`).
- Backed by SQLite + a tiny graph layer (or kuzu/DuckDB-PGQ).
- Queries: "what did I discuss with Alex last week about Project X?" → graph walk → return only the 200 tokens that actually matter instead of 50k of chat history.
- **This is the token-saving win.** Instead of re-sending full conversations, we send compiled facts.

### 3b. Obsidian-style Markdown Vault (Karpathy pattern)
- Plain `.md` files on disk, organized by domain (`brain/people/alex.md`, `work/projects/jarvis.md`).
- Human-editable — user can open it in Obsidian directly.
- JARVIS reads/writes these as "memory files" with frontmatter.
- Vault is the **long-term durable store**; the graph is the **fast index**.

### 3c. Memory Gateway API
Single service, every agent uses it:
```ts
memory.recall({ query, scope, maxTokens })    // hybrid graph+vector+MD
memory.remember({ fact, source, trust })       // validated write
memory.forget({ id })                          // with audit
memory.snapshot()                              // episodic save
```
All reads/writes logged to WORM audit table with reason strings.

---

## 4. Security Model

Non-negotiables:
1. **Vault** — age-encrypted local store (`~/.jarvis/vault.age`), unlocked per-session with OS keychain + optional hardware key (YubiKey).
2. **Secrets never in prompts.** Tools that need a secret get a short-lived token from the vault; the LLM never sees the raw value.
3. **Scoped tool permissions.** Every skill declares required scopes (`gmail.read`, `calendar.write`); user approves at install time.
4. **Approval layer.** Any tool call touching finance/identity/irrevocable state enqueues an approval in the right rail — nothing runs without a human tap.
5. **Policy engine** — OPA/Rego or simple JSON rules — evaluated before every tool call. Blocks based on time, location, amount, domain.
6. **Audit log** — append-only, hash-chained, stored locally + optionally mirrored to S3.
7. **Local LLM sandbox** isolates untrusted model outputs from the host.
8. **PII tagging.** Memory entries tagged `public | personal | sensitive | secret`; `secret` never leaves the machine, `sensitive` never goes to non-local models without explicit consent.
9. **Network egress allowlist** for the daemon — only approved API hosts.
10. **Panic button** — keychain shortcut that locks the vault, kills running agents, clears in-memory state.

---

## 5. Data Model (SQLite, v1)

Core tables (additive — existing `supabase/` schema stays for now):

```
users, profiles
agents, skills, skill_scopes
workflows, workflow_runs, workflow_steps
tasks, approvals, notifications
memory_nodes, memory_edges, memory_files, memory_access_log
vault_items, vault_access_log
model_providers, model_routing_events, cost_events
connector_accounts, connector_auth
daily_briefs, jarvis_outputs
waiting_on, follow_ups, blocked_items, completed_items
audit_log  (append-only, hash chain)
```

---

## 6. Phased Roadmap

| Phase | Goal | Exit criteria |
|-------|------|---------------|
| **P0** Foundations | Daemon skeleton, contracts, vault, audit log | `jarvisd` boots, writes audit, unlocks vault |
| **P1** Shell + Brief | Desktop Tauri shell with Morning Brief + right rail working against stub data | Can open app, see brief, approve an item |
| **P2** Orchestrator + Skills | Skill registry, model router, first 3 skills end-to-end | "Summarize inbox" runs through router → skill → memory |
| **P3** Memory Graph + Vault | Graphiti-style KG + MD vault + gateway | Recall query returns <2k tokens of relevant facts |
| **P4** Connectors | Gmail, GCal, Drive, CRM (Pipedrive) | Morning Brief pulls from real data |
| **P5** Mobile Companion | Expo app showing brief + approvals over Tailscale | Approve from phone |
| **P6** Local LLM Sandbox | Lima VM + ollama bridge | Classification tasks run locally, zero cloud calls |
| **P7** Learning loops | Feedback capture + routing optimization | Router improves with usage |
| **P8** Website builder skill | JARVIS can scaffold + deploy a site | Ship a working site from a single command |

---

## 7. Two-Track Task List (parallel, no file conflicts)

**Rule:** Tracks touch **disjoint directories**. Shared contracts live in `packages/contracts/` and are updated via PR only after both engineers agree. Use this file as the running checklist.

File ownership map:

| Directory | Owner |
|-----------|-------|
| `jarvisd/` (daemon, Rust or TS) | **Track A** |
| `packages/memory/` | **Track A** |
| `packages/vault/` | **Track A** |
| `packages/router/` | **Track A** |
| `packages/skills/` | **Track A** |
| `supabase/`, migrations | **Track A** |
| `apps/desktop/` (Tauri shell) | **Track B** |
| `apps/mobile/` (Expo) | **Track B** |
| `apps/web/` (current `src/`) | **Track B** |
| `packages/ui/` (design system) | **Track B** |
| `packages/contracts/` (types, OpenAPI) | **Shared — edit via PR** |
| `docs/` | **Shared** |

---

### TRACK A — Platform / Core / Security

#### A-P0 Foundations
- [ ] A0.1 Create monorepo layout (`pnpm` workspaces): `apps/*`, `packages/*`, `jarvisd/`
- [ ] A0.2 Move existing `src/` to `apps/web/src/` (coordinate with B before merging)
- [ ] A0.3 Scaffold `jarvisd` (Node + Fastify or Rust + axum). WebSocket + REST on `127.0.0.1:8787`
- [ ] A0.4 `packages/contracts/` — TypeScript types + OpenAPI spec for every daemon endpoint
- [ ] A0.5 SQLite schema v1 migration runner (`better-sqlite3` or `sqlx`)
- [ ] A0.6 Audit log table + append API with hash-chain verification
- [ ] A0.7 `packages/vault/` — age-based encrypted store, OS keychain unlock, `get/set/delete` API
- [ ] A0.8 Panic-lock endpoint `POST /vault/lock` + kill-switch for running jobs

#### A-P2 Orchestrator + Router
- [ ] A2.1 `packages/router/` — `ModelRouter.route(task)` with the table above
- [ ] A2.2 Provider adapters: `claude.ts`, `openai.ts`, `gemini.ts`, `ollama.ts`
- [ ] A2.3 Cost tracker — writes `cost_events` per call with tokens+$
- [ ] A2.4 Budget ceilings from vault config; hard-stop when exceeded
- [ ] A2.5 `packages/skills/` registry + loader; manifest schema (`name`, `scopes`, `router_hints`)
- [ ] A2.6 Orchestrator loop: intent → recall → route → tool → synthesize → log
- [ ] A2.7 First 3 skills: `summarize_inbox`, `draft_reply`, `plan_my_day`
- [ ] A2.8 Policy engine stub (JSON rules) — check before every tool call

#### A-P3 Memory
- [ ] A3.1 `packages/memory/` — gateway API (`recall`, `remember`, `forget`, `snapshot`)
- [ ] A3.2 Graph store (kuzu or SQLite+edges table) with node/edge types
- [ ] A3.3 MD vault reader/writer at `~/.jarvis/vault/` with frontmatter
- [ ] A3.4 Vector index via `sqlite-vec` for semantic fallback
- [ ] A3.5 Hybrid recall: graph walk → vector → MD hydrate, return compiled facts
- [ ] A3.6 Memory access log + trust scoring per source
- [ ] A3.7 Memory retention / TTL policies per class
- [ ] A3.8 Import tool: suck in existing Obsidian vault if user has one

#### A-P4 Connectors
- [ ] A4.1 Connector framework with OAuth token refresh (tokens in vault)
- [ ] A4.2 Gmail connector (read, search, draft)
- [ ] A4.3 Google Calendar connector
- [ ] A4.4 Drive connector (read + search)
- [ ] A4.5 Pipedrive CRM connector
- [ ] A4.6 Browser automation connector (Playwright-in-sandbox)

#### A-P6 Local LLM sandbox
- [ ] A6.1 Lima VM image with Ollama preinstalled
- [ ] A6.2 UNIX-socket bridge between daemon and VM
- [ ] A6.3 Egress allowlist inside VM (only model registry)
- [ ] A6.4 Model download + verification inside VM
- [ ] A6.5 Router auto-prefers local for PII-flagged tasks

#### A — Security hardening
- [ ] A-S1 OS keychain integration (macOS Keychain, Win credential mgr)
- [ ] A-S2 Network egress allowlist for daemon
- [ ] A-S3 OPA/Rego policy engine (upgrade from JSON stub)
- [ ] A-S4 YubiKey optional unlock
- [ ] A-S5 Penetration test checklist (token leakage, prompt injection, path traversal)

---

### TRACK B — Clients / UI / UX

#### B-P0 Design system
- [ ] B0.1 `packages/ui/` — Tailwind config w/ semantic tokens: `jarvis-cyan`, `jarvis-navy`, `approval-amber`, `blocked-red`, etc.
- [ ] B0.2 Base primitives: `GlassPanel`, `StatusPill`, `SectionHeader`, `ApprovalCard`, `BriefItem`
- [ ] B0.3 Typography + icon set (Lucide + custom JARVIS sigil)
- [ ] B0.4 Motion system (framer-motion): panel entry, pulse for active, shimmer for loading
- [ ] B0.5 Theme provider + dark-only lock for v1
- [ ] B0.6 Storybook for every primitive

#### B-P1 Desktop Shell (Tauri)
- [ ] B1.1 Scaffold `apps/desktop` (Tauri + React)
- [ ] B1.2 App shell: left sidebar (Home/Today/Work/Money/Home Life/Health/Brain/Settings)
- [ ] B1.3 Top status strip (Work Mode · Open Time · Budget Watch · Trust)
- [ ] B1.4 Segmented control: Morning Brief / Jarvis Output
- [ ] B1.5 Morning Brief layout: Today Briefing · Critical · Next Best Move · Waiting On · Follow-Ups · Schedule · Budget · Focus
- [ ] B1.6 Right rail: Pending Approvals · Reminders · Blocked · Recently Completed
- [ ] B1.7 Bottom sticky composer with "What do you need done?"
- [ ] B1.8 Conversation thread panel (lower half) with right-aligned user bubbles
- [ ] B1.9 Daemon client (`@jarvis/client`) wrapping REST + WebSocket
- [ ] B1.10 System tray icon + global hotkey (⌘⇧J)
- [ ] B1.11 Native notifications for approvals
- [ ] B1.12 Offline/degraded state when daemon is down

#### B-P1 Onboarding
- [ ] B1.13 First-run wizard: unlock vault → add API keys → detect local models → pick privacy tiers → set budgets
- [ ] B1.14 "Install a skill" UX with scope approval dialog
- [ ] B1.15 Connector linking flow (OAuth popup → success card)

#### B-P2 Surfaces (one per sidebar item)
- [ ] B2.1 Home (flagship — already above)
- [ ] B2.2 Today (schedule + conflicts + time windows)
- [ ] B2.3 Work (CRM widgets, docs, outreach, approvals)
- [ ] B2.4 Money (budget watch, bills, subscriptions, alerts)
- [ ] B2.5 Home Life (errands, vendors, deliveries)
- [ ] B2.6 Health (workouts, meals, recovery, meds)
- [ ] B2.7 Brain (memory graph explorer + notes)
- [ ] B2.8 Settings (providers, budgets, privacy, vault, audit viewer)

#### B-P5 Mobile Companion (Expo)
- [ ] B5.1 `apps/mobile` Expo RN scaffold, shares `packages/ui`
- [ ] B5.2 Daemon discovery via Tailscale / LAN mDNS
- [ ] B5.3 Morning Brief screen (read-only v1)
- [ ] B5.4 Approvals tab with haptics
- [ ] B5.5 Voice capture → send to daemon `/ask`
- [ ] B5.6 Push notifications (APNs → daemon proxy)
- [ ] B5.7 Biometric unlock before showing sensitive panels

#### B — Trust & observability UX
- [ ] B-T1 Trust panel: what JARVIS touched today, sources used, actions taken, why
- [ ] B-T2 Cost dashboard (per workflow/model/day)
- [ ] B-T3 Audit log viewer with hash-chain verification badge
- [ ] B-T4 Memory explorer: graph view + MD file preview
- [ ] B-T5 "Explain this recommendation" drawer on any JARVIS output

---

## 8. Contracts: the one thing both tracks share

Everything goes through `packages/contracts/`. Both engineers agree on the types **before** either writes implementation. Example surface:

```ts
// packages/contracts/src/daemon.ts
export interface JarvisDaemon {
  ask(req: AskRequest): Promise<AskResponse>;
  brief(): Promise<MorningBrief>;
  approvals(): Promise<Approval[]>;
  approve(id: string, decision: "approve"|"deny", reason?: string): Promise<void>;
  memory: { recall(q: RecallQuery): Promise<RecallResult>; };
  events: WebSocketEvents; // push: approval.new, brief.updated, cost.alert, ...
}
```

Merge rule: contract changes land on a branch, get reviewed by **both** engineers, then each track rebases on it before continuing.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Scope creep across 8 surfaces | Ship Home + Brain only for v1; others are stubs |
| Memory graph over-engineering | Start with SQLite edges table, not a real graph DB |
| Local LLM VM complexity | Ship v1 without sandbox (cloud only), add in P6 |
| Merge conflicts | Directory ownership rule above, contracts-first |
| Prompt injection from email/docs | Every external text run through a sanitizer + trust score before it touches memory |
| Tauri learning curve | Fall back to Electron if blocked >2 days |
| Vault key loss | Recovery phrase printed at onboarding; user signs off |

---

## 10. Immediate Next 5 Steps

1. **Both:** agree on monorepo layout + rename existing `src/` → `apps/web/src/` in one PR.
2. **A:** scaffold `jarvisd` + audit log + vault (P0 items).
3. **B:** scaffold `packages/ui` + `apps/desktop` Tauri shell with static Morning Brief.
4. **Both:** land `packages/contracts/` v0 with `brief`, `ask`, `approve`, `recall`.
5. **A+B:** wire Tauri shell to real daemon, replace stub brief with live endpoint.

---

*Living doc. Check items off as they land. Update the risk table as you learn.*

---

# Part 2 — Post-v0 Roadmap (what we actually shipped + what's next)

## v0 Skeleton — DONE ✅

The following are live and tested end-to-end in the repo:

- [x] **S1** — `jarvisd/` Fastify daemon, SQLite, hash-chained audit log (`/health`, `/brief`, `/rail`, `/audit/verify`)
- [x] **S2** — new web shell (`src/`) with Sidebar, StatusStrip, MorningBrief, RightRail, ConversationThread, Composer, JarvisHalo; wired to daemon
- [x] **S3** — Vault: AES-256-GCM, master key in macOS Keychain (`/vault/*`)
- [x] **S4** — Model router + Anthropic adapter + cost tracking + budget ceilings (`/ask`, `/cost/today`)
- [x] **S5** — Memory gateway: graph (nodes+edges) + Obsidian-style MD vault + hybrid recall with token budget (`/memory/*`)
- [x] **S6** — Morning Brief generator skill (pulls from memory, drafts narrative via router, persists to `daily_briefs`)
- [x] **S7** — Gmail connector framework (OAuth flow + adapter + inbox_summary skill, ready for creds)
- [x] **S8** — Approvals loop with handler registry, UI Approve/Deny wired to daemon
- [x] **S9** — Ollama local LLM adapter, privacy-gated routing (`privacy: secret` → local)
- [x] **S10** — Electron desktop shell (`desktop/`) with tray + `⌘⇧J` global hotkey

**What works right now:** the full stack boots from one `npm start`, the UI shows real data from the daemon, memory recall returns compiled facts, local LLM answers prompts, approvals flow through to handlers, audit chain verifies after every change.

**What doesn't work yet without configuration:**
- Claude narrative (needs real `anthropic_api_key` in vault)
- Gmail summary (needs Google OAuth client ID/secret)
- Every sidebar item except Home

---

## M1 — Daily Driver ✅ DONE

*Goal: I open JARVIS every morning for a week and it's actually useful without any curl.*

- [x] Onboarding wizard UI (5 steps: Vault, Providers, Local, Privacy, Budget, Done)
- [x] Settings surface (Providers, Connectors, Budget, Privacy, Vault, About)
- [x] All 4 cloud providers with real test functions (Anthropic, OpenAI, Google, Groq)
- [x] Google provider OAuth flow (alternative to API key)
- [x] Ollama local model detection + privacy-gated routing
- [x] Gmail / GCal / Drive OAuth connector framework + unified one-sign-in card
- [x] **Apple Mail + Apple Calendar native integration** (zero-setup path via macOS Automation)
- [x] Brief generator pulls Apple Calendar events into schedule + unread mail into waitingOn
- [x] `/brief` regeneration button in header with spinner
- [x] Header `/cost/today` pill with color state (green/amber/red by spend fraction)
- [x] Vault-locked overlay with one-click unlock (handles daemon reload)
- [x] Auto-unlock-on-423 in the client (transparent retry)
- [x] "Get a key" deep links in every provider card (Anthropic, OpenAI, Google, Groq)
- [x] Settings tab split: Providers (AI models) vs Connectors (data), with blue info banners

Deferred (minor polish, unblocked):
- Drive "attached docs" rendering in Jarvis Output view (adapter+routes ready; no consumer yet)
- Cross-device Gmail OAuth validated with real Google Cloud creds (code complete; Apple path used instead)

## M2 — The Other Surfaces (2 weeks)

*Goal: the sidebar actually goes places. Each surface reads its own slice of data.*

**Batch 1 — DONE ✅**
- [x] **Today** — merged Apple Calendar events + focus blocks with conflict detection
  - [x] `focus_blocks` SQLite table + `/focus-blocks` CRUD routes
  - [x] `/today` endpoint merges events + blocks, computes conflicts (strict overlap)
  - [x] UI: time-range cards, conflict visualization (red border), inline "+ Focus block" form
- [x] **Brain** — memory graph explorer
  - [x] List nodes grouped by kind (person/project/task/fact/event/pref)
  - [x] Search box hitting `/memory/recall` (debounced)
  - [x] Detail drawer with body, trust, timestamps, related edges
  - [x] "+ Remember" modal (kind/label/body/file/trust)
  - [x] Forget button per node
- [x] **Work / Money / Home Life / Health** — stub ComingSoon cards so sidebar isn't dead clicks
- [x] Integration bugs fixed inline (local/UTC day mismatch, /today timeout bound)
- [x] 43/43 integration tests pass

**Batch 2 — TODO**
- [ ] **Today** polish: drag-to-reschedule, recurring focus blocks, travel-time heuristic
- [ ] **Brain** upgrade: graph view (force-directed), MD vault file editor, Obsidian import
- [ ] **Work** — Pipedrive connector + outreach composer + Drive docs panel
- [ ] **Money** — monthly budget categories + subscription scanner skill + spending alerts
- [ ] **Home Life** — vendor directory + errand tracker
- [ ] **Health** — workout logger + meal journal + recovery tracking
- **Exit criteria (batch 1 — met):** every sidebar item renders and reads real data; no dead clicks.

## M3 — Memory Upgrade (1 week)

*Goal: recall returns semantically relevant facts, not just LIKE matches.*

**Batch 1 — DONE ✅**
- [x] Install `sqlite-vec` for vector search (loaded via `db.ts` at startup; graceful fallback if missing)
- [x] Embed-on-write: `memory.remember` fires a fire-and-forget embed via Ollama (`nomic-embed-text`, 768-dim)
- [x] FTS5 virtual table `memory_fts5` synced on write/forget/rebuild
- [x] Hybrid recall: vector (`1/(1+distance)`) + FTS5 (`1/(1+bm25)`) + graph boost (exact label +0.2, 1-hop neighbours +0.1)
- [x] `via` source tag per hit: `vector | fts | graph | hybrid`
- [x] `GET /memory/embed/status` + `?enhanced=true` flag on `/memory/recall`
- [x] Obsidian vault importer (`POST /memory/import/obsidian`) with dry-run + frontmatter parser + (label,kind) dedupe
- [x] UI: Brain header shows semantic status chip, search rows show score pill + via chip, "Import Obsidian" button + dialog
- [x] Graceful fallback when Ollama/sqlite-vec unavailable — writes still succeed, recall falls back to FTS5
- [x] **Verified live**: `"ops leadership"` → `"Alex Rivera VP of Ops"` via vector path (keyword overlap zero)
- [x] 53/53 integration tests pass

**Batch 2 — DONE ✅**
- [x] Episodic memory: `episodic_snapshots` table, `episodic.snapshot/list/get`, hooks on brief generation + approvals + skill runs
- [x] Trust decay: lazy `decayTrust()` at `toNode()` read time (5%/30d, floor 0.05)
- [x] Per-class TTL: events expire at 90d, filtered on `memory.list()` read (lazy cleanup)
- [x] `POST /memory/rebuild-indexes` HTTP route
- [x] `GET /episodic` + `GET /episodic/:id` routes

Still TODO (deferred polish):
- [ ] Memory explorer timeline view in Brain UI
- [ ] Rehydrate flow for pre-M3 nodes (use the rebuild route)

## M4 — Skill Registry + Workflow Engine (2 weeks)

*Goal: skills install like apps with explicit scopes, workflows run on triggers.*

**Batch 1 — DONE ✅**
- [x] `SkillManifest` type in contract (name, scopes, routerHint, triggers, inputs)
- [x] In-code `registry.register/list/get` (dynamic disk loader → batch 2)
- [x] `SkillContext` with shared `callModel` helper (router + provider + cost, graceful local fallback)
- [x] Workflow engine: `runSkill`, `listRuns`, `getRun`, in-memory cron scheduler (subset `M H * * *` + `M * * * *`)
- [x] `skill_runs` SQLite table + episodic snapshot per run
- [x] Starter skill pack (3):
  - [x] `daily_recap` — 8pm cron, summarizes today's episodic snapshots
  - [x] `plan_my_day` — 7am cron, memory tasks + Apple Calendar → time-boxed plan
  - [x] `budget_watch` — 9am cron, local-LLM-only, scans cost_events, alerts ≥80%
- [x] 7 HTTP routes (`/skills`, `/skills/:name`, `/skills/:name/run`, `/skills/:name/runs`, `/runs`, `/runs/:id`, `/workflows`)
- [x] UI: Skills surface in sidebar (Wand2 icon), manifest detail drawer, Run-now button, Recent runs list, Workflows section
- [x] RightRail "Recently run" widget on Home
- [x] 66/66 integration tests pass

**Batch 2 — DONE ✅**
- [x] Event triggers (approval.decided, memory.remembered, brief.generated, skill.completed)
- [x] More skills: meeting_prep, contact_enrich, doc_summarize, weekly_review, draft_reply, follow_up_suggest, research_brief (12 total)
- [ ] Dynamic skill loader from disk (deferred — in-code registration works for now)
- [ ] Scope approval dialog on first use (ties into M5 security)
- [ ] Streaming run output in UI (deferred — WebSocket infra landed, streaming per-skill is incremental)
- [ ] Cancel in-flight run (deferred)

**Batch 3 — Live Wire + Learning Loops — DONE ✅**
- [x] WebSocket push (`/ws`): daemon → client real-time events (skill.started/completed, brief.generated, cost.alert, approval.new/decided, memory.remembered)
- [x] React `useJarvisSocket` hook with auto-reconnect + exponential backoff
- [x] Replaced polling with WebSocket-driven refreshes in useJarvisBrief
- [x] Live status indicator in StatusStrip (Wifi icon)
- [x] Feedback system: `feedback` table + `POST /feedback` + `GET /feedback` + `GET /feedback/stats/:skill`
- [x] Router learning: `routing_history` table, `recordRouting()` on every callModel, `consecutiveSuccesses()`, auto-downgrade after 5 successes, auto-upgrade on negative feedback
- [x] `POST /routing/explain` + `GET /routing/stats` endpoints
- [x] UI: FeedbackButtons (thumbs up/down + reason) + WhyThisDrawer (model/provider/reason/learned) wired into SkillRunResult
- [x] 9/9 new integration tests pass

## M5 — Security Hardening (1 week)

*Goal: safe enough to store real finance/health data.*

- [ ] OPA/Rego policy engine replaces JSON stub
- [ ] Policy rules enforced before every tool call (time, amount, domain, risk)
- [ ] Egress allowlist for daemon (only approved API hosts)
- [ ] PII tagging enforcement in memory + router
  - [ ] `memory.remember` refuses to write `secret`-tagged facts through non-local providers
  - [ ] Router blocks cloud calls when prompt contains `secret`-tagged recalled context
- [ ] YubiKey optional unlock (webauthn)
- [ ] Panic button hotkey: lock vault + kill jobs + clear in-memory state
- [ ] Recovery phrase printed at onboarding; signed-off checkbox
- [ ] Audit log viewer UI with hash-chain verification badge
- [ ] Pentest checklist: path traversal, prompt injection, token leakage, sandbox escape
- **Exit criteria:** pass a self-run pentest checklist; real bank/health data can live here.

## M6 — Learning Loops (1 week) — CORE DONE ✅

*Goal: JARVIS gets better the more I use it.*

- [x] Feedback capture
  - [x] Thumbs up/down/neutral with optional reason per skill run
  - [x] POST /feedback + GET /feedback + GET /feedback/stats/:skill
  - [ ] Edits to JARVIS outputs (diff captured as feedback)
  - [ ] Snooze patterns (did I act on the reminder or skip it)
- [x] Router learning
  - [x] Per-task-kind correction history (routing_history table)
  - [x] Auto-downgrade model if cheap one succeeded N times in a row (threshold=5)
  - [x] Auto-upgrade when user retries with "do it properly" (negative feedback → stronger model)
  - [x] POST /routing/explain returns full explanation
- [ ] Recommendation timing adapts to when user actually acts
- [x] "Why this?" drawer on skill run results (model, provider, reason, learned adjustments)
- [ ] Trust panel: what JARVIS touched today + sources + actions taken + cost
- **Exit criteria (core met):** feedback is captured, router learns from outcomes, model choices are explainable.

## M7 — Mobile Companion (1–2 weeks)

*Goal: approve things from my phone on the go.*

- [ ] `apps/mobile/` Expo RN scaffold sharing the UI primitives
- [ ] Daemon discovery over Tailscale or LAN mDNS
- [ ] Morning Brief screen (read-only v1)
- [ ] Approvals tab with haptic feedback
- [ ] Voice capture → `/ask` endpoint
- [ ] Push notifications (APNs → daemon proxy with FCM option)
- [ ] Biometric unlock (Face ID) before showing sensitive panels
- [ ] Dark-only theme matching desktop
- **Exit criteria:** approve a real action from my phone while away from my laptop.

## M8 — Production Polish (1 week)

*Goal: installable, signed, auto-updating, small binary.*

- [ ] Install Rust toolchain + scaffold Tauri
- [ ] Port `desktop/main.cjs` to Rust `src-tauri/`
- [ ] Bundle jarvisd as a sidecar binary (single daemon executable)
- [ ] Auto-update channel (Tauri updater)
- [ ] Crash reporting (local-only, never ships without consent)
- [ ] Code-sign + notarize `.dmg` (Apple Developer ID)
- [ ] Windows build (MSIX), Linux AppImage
- [ ] App icon, branding, About pane
- [ ] Vault key rescue flow (recovery phrase → re-derive master key)
- **Exit criteria:** fresh Mac → download `.dmg` → drag to Applications → open → works without a terminal.

---

## Milestone size reality check (solo pace)

| Milestone | Focused solo | Part-time |
|-----------|-------------|-----------|
| M1 Daily Driver | 1–2 weeks | 3–4 weeks |
| M2 Surfaces | 2 weeks | 4–6 weeks |
| M3 Memory | 1 week | 2 weeks |
| M4 Skills + Workflows | 2 weeks | 4 weeks |
| M5 Security | 1 week | 2 weeks |
| M6 Learning | 1 week | 2 weeks |
| M7 Mobile | 1–2 weeks | 3–4 weeks |
| M8 Polish | 1 week | 2 weeks |
| **Total** | **10–12 weeks** | **22–28 weeks** |

**Recommended fast path:** M1 → M2 → M4 subset (3–5 built-in skills) → M5 → then optional. ~4–6 weeks to a product you can trust with real data.

## What to build next right now

If you want the biggest single improvement from current state: **M1 step 1 — the onboarding wizard + Settings surface.** Everything else gets easier once you can configure JARVIS without curl commands.

*Check items off above as you land them. Update this file, not a separate TODO list.*

---

## Phase 2 — SHIPPED (2026-04-23)

Conversation history, prompt caching, Bug #2 fix — three pillars, five days, one commit per day. Real-API verification at the end of every day.

**What shipped in Phase 2:**
- **Conversation history**: `conversations` + `messages` tables, 90-day retention cron, idle-break (2h), 40-turn / 12k-token load window with user-first-head guard and oldest-first truncation.
- **Agentic loop integration**: `conversationId` threaded through `runAgenticTurn`; user message persisted before the loop, assistant content + tool_result user turn persisted per iteration — the tool_use ↔ tool_result chain round-trips across turns without dangling blocks.
- **Prompt caching**: explicit `cache_control` on the system block (NOT top-level auto-placement, which caches the wrong thing); tools + skill menu sorted alphabetically for cache-prefix stability; cache-aware cost math.
- **Bug #2 fix**: `liveContext` injection dropped from `/ask/stream`. The model now calls `search_deals` for ground truth instead of confabulating counts from a stuffed system prompt.
- **Session model**: `X-Session-Id` header, client-generated UUID in localStorage, auto-minted + echoed by the daemon on first request.
- **Route surface**: `GET /conversations`, `GET /conversations/:id/messages`, `POST /conversations/:id/clear`, `DELETE /conversations/:id`.
- **Frontend**: `jarvis.askStream` injects `X-Session-Id`; `JarvisChat` hydrates from server on mount (`GET /conversations/:id/messages`); "New Thread" button rotates the UUID; tool chips reload with `state=done` when hydrating a past conversation.
- **Retention**: nightly cron (7 AM, hourly checks) prunes messages older than 90 days. Conversation rows survive the prune so empty sessions are still resumable.
- **Bug fixes during verification**: (a) duplicate abort listeners — `req.raw.on("close")` fires on POST-body-received and was aborting every request; fixed by binding to `reply.raw` only. (b) cost calculation ignored cache tokens; new `estimateCostWithCacheUsd()` with read=0.1× and write=1.25× multipliers. (c) top-level `cache_control` placed the marker on the last message (per-turn variable) — moved to explicit placement on the system block.

**Measured results:**
- 31 unit tests (`npm run test:phase2`) covering persistence, truncation (both turn + token caps), tool_use chain round-trip, idle break, cache placement, determinism, mid-stream abort, retention prune.
- Real-API 4-turn session verified: Turn 1 writes 5000-token cache; Turns 2+ read cache → **cost drops 87%** on the repeat calls (~$0.003 vs $0.017 uncached).
- Bug #2 live check: "how many open deals?" now invokes `search_deals` and cites real numbers instead of the prior 597-deal hallucination.
- Real-UX 6-step scenario (3-turn convo → simulated browser reopen → Turn 4 references Turn 2) — Claude correctly recalled "durian" across the reopen.

**Phase 2 cost accounting:** Day-level totals — Day 1 $0.00, Day 2 $0.033, Day 3 $0.017, Day 4 $0.038, Day 5 $0.028 → **~$0.12 total** against a $0.50 projected budget.

**Explicit non-goals held:**
- Multi-thread UI (still one thread per session; New Thread rotates UUID)
- Conversation → memory-node summarization (Phase 3 candidate)
- Cross-session search / search within a thread
- Mobile client
- Computer Use
- Cross-tab real-time WS sync (deferred — observed in Day 5 scenario #4 that 2 tabs with same SID cross-pollinate priorMessages; acceptable for solo use)
- Full message-level caching (second breakpoint); only stable prefix caches in v1

**Observed behaviors worth noting for Phase 3:**
- **Cross-tab cross-pollination** (Day 5 scenario #4): two browser tabs with the same session id, fired concurrently, will interleave in each other's `priorMessages` because the server persists on `/ask/stream` entry. In a 2-tab test, Tab A saw Tab B's user message when assembling its context and answered both. Not corruption — just the natural consequence of a single session being written from two tabs. WS-driven cross-tab sync or per-tab session IDs would eliminate it.
- **Cache minimum**: current prefix is ~5000 tokens, above the 4096-token Opus/Haiku minimum. If Phase 3 trims the tool set (e.g. ship with fewer than 9 tools), watch that prefix stays > 4096 or caching silently goes dormant.
- **liveContext still lives on legacy `/ask`**: the non-agentic path uses Claude CLI (subscription) and has no tools, so context injection is still useful there. Only `/ask/stream` dropped it.

---

## Phase 1 — SHIPPED (2026-04-23)

Agentic tool-use loop shipped. End-to-end verification passed with two bugs fixed during verification (#3 schema repair, #4 abort-on-disconnect). One design-level finding deferred to Phase 2 (#2 hallucination when `liveContext` injection masks tool-need).

**What shipped in Phase 1:**
- Tool registry with 9 Zod-validated tools (search_memory, remember, search_emails, search_deals, get_calendar, draft_email, create_proposal, run_skill, web_search)
- Manual agentic loop in `lib/agentic.ts` (stream + tool_use + tool_result, max 10 iters, adaptive thinking, abort via signal)
- SSE `POST /ask/stream` endpoint + frontend streaming consumer
- Approval gate v1 (tool → enqueue → banner + WS-driven system message on decide)
- Opus 4.6 → 4.7 bump + pricing fix (stale $15/$75 → correct $5/$25)
- Per-tool cost attribution: `tool_calls` table + `GET /cost/tools` + `GET /cost/agentic`
- 9 agentic unit tests covering loop termination, tool dispatch, max-iter cap, pause_turn, approval gate, thinking config, abort, and per-tool stats
- Migration 017 repairing `memory_nodes.sensitivity` column drift
- Runner tolerates `duplicate column name` errors so repair migrations are idempotent

**What's explicitly NOT in Phase 1 (scope held):**
- Conversation history persistence (stateless `/ask/stream`)
- Inline approval resume (Phase 1b, est. +1d)
- Claude CLI / Ollama tool-use parity (still on legacy regex parser for those paths)
- Computer Use, MCP, mobile companion, launchd auto-start

**Phase 1 cost accounting:** Task #8 end-to-end verification consumed $0.44 of a $2 budget across 8 scenarios (scenario 9 deferred — no Phase 1-ready packaged build).

---

## Phase 1 Backlog (infrastructure gaps — opened 2026-04-22)

Running list of debt items caught during Phase 1 system audit + agentic loop work. Don't let this grow — address before moving past Phase 2.

### Pre-existing test failures (21, surfaced 2026-04-22)

All present on HEAD `ceabe0e` before any Phase 1 work. Baseline fresh checkout = 42 failures; after Phase 1 additions = 21 (delta is state-sensitivity, not regressions). None of the 21 failures touch Phase 1 code paths.

Failing test names (from `npm test` in `jarvisd/`):

- `POST /connectors/gcal/creds stores creds and authUrl has calendar.readonly scope`
- `after running skills, /cost/events is non-empty and /cost/summary.today.spentUsd is a number`
- `Feedback + Learning Loops`
- `Gate Protocol: Rate Limiting`
- `GET /providers lists 5 providers with linked=false on fresh state`
- `Red Team: Policy Bypass`
- `GET /skills on fresh daemon returns array with at least 3 starter skills`
- `GET /skills/daily_recap returns a valid SkillManifest`
- `POST /skills/daily_recap/run returns a SkillRun with terminal status`
- `GET /runs?limit=5 includes the just-run skill`
- `GET /skills/daily_recap/runs is scoped to daily_recap and includes the run`
- `GET /runs/:id returns the run with the matching id`
- `GET /workflows returns an array with at least 3 cron trigger entries`
- `Episodic snapshot: after a skill run, /episodic?kind=skill_run includes a new entry`
- `GET /skills returns at least 7 skills including the 4 batch-2 skills`
- `GET /skills/meeting_prep returns a valid manifest with a 'topic' input`
- `POST /skills/doc_summarize/run with short text returns a SkillRun`
- `POST /skills/meeting_prep/run with topic returns a SkillRun`
- `POST /skills/weekly_review/run returns skipped=true or a completed run (day-dependent)`
- `Trust Protocol: Audit integrity after security operations` (concurrent-run flake)

**Owner:** TBD. **Target:** resolve before Phase 2 kicks off.

### Phase 1 verification gaps (surfaced during Task #8, 2026-04-23)

- **Packaged desktop build is stale.** `src-tauri/target/release/bundle/macos/JARVIS OS.app` dates from 2026-04-12, predating all of Phase 1 (agentic loop, SSE route, tool registry, approval gate v1, Opus 4.7 bump). `desktop/` has no electron-builder / forge config — packaging target TBD. Task #8 scenario 9 skipped per plan. **Phase 2:** pick a packaging stack (Electron-Forge or finish Tauri), rebuild, re-verify end-to-end on the packaged binary.

- **Bug #2 (deferred to Phase 2): hallucination when `liveContext` competes with tools.** Surfaced in Task #8 scenario 2 — asked "how many open deals?" and Claude confidently returned "597" (truth: 108) without calling `search_deals`. Root cause: `/ask/stream` injects `gatherContext(prompt)` into the system prompt, which gives Claude partial data. Rather than call the tool for ground truth, Claude confabulates around the partial context. **Remediation candidates (pick one in Phase 2):**
  1. Drop `liveContext` injection from `/ask/stream` entirely — tools become the sole data path
  2. Keep `liveContext` but strip numeric claims from it; require Claude to tool for specific counts/values
  3. Strengthen system prompt: "For any specific count, value, or factual claim about the user's data, you MUST call a tool. Do NOT answer numeric questions from context alone."
  Recommended: option 3 first (lowest risk), measure with `/cost/tools` leaderboard whether tool-call rate rises; fall back to option 1 if Claude still hallucinates.

- **`/providers/anthropic/test` endpoint uses retired model** `claude-3-5-haiku-latest`. Fixed inline during Task #8 (→ `claude-haiku-4-5`). Worth a broader grep for any other retired-model strings.

- **Anthropic API provider path was previously untested.** Pre-Phase 1, all `/ask` traffic went through `claude-cli` (subscription). Phase 1 is the first code path that directly hits the Anthropic API. This is how a placeholder key (`sk-ant-fake-...test`) went undetected for weeks. **Phase 2:** `/providers/:id/test` should run at daemon start and surface broken keys in the UI status strip.

### Phase 1 deferrals (address later in Phase 1 or in follow-up)

- **`@anthropic-ai/sdk` 0.88 → latest**: needed to upgrade `web_search_20250305` → `web_search_20260209` + `web_fetch_20260209` (dynamic filtering). TODO lives in `jarvisd/src/lib/tools/index.ts`.
- **Conversation history persistence** — each `/ask` is still stateless. Phase 2 blocker.
- **Inline approval resume** — Phase 1 v1 gates draft_email / create_proposal but the "user approves → same turn resumes" UX is Phase 1b (est. +1d).
- **Claude CLI + Ollama tool-use parity** — Phase 1 agentic loop is Anthropic API only. CLI + local fallback still use the legacy `[action]` regex parser.
- **Finer per-tool cost attribution** — Task #7 will split model call cost from tool-invoked sub-call cost more granularly. v1 attribution ("skill=agentic" vs "skill=agent:<tool>") in place.
- **Pre-existing `src/routes/voice.ts:22` TS2578** — unrelated unused `@ts-expect-error` directive from commit `c83eace`. Noise in every typecheck.

