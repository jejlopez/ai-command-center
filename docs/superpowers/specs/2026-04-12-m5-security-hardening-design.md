# M5 Security Hardening — Stark Protocol Design

> Committed: `b2b819b` on `codex/jarvis-phase-3`
> Date: 2026-04-12
> 51 integration tests, 0 failures

## Goal

Make JARVIS OS safe enough to store real finance/health data. Close every data leakage path, enforce access control, and prove it with adversarial tests.

## Approach: Stark Protocol (Hybrid)

Policy engine as the foundation, then four protocols closing threat corridors sequentially:

1. **Policy Engine** (foundation all checks call through)
2. **Shield Protocol** (data leakage closed)
3. **Gate Protocol** (access control + emergency lockdown)
4. **Trust Protocol** (audit visibility + chain verification)
5. **Red Team** (adversarial proof all four hold)

## Architecture

```
Request → Rate Limiter → CORS → Route Handler
                                      ↓
                              Prompt Sanitizer (injection filter)
                                      ↓
                              PII/Secret Tagger (regex heuristics)
                                      ↓
                              Policy Engine (deny-wins evaluation)
                                      ↓
                          ┌─── deny ──→ Force local Ollama
                          │
                          └─── allow ──→ Model Router → Provider
                                              ↓
                                        Egress Firewall (secureFetch)
                                              ↓
                                        Audit Log (hash-chained)
```

## Section 1: Policy Engine

**File:** `jarvisd/src/lib/policy.ts`

- Pluggable interface: ships with in-memory TypeScript evaluator, OPA/Rego can replace later
- Default rules stored in-memory, custom rules via `POST /policy/rules`
- Deny-wins semantics: if any matching rule is deny, the decision is deny
- Default rule pack:
  - `secret-local-only` — secret-tagged data never leaves the machine
  - `sensitive-no-openai` — sensitive data avoids OpenAI

**Routes:** `GET /policy/rules`, `POST /policy/rules`, `DELETE /policy/rules/:id`

## Section 2: Shield Protocol

**Files:** `tagger.ts`, `egress.ts`, wiring in `skills.ts` + `ask.ts` + `memory.ts`

### Tagger (`tagger.ts`)
Scans text with regex heuristics, returns sensitivity level:
- **secret**: SSN, credit card, password fields, API keys
- **personal**: email addresses, phone numbers
- **public**: everything else

Caller can provide a manual override floor. Higher sensitivity always wins.

### Router enforcement
Every `callModel()` and `/ask` request:
1. Tags the prompt via tagger
2. Escalates privacy level if PII/secrets detected
3. Checks policy engine before routing
4. Forces local Ollama on deny

### Egress firewall (`egress.ts`)
`secureFetch()` — drop-in `fetch` replacement that checks policy engine before any outbound HTTP. Throws `EgressDeniedError` on deny.

### Memory PII tagging
`memory.remember()` auto-tags nodes with sensitivity level at write time. Stored in `sensitivity` column (migration 008).

## Section 3: Gate Protocol

### Rate limiter (`rate_limit.ts`)
Sliding-window counter per client IP as Fastify `onRequest` hook:
- Standard routes: 120 requests/min
- Vault routes: 20 requests/min (brute-force protection)
- Returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers
- 429 response on exceed, audit-logged

### Panic button (`panic.ts`)
`POST /panic` — emergency lockdown:
1. Locks vault (wipes in-memory master key + decrypted data)
2. Emits `panic` event on bus + WebSocket broadcast
3. Audit-logged as critical event

### Pluggable vault auth (`vault.ts`)
`VaultAuthProvider` interface with `getMasterKey()`. Ships with `KeychainAuthProvider` (macOS Keychain). `setAuthProvider()` swaps in YubiKey/biometric later without changing callers.

## Section 4: Trust Protocol

### Audit log API (`routes/audit.ts`)
- `GET /audit/log` — paginated, filterable by action/actor/since
- `GET /audit/summary` — 24h breakdown by action type
- `GET /audit/chain` — hash-chain verification

### Audit viewer UI (`AuditPanel.jsx`)
Settings tab with:
- Hash-chain verification badge (green check / red alert)
- 24h event summary strip
- Filterable paginated log with expandable rows
- Each row shows: time, actor, action, subject, metadata, hash

### Panic integration
VaultPanel's panic button wired to real `POST /panic` endpoint.

## Section 5: Red Team

**File:** `sanitize.ts` + `redteam.test.mjs`

### Prompt injection defense (`sanitizeForContext`)
Filters before LLM consumption:
- "Ignore previous instructions" variants
- Role injection markers (`system:`, `assistant:`)
- XML instruction tags (`<system>`, `<instruction>`)
- Jailbreak attempts (DAN, "do anything now")
- Filtered text replaced with `[FILTERED]`, audit-logged

### Path traversal defense (`assertPathWithin`)
Guards `writeVaultFile` and `deleteVaultFile`:
- Resolves path, verifies it stays within boundary
- Blocks `../` traversal and absolute paths
- Throws `PathTraversalError` on violation

### Token leakage defense (`containsSecret`, `redactSecrets`)
- Detects API keys, bearer tokens, PEM blocks, GitHub PATs
- `redactSecrets()` replaces with `[REDACTED]` for safe logging

## Test Matrix

| Suite | Tests | Coverage |
|-------|-------|----------|
| `policy.test.mjs` | 5 | Rule CRUD, default rules, disabled rules |
| `shield.test.mjs` | 11 | Tagger escalation, policy routing, memory PII tagging |
| `gate.test.mjs` | 11 | Rate limiting, panic lifecycle, CORS, vault auth cycle |
| `trust.test.mjs` | 8 | Audit pagination/filter, chain verify, panic+verify, rapid ops |
| `redteam.test.mjs` | 16 | Prompt injection (5), token leakage (3), path traversal (4), policy bypass (4) |
| **Total** | **51** | |

## Decisions & Trade-offs

- **Custom policy engine over OPA/Rego**: OPA is overkill for a single-user local daemon. Interface is OPA-ready for future swap.
- **Regex tagger over ML classifier**: Fast, deterministic, no model dependency. Conservative (false positives route to local, which is safe).
- **Keychain-only auth**: User doesn't own a YubiKey. Interface is pluggable for when they do.
- **Rate limiter on localhost**: Defence in depth. Protects if daemon is exposed over Tailscale.
- **No recovery phrase yet**: Deferred — requires onboarding UI changes. Vault auth interface supports it.

## Remaining M5 items (deferred)

- [ ] Recovery phrase printed at onboarding (needs onboarding wizard update)
- [ ] Time-gate policy rule enforcement (rule exists but disabled; needs hour-of-day attribute in policy context)
- [ ] Egress firewall wired into all skill HTTP calls (secureFetch exists; skills need migration from raw fetch)
- [ ] OPA/Rego upgrade when complexity warrants it
