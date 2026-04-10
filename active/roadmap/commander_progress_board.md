# Commander Progress Board

This is the live build tracker for the Jarvis / Stark / Musk Commander program.

## Current Read

- Jarvis vision size: `100` scoped features
- Shipped foundation: `15`
- Active buildout: `43`
- Immediate next targets: `4`
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
- First-class intervention memory
- Lane demotion reasons in Intelligence
- Routing policy trend and pressure history
- Recurring guardrail and intervention history in Reports
- Structured intervention history in Mission Control
- First-class specialist lifecycle memory
- Recurring flow management and tuning
- Mission preflight and confidence readback
- Single bottleneck rail and autonomy ratio visibility
- Mission-pattern memory and rescue-aware learning
- Specialist lifecycle visibility consistency across fleet surfaces
- Trend-aware doctrine scoring deeper into recommendation rank
- Recurring tuning outcomes feeding recommendation rank more directly
- Preflight-to-runtime alignment checks
- Doctrine-rank delta readback in Intelligence and Reports
- Persistent-lane promotion guidance from lifecycle pressure
- Stronger confidence-to-runtime loop closure
- One-click persistent-lane promotion from guidance
- More aggressive recommendation-rank shifts from rescue and pattern winners
- Doctrine-delta visibility in additional operator surfaces
- Post-launch confidence closure in Mission Control and Reports
- Recommendation classes driven by rescue and mission-pattern pressure
- One-click promotion actions in more operator surfaces
- Doctrine-delta visibility in Mission Control and executive briefing surfaces
- Persistent-lane creation defaults when no spawned match exists
- Runtime recommendation weighting from post-launch confidence closure
- Recurring automation trust tuning from runtime memory

## Epic Experience Layer

These are now explicit roadmap targets, not implied polish:

- Mission preflight card
- Commander memory brief
- Confidence + uncertainty rail
- Interrupt and redirect controls
- Single bottleneck rail
- Autonomy ratio
- Benchmark-per-dollar board
- Recurring automation tuning loop
- One-screen bridge mode
- Interruptible conversational Commander

## Next Program Targets

### 1. First-Class Specialist Lifecycle Memory

Goal:
- stop depending on mixed log parsing for specialist fleet history

Definition of done:
- specialist lifecycle events are persisted structurally
- Intelligence and Mission Control use the same normalized fleet history source
- specialist spawn, promotion, retirement, and cleanup all share one memory rail

Likely surfaces:
- [`/Users/Jjarvis/ai-command-center/src/utils/useSupabase.js`](/Users/Jjarvis/ai-command-center/src/utils/useSupabase.js)
- [`/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx`](/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx)
- [`/Users/Jjarvis/ai-command-center/src/views/MissionControlView.jsx`](/Users/Jjarvis/ai-command-center/src/views/MissionControlView.jsx)

### 2. Routing Policy Trend And Demotion History

Goal:
- make it obvious why a lane is improving, flat, or being demoted

Definition of done:
- Intelligence shows trend direction and pressure sources over time
- intervention pressure directly shapes visible routing confidence

Likely surfaces:
- [`/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx`](/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx)
- [`/Users/Jjarvis/ai-command-center/src/utils/commanderAnalytics.js`](/Users/Jjarvis/ai-command-center/src/utils/commanderAnalytics.js)
- [`/Users/Jjarvis/ai-command-center/src/utils/useLearningMemory.js`](/Users/Jjarvis/ai-command-center/src/utils/useLearningMemory.js)

### 3. Recurring Flow Management And Tuning

Goal:
- turn recurring launches into manageable automation products

Definition of done:
- cadence, mission mode, and approval posture can be tuned over time
- latest outcomes, guardrails, and interventions stay visible after launch

### 4. Mission Preflight Card

- show context loaded, expected branches, cost, approval posture, confidence, and top risks before launch

### 5. Confidence + Uncertainty Rail

- make certainty and unknowns visible before and during execution

### 6. Single Bottleneck Rail

- always expose the one strongest current constraint across cost, approvals, intervention pressure, or connector drag

### 7. Autonomy Ratio + Rescue-Rate Visibility

- measure how much work completed cleanly vs with rescue

### 8. Mission Pattern Memory

- learn repeatable mission shapes, not just individual outcomes

### 9. One-Screen Bridge Mode

- compress Overview, Mission Control, and Intelligence into the true Jarvis cockpit

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
  - auth / security / secrets changes
  - permission / money / external-message authority questions
  - major UX forks

Default posture:

- continue without re-asking for approval between clean slices
- only pause when one of the blockers above is hit
- always leave the roadmap pack more accurate than it was before the slice

## Current Recommendation

Build next:

1. keep widening doctrine-delta visibility as a cross-surface trust rail
2. turn promotion defaults into stronger durable-fleet shaping rules
3. deepen recurring automation trust tuning into stricter autonomy posture changes
4. push mission-pattern winners harder into provider and lane defaults
