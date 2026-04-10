# Commander Progress Board

This is the live build tracker for the Jarvis / Stark / Musk Commander program.

## Current Read

- Jarvis vision size: `100` scoped features
- Shipped foundation: `15`
- Active buildout: `26`
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

## Next Program Targets

### 1. Promotion And Override History Timelines

Goal:
- make branch and specialist doctrine changes auditable over time

Definition of done:
- show route changes, promotions, and operator overrides as clean time-based history
- make intervention decisions reviewable after the fact

Likely surfaces:
- [`/Users/Jjarvis/ai-command-center/src/views/MissionControlView.jsx`](/Users/Jjarvis/ai-command-center/src/views/MissionControlView.jsx)
- [`/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx`](/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx)

### 2. Persisted Outcome Scoring And Doctrine Feedback

Goal:
- move outcome quality from derived view logic into reusable Commander memory

Definition of done:
- each mission stores a stable quality score or snapshot
- doctrine can automatically react to quality drift over time

### 3. Workload Balancing Across Cloud And Local Lanes

Goal:
- route more work to the cheapest reliable lane without sacrificing outcomes

Definition of done:
- balancing rules exist across local and cloud lanes
- routing can explain when it escalated and when it stayed local

### 4. “What Can I Automate Next?” Recommendation Engine

Goal:
- turn reports and mission history into the next best automation suggestions

Definition of done:
- recommend high-repeat, low-risk work for automation
- connect those recommendations to ROI and bottleneck data

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

1. promotion and override history timelines
2. persisted outcome scoring and doctrine feedback
3. workload balancing across cloud and local lanes
4. what can I automate next? recommendation engine
