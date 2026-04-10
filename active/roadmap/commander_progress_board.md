# Commander Progress Board

This is the live build tracker for the Jarvis / Stark / Musk Commander program.

## Current Read

- Jarvis vision size: `100` scoped features
- Shipped foundation: `15`
- Active buildout: `28`
- Immediate next targets: `0`
- Deferred / later items: `64`

## Shipped

- Command Center flagship bridge
- Readiness score and executive bridge posture
- Autonomy posture
- Launch protocol
- Truth audit strip
- Commander canonicalization
- Routing policy foundation
- Mission/task lifecycle normalization
- Real-time mission graph
- Live execution timeline
- Sequential orchestration
- Temporary specialist agents
- Human override on mission branches
- Cost control board / AI spend visibility
- Executive cockpit UI direction

## In Progress

- Intent parsing into mission briefs
- Auto-generated execution planning
- Specialist-lane decomposition
- Best-model routing per subtask
- Parallel execution across independent branches
- Hybrid approval system
- Bottleneck radar
- Connected system capability graph
- Connector permission semantics
- Personal preference / policy layer
- Budget and token guardrails
- Failure triage
- Best-lane recommendations
- Local-first execution policy
- Adaptive doctrine updates
- Explainability panels
- Continuous improvement loop
- Natural-language Commander intake
- Mission modes: do now / plan first / watch and approve
- Persistent specialist lane preference
- Executive “what should I do next?” briefing
- Context-pack routing metadata
- Skill-aware routing and specialist creation
- Observed best-lane recommendations
- Stronger persistent fleet management
- Model benchmark board from observed runs
- Outcome quality scoring
- Automation ROI board
- Promotion history in the specialist fleet
- Persisted outcome and doctrine log memory
- Local-first workload balancing
- Automation-next recommendation rack
- Mission Control outcome and doctrine timelines

## Next Program Targets

### 1. Persist Outcome Scoring Into First-Class Mission Memory

Goal:
- promote derived outcome quality into a reusable mission memory layer

Definition of done:
- quality snapshots survive outside activity logs
- doctrine can learn from them directly without reparsing messages

Likely surfaces:
- [`/Users/Jjarvis/ai-command-center/src/lib/api.js`](/Users/Jjarvis/ai-command-center/src/lib/api.js)
- [`/Users/Jjarvis/ai-command-center/supabase/functions/dispatch-task/index.ts`](/Users/Jjarvis/ai-command-center/supabase/functions/dispatch-task/index.ts)
- [`/Users/Jjarvis/ai-command-center/supabase/functions/commander-heartbeat/index.ts`](/Users/Jjarvis/ai-command-center/supabase/functions/commander-heartbeat/index.ts)

### 2. Branch-Level Override Timeline Polish In Mission Control

Goal:
- make intervention and override history easier to scan during live operations

Definition of done:
- route changes, promotions, dependencies, outcome scores, and feedback read as one coherent timeline
- operator review becomes fast under pressure

### 3. Local/Cloud Balancing Upgrades From Observed Benchmark Winners

Goal:
- route more work to the cheapest reliable lane using observed winners, not just heuristics

Definition of done:
- local-first and premium-escalation rules use benchmark evidence
- Commander can explain why it stayed local or escalated

### 4. Turn Automation Recommendations Into Launchable Recurring Flows

Goal:
- let the operator convert high-confidence automation candidates into real recurring workflows

Definition of done:
- recommendation cards can launch automation setup directly
- ROI stays visible after automation is activated

## Later

- Context packs
- Skill loading on demand
- Long-context evidence-first workflows
- Model benchmark board
- Workload balancing across cloud and local lanes
- CRM, research, build, ops, money, and personal domain packs
- Executive brief cadence
- One-screen all-systems bridge mode
- Voice interaction

## Autodrive Execution Rule

When autodrive is enabled:

- pick the top `Next` item that does not require a risky product decision
- ship it in the smallest useful slice
- run targeted verification
- update this file and the feature matrix after the slice
- keep going unless blocked by:
  - destructive changes
  - risky schema changes
  - permission / money / external-message authority questions
  - major UX forks

## Current Recommendation

Build next:

1. persist outcome scoring into first-class mission memory
2. branch-level override timeline polish in Mission Control
3. local/cloud balancing upgrades from observed benchmark winners
4. turn automation recommendations into launchable recurring flows
