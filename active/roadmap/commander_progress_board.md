# Commander Progress Board

This is the live build tracker for the Jarvis / Stark / Musk Commander program.

## Current Read

- Jarvis vision size: `100` scoped features
- Shipped foundation: `15`
- Active buildout: `30`
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
- First-class task outcome memory
- Launch recurring flows from automation recommendations

## Next Program Targets

### 1. Doctrine Feedback Persistence Into Recommendations And Learning Memory

Goal:
- let durable outcome signals directly shape visible recommendations and doctrine

Definition of done:
- outcome memory writes feed system recommendations or learning memory automatically
- doctrine updates stop depending on manual interpretation

Likely surfaces:
- [`/Users/Jjarvis/ai-command-center/src/utils/useLearningMemory.js`](/Users/Jjarvis/ai-command-center/src/utils/useLearningMemory.js)
- [`/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx`](/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx)

### 2. Unified Intervention Timeline Rail In Mission Control

Goal:
- compress overrides, approvals, outcomes, and doctrine guidance into one pressure-ready rail

Definition of done:
- one timeline answers what changed, why, and what to do next
- operator review becomes fast under pressure

### 3. Benchmark-Aware Provider Escalation Explanations

Goal:
- make provider/model escalation understandable when Commander leaves the default lane

Definition of done:
- Mission Control and Intelligence explain benchmark-driven lane choices clearly
- operators can see why a route escalated or stayed cheap

### 4. Recurring Flow Editing And Automation Guardrails

Goal:
- turn first-launch recurring flows into safer, tunable automations

Definition of done:
- launched recurring flows can be reviewed and tuned easily
- approval and cadence guardrails stay visible after launch

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

1. doctrine feedback persistence into recommendations and learning memory
2. unified intervention timeline rail in Mission Control
3. benchmark-aware provider escalation explanations
4. recurring flow editing and automation guardrails
