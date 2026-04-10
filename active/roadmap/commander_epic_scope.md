# Epic Commander Scope

## Product Thesis

Build a founder-first Jarvis operating system where one Commander understands a task in plain language, chooses the best lane, delegates subtasks to specialists, uses the right models and tools with strict cost discipline, and gives the operator a cinematic but readable control surface.

The system should feel:

- Stark-like at the interface
- Musk-like in throughput and bottleneck removal
- disciplined in risk, approvals, and token efficiency

## Product Shape

- `Overview` is the executive bridge.
- `Mission Control` is the live execution and intervention surface.
- `Intelligence` is the routing, memory, doctrine, and model strategy surface.
- `Reports` is the ROI, performance, and trend surface.
- `Settings` is the command rack for policy, security, integrations, and preferences.

## Epic Experience Layer

The Commander program should not stop at orchestration correctness. It should also feel like a real Jarvis command relationship.

Priority experience additions:

- `Mission preflight card`
  - show context loaded, branch count, expected cost, approval posture, confidence, and top risk before launch
- `Commander memory brief`
  - compact learned readback before execution:
    - what this task is
    - what usually works
    - what usually fails
    - what context was loaded
- `Confidence + uncertainty rail`
  - explain how certain Commander is, why uncertainty exists, and whether human review is recommended
- `Interrupt and redirect`
  - allow mid-flight corrections:
    - stop and reroute
    - switch provider/model
    - reduce spend
    - slow down for verification
- `Single bottleneck rail`
  - always expose the one strongest current constraint
- `Autonomy ratio`
  - measure how much work completed without:
    - rescue
    - reroute
    - approval
    - retry
- `Benchmark-per-dollar board`
  - rank lanes by quality, completion, intervention pressure, and economics
- `Recurring automation tuning loop`
  - recurring flows should recommend safer cadence, tighter approvals, or cheaper lanes based on history
- `One-screen bridge mode`
  - compress Overview + Mission Control + Intelligence into a real cockpit
- `Interruptible conversational Commander`
  - the default interaction should become:
    - tell Commander the mission
    - see the brief
    - redirect or approve
    - watch execution

## Phase Plan

### Phase 0: Cleanup and Canonicalization

- Normalize commander architecture into explicit roles:
  - UI identity
  - orchestration engine
  - fallback bootstrap
- Normalize mission/task semantics into one lifecycle.
- Normalize provider / model / routing terminology.
- Normalize connected systems into a capability graph.
- Normalize memory vs directive vs recommendation vs doctrine semantics.
- Lock page responsibilities so the app stops overlapping itself.

### Phase 1: Bridge + Intake

- Finish the flagship command bridge.
- Add one canonical Commander intake flow.
- Let a plain-language task produce:
  - mission brief
  - route recommendation
  - model / cost / speed posture
  - systems required
  - approval posture
- Make advanced mission form an expert mode, not the default entry.

### Phase 2: Delegation Engine

- Turn Commander into a supervisor, not a lone worker.
- Add specialist lanes:
  - Planner
  - Researcher
  - Builder
  - Verifier
  - Ops / CRM / Finance specialists later
- Add parent/child mission graph support.
- Add parallel and sequential subtask execution.
- Add intervention controls for reroute, retry, stop, escalate, and approve.

### Phase 3: Context + Skills + Memory

- Introduce context packs and selective loading.
- Add on-demand skill injection.
- Add domain-aware memory namespaces.
- Add evidence-first long-context behavior for big tasks.
- Prevent every agent from seeing everything.

### Phase 4: Adaptive Routing + Learning

- Evaluate every mission after completion.
- Track:
  - selected lane
  - expected vs actual cost
  - expected vs actual latency
  - human overrides
  - failures / retries
- Promote wins into doctrine.
- Demote expensive, weak, or failure-prone routes.
- Surface regression and connector-health recommendations automatically.
- Add intervention-weighted doctrine scoring so retries, cancels, reroutes, and guardrails reduce lane confidence directly.
- Add mission pattern memory, context-effectiveness scoring, skill-effectiveness scoring, rescue-cost memory, escalation-quality memory, and automation maturity scoring.

### Phase 5: Founder Domain Packs

- Deepen the domains closest to current repo truth:
  - Build
  - Research
  - CRM / Comms
  - Ops
- Expand later into:
  - Money
  - Personal
  - Executive planning

### Phase 6: Full Jarvis Experience

- Conversational mission refinement.
- One-screen all-systems bridge mode.
- Executive briefings:
  - what should I do next
  - what is blocked
  - what is expensive
  - what should be automated next
- Strong explainability on why the system chose each lane.
- Voice and richer interaction later if still justified.
- Add:
  - commander briefing cadence
  - what should I do now
  - what can I automate now
  - why Commander chose this
  - why Commander paused this
  - why this lane is losing
  - fleet posture visibility for persistent vs ephemeral specialists

## Current Program State

- `Phase 0` is substantially complete:
  - commander canonicalization is in place
  - routing policy foundation is live
  - mission/task lifecycle normalization is live
  - major page responsibilities are now much clearer
- `Phase 1` is in progress:
  - flagship command bridge exists
  - readiness, autonomy posture, launch protocol, and truth audit are present
  - true natural-language Commander intake still needs to become the default entrypoint
- `Phase 2` is in progress:
  - parent/child mission graph is live
  - branch dependency editing is live
  - routing overrides and intervention controls are live
  - specialist spawning and retirement audit are live
  - richer planner-driven branch decomposition still needs to deepen
- `Phase 3` through `Phase 6` are mostly ahead:
  - partial doctrine and shared directive groundwork exists
  - the real memory, learning, domain-pack, and full Jarvis layers are still upcoming

## Remaining Program Order

1. Finish the execution core:
   - structured mission briefs
   - stronger execution plans
   - richer specialist decomposition
   - safer approvals, permissions, guardrails, and auditability
2. Finish the Jarvis decision cockpit:
   - deeper live orchestration from flagship surfaces
   - stronger explainability
   - complete decision-ready bridge, Mission Control, Intelligence, and Reports interplay
3. Deepen learning and memory:
   - doctrine updates
   - mission-pattern memory
   - context and skill effectiveness
   - rescue, escalation, and failure-pattern intelligence
4. Expand recurring systems into mature products:
   - autonomy recovery
   - tuning memory
   - executive briefing loops
5. Expand domain packs and mission families after the core is trusted
6. Hold authority-heavy future modes until safety and trust gates are met

## Release Gates

Do not broaden into finance, personal authority, voice, or other higher-authority operating modes until:

- routing trust is stable
- audit trail depth is complete
- permission boundaries are trustworthy
- recurring autonomy behavior is predictable

## Autodrive Rule

Autodrive for this roadmap means:

- keep shipping the highest-leverage slice from the progress board without waiting for approval on every small step
- pause only for:
  - destructive changes
  - dependency changes
  - schema changes with unclear impact
  - auth, security, or secrets changes
  - money, finance, or external-message authority
  - major UX direction forks
  - other risky product decisions involving money, external messaging, or permissions
- otherwise continue phase-by-phase with:
  - roadmap update
  - focused implementation
  - targeted verification
  - next-slice recommendation

Recommended user wording:

- `Autodrive is on. Keep shipping the next clean slice from the Commander/Jarvis roadmap without waiting for me between phases. Only pause for destructive actions, risky schema/security changes, money/external-send authority, or major UX forks.`

## Top 20 Must-Have Release Checklist

1. Natural-language Commander intake
2. Mission brief generation
3. Cost / speed / risk route preview
4. Canonical routing doctrine layer
5. Best-model selection per task type
6. Local-first / premium-escalation policy
7. Parent / child mission graph
8. Planner / Researcher / Builder / Verifier specialist lanes
9. Parallel subtask execution
10. Hybrid approval engine
11. Connected-system capability graph
12. Context packs
13. On-demand skill loading
14. Truth audit and readiness posture
15. Autonomy posture and bottleneck radar
16. Launch protocol / next best actions
17. Run evaluation and learning loop
18. Routing and regression recommendations
19. Executive briefings
20. Clean page boundaries across Overview / Mission Control / Intelligence / Reports / Settings

## Scope Guardrails

- Do not deepen domain automation until Phase 0 cleanup is complete.
- Do not add broad personal or finance authority before capability metadata, approvals, and auditability are strong.
- Do not add more “epic” UI surfaces that duplicate responsibility already owned by another page.

## Success Criteria

- One sentence can become one understandable, controllable mission.
- Commander uses the cheapest good-enough lane by default.
- Premium models are used deliberately, not habitually.
- Delegation improves speed and quality instead of creating noise.
- The operator can interrupt, redirect, and understand the system without reading internal implementation details.
- The system should feel elegant and cinematic without sacrificing bottleneck visibility or cost discipline.
- The operator can always see:
  - what is happening
  - why it is happening
  - what costs it
  - where to intervene
