# Commander Feature Matrix

Legend:

- `Now`: must-have in the first serious execution-focused release
- `Later`: planned after the core engine is trusted
- `Future`: speculative, optional, or dependent on stronger safety / maturity
- `Shipped`: materially implemented in the product already
- `In Progress`: partially implemented or visibly underway
- `Next`: the next recommended build target
- `Queued`: important, but not the immediate next slice
- `Later / Future`: intentionally deferred

| # | Feature | Phase | Priority | Status |
|---|---------|-------|----------|--------|
| 1 | Natural-language command intake | 1 | Now | In Progress |
| 2 | Intent parsing into mission brief | 1 | Now | In Progress |
| 3 | Auto-generated execution plan | 1 | Now | In Progress |
| 4 | Subtask decomposition into specialist lanes | 2 | Now | In Progress |
| 5 | Best-model routing per subtask | 1 | Now | In Progress |
| 6 | Cost-aware routing | 1 | Now | Shipped |
| 7 | Risk-aware routing | 1 | Now | Shipped |
| 8 | Parallel subagent execution | 2 | Now | In Progress |
| 9 | Sequential orchestration | 2 | Now | Shipped |
| 10 | Hybrid approval system | 2 | Now | In Progress |
| 11 | Mission modes: do now / plan first / watch | 1 | Now | In Progress |
| 12 | Mission templates | 1 | Later | Queued |
| 13 | Recurring automations | 1 | Later | In Progress |
| 14 | Real-time mission graph | 2 | Now | Shipped |
| 15 | Live execution timeline | 2 | Now | Shipped |
| 16 | Command Center readiness score | 1 | Now | Shipped |
| 17 | Autonomy posture score | 1 | Now | Shipped |
| 18 | Bottleneck radar | 1 | Now | In Progress |
| 19 | Launch protocol panel | 1 | Now | Shipped |
| 20 | Truth audit strip | 1 | Now | Shipped |
| 21 | Connected systems dock | 0 | Now | In Progress |
| 22 | Read-only vs write permissions per connector | 0 | Now | In Progress |
| 23 | Domain packs: Build / Sell / Operate / Money / Personal | 5 | Later | Queued |
| 24 | Skill loading on demand | 3 | Now | In Progress |
| 25 | Context-pack system | 3 | Now | In Progress |
| 26 | Long-context document bundle support | 3 | Later | Later |
| 27 | Evidence-first reasoning with source grounding | 3 | Later | Later |
| 28 | Shared directive layer | 0 | Now | Shipped |
| 29 | Personal preference / policy layer | 0 | Now | In Progress |
| 30 | Budget guardrails per mission | 1 | Now | In Progress |
| 31 | Token budget guardrails | 0 | Now | In Progress |
| 32 | Latency target per task | 1 | Later | Queued |
| 33 | Outcome quality scoring | 4 | Later | In Progress |
| 34 | Automatic retry policy | 2 | Later | Queued |
| 35 | Failure triage mode | 4 | Now | In Progress |
| 36 | Self-healing suggestions | 4 | Later | Later |
| 37 | Temporary specialist agents | 2 | Now | Shipped |
| 38 | Persistent specialist agents | 2 | Later | In Progress |
| 39 | Agent skill cards | 1 | Later | Queued |
| 40 | Model registry with cost / latency / quality | 1 | Now | Shipped |
| 41 | Best lane recommendations by task type | 4 | Now | In Progress |
| 42 | Model benchmark board from observed runs | 4 | Later | In Progress |
| 43 | Workload balancer across cloud and local models | 4 | Later | In Progress |
| 44 | Local-first execution mode | 1 | Now | In Progress |
| 45 | Premium-only mode | 1 | Later | Queued |
| 46 | Stealth / privacy mode | 5 | Future | Future |
| 47 | Finance mode with stricter approvals | 5 | Later | Later |
| 48 | Calendar-aware scheduling | 5 | Later | Later |
| 49 | Email draft generation with approval before send | 5 | Later | Later |
| 50 | CRM note and deal update automation | 5 | Later | Later |
| 51 | Inbox triage and reply drafting | 5 | Later | Later |
| 52 | Slack / team alerts and command approvals | 5 | Later | Later |
| 53 | Document drafting and redlining | 5 | Later | Later |
| 54 | Research sweeps across web, docs, and internal sources | 5 | Later | Later |
| 55 | Competitive intelligence missions | 5 | Later | Later |
| 56 | Codebase debugging missions | 5 | Later | Later |
| 57 | PR review and bug-fix missions | 5 | Later | Later |
| 58 | Test generation and verification missions | 5 | Later | Later |
| 59 | Incident command mode | 6 | Later | Later |
| 60 | War-room mode | 6 | Later | Later |
| 61 | Personal chief-of-staff mode | 6 | Future | Future |
| 62 | Founder dashboard for priorities / risks / leverage | 6 | Later | Queued |
| 63 | Revenue pulse | 5 | Later | Later |
| 64 | Cost control board for AI spend and labor savings | 1 | Now | Shipped |
| 65 | Automation ROI board | 4 | Later | In Progress |
| 66 | “What should I do next?” command briefing | 6 | Later | In Progress |
| 67 | “What can I automate next?” recommendation engine | 4 | Later | In Progress |
| 68 | Memory engine for successful mission patterns | 3 | Later | In Progress |
| 69 | Memory recall by domain / project / person / task type | 3 | Later | Later |
| 70 | Adaptive doctrine that updates preferred routes | 4 | Now | In Progress |
| 71 | Bug pattern detector across repeated failures | 4 | Later | Later |
| 72 | Drift detection for underperforming models | 4 | Later | Later |
| 73 | Approval friction detector | 4 | Later | Later |
| 74 | System health detector for integrations | 4 | Later | Later |
| 75 | Mission postmortem generator | 4 | Later | Later |
| 76 | Daily executive briefing | 6 | Later | Queued |
| 77 | Weekly strategy brief | 6 | Later | Queued |
| 78 | Monthly operating review | 6 | Later | Queued |
| 79 | Personal finance brief with controlled permissions | 5 | Future | Future |
| 80 | Personal life admin mission lane | 5 | Future | Future |
| 81 | Travel / scheduling orchestration | 5 | Future | Future |
| 82 | Vendor / subscription management | 5 | Future | Future |
| 83 | Autonomous research notebook | 3 | Later | Later |
| 84 | Decision memo generator | 5 | Later | Later |
| 85 | Scenario simulation for strategic choices | 6 | Future | Future |
| 86 | “Maximize speed” mode | 1 | Later | Queued |
| 87 | “Minimize cost” mode | 1 | Later | Queued |
| 88 | “Minimize risk” mode | 1 | Later | Queued |
| 89 | Voice-command support | 6 | Future | Future |
| 90 | Conversational interruption / redirection | 6 | Later | Later |
| 91 | Explainability panel for model / tool / agent choice | 6 | Now | In Progress |
| 92 | Human override on any mission step | 2 | Now | Shipped |
| 93 | Full audit trail for every decision and tool call | 0 | Now | In Progress |
| 94 | Secure secrets vault integration | 0 | Now | In Progress |
| 95 | Personal operating manual learned by Commander | 3 | Future | Future |
| 96 | Relationship memory for people and collaborators | 5 | Future | Future |
| 97 | Multi-workspace switching with one commander identity | 6 | Later | Later |
| 98 | Executive cockpit UI with cinematic telemetry | 1 | Now | Shipped |
| 99 | One-screen all-systems bridge mode | 6 | Later | Queued |
| 100 | Continuous improvement loop | 4 | Now | In Progress |

## Must-Have Now Summary

- Total `Now`: 28
- First release focus:
  - intake
  - routing
  - delegation
  - truth / readiness
  - cost discipline
  - explainability
  - auditability

## Current Read

- `Shipped`: 15
- `In Progress`: 61
- `Next`: 0
- `Queued`: 16
- `Later / Future`: 48

## Immediate Next Four

1. Finish structured mission brief generation from natural-language intake
2. Finish stronger auto-generated execution planning and richer specialist decomposition
3. Finish hybrid approval, guardrails, and audit-trail depth needed for default-safe orchestration
4. Finish execution-core explainability, routing trust, and permission semantics before broadening domain scope

## Epic Experience Layer Additions

These are now explicit tracked roadmap targets even when they are implemented as cross-cutting UI + intelligence work:

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

Current phase 2 note:

- Mission preflight, confidence/uncertainty, and Commander memory brief are now present in the launch surface.
- The launch surface now also explains why Commander chose the lane and why it would pause the mission before launch.
- Mission Control now explains why Commander chose a branch and why it is paused when you inspect the drawer.
- Overview now exposes a one-screen bridge mode that compresses executive, mission, and intelligence signals into one cockpit.
- Overview bridge mode now hands conversational mission intake directly into Mission Control with prefilled posture.
- Overview bridge mode now supports inline approve, retry, stabilize, and redirect controls for the highest-pressure branch.
- Overview bridge mode now supports a ranked multi-branch intervention queue for inline cockpit control.
- Overview bridge mode now supports true batch command control across the top intervention queue.
- Bridge batch actions now write grouped audit events into command memory and expose a latest batch-command readback in the cockpit.
- Grouped batch-command audits now surface across Mission Control, Reports, and Intelligence.
- Policy-delta actions now carry evidence-aware guidance from summary surfaces, and approval-loosening only stages when trust evidence clears the threshold.
- Summary surfaces can now propose evidence-backed provider/model swaps and stage them directly into the routing editor.
- The routing editor now shows threshold-aware current-vs-suggested lane comparisons and can stage the previous lane into fallback order during strong swap cases.
- Summary-surface lane swaps now declare whether the move is safer, cheaper, faster, or stronger before the operator enters the routing editor.
- Reports and executive readback rails now reflect the same lane-tradeoff language so routing tradeoffs stay readable outside Intelligence.
- Reports now shows whether the chosen safer/cheaper/faster/stronger tradeoff is actually paying back in outcome terms.
- Overview and Mission Control now surface the same tradeoff payback signal so live operator surfaces can judge whether the route change is helping the system.
- Tradeoff payback now influences recommendation ranking and bridge intervention pressure so weak routing tradeoffs are corrected faster.
- Recommendation cards and bridge targets now spell out the corrective action for a losing safer/cheaper/faster/stronger tradeoff.
- Low-risk corrective actions can now be staged directly from the bridge, Mission Control summaries, and Intelligence recommendation cards.
- Staged corrective actions now show expected improvement and expected tradeoff before the routing draft is saved.
- Staged corrective actions now show current posture vs proposed posture before save.
- Staged corrective actions now preview doctrine-confidence impact, recommended verification thresholds, success criteria, and rollback criteria before save.
- Remaining epic-experience gaps are now more heavily concentrated in richer cross-surface interruption and deeper inline post-launch orchestration beyond the bridge surface.

## Intelligence / Learning Upgrades To Fold Into Existing Features

These are not separate feature IDs yet. They should be implemented as depth added to the existing routing, memory, and automation rows above:

- specialist lifecycle memory
- policy trend memory
- intervention-weighted doctrine scoring
- mission pattern memory
- context effectiveness scoring
- skill effectiveness scoring
- rescue-cost memory
- escalation-quality memory
- failure-cluster detection
- automation maturity scoring

## Updated Immediate Next Order

1. Finish the core execution engine from `In Progress` to truly `Shipped`
2. Finish the Jarvis decision cockpit so flagship surfaces become decision-complete
3. Deepen learning, memory, and doctrine so routing and approval changes are evidence-driven
4. Expand recurring automation into mature managed products with executive briefing loops
5. Expand domain packs and mission families only after the execution core is trustworthy
6. Keep future authority-heavy modes deferred until trust, auditability, and permissions are strong

## Remaining Interfaces To Mature

- mission brief structure:
  - intent
  - constraints
  - domain
  - risk
  - approval posture
  - cost posture
- execution plan structure:
  - branches
  - dependencies
  - specialists
  - route choices
  - verification requirements
- doctrine and learning outputs:
  - confidence movement
  - trust movement
  - recommendation rank
  - correction suggestions
  - success and rollback standards
- recurring automation model:
  - cadence
  - approval posture
  - recovery state
  - maturity
  - autonomy-earned state
- domain-pack capabilities:
  - connectors
  - skills
  - context packs
  - approval rules
  - reporting outputs

## Release Gates

- Do not advance into finance, personal, voice, or broader authority modes until:
  - routing trust is stable
  - audit trail is complete
  - permissions are trustworthy
  - recurring autonomy behavior is predictable

## Autodrive Program Rule

- Autodrive is enabled by default for this program.
- Keep shipping the next clean slice without waiting for approval each phase.
- Pause only for:
  - destructive actions
  - risky schema or security changes
  - money / finance authority
  - external sending or user-facing side effects
  - major UX forks

## Future Summary

The following are intentionally delayed until the execution core is trustworthy:

- personal finance authority
- personal life admin
- travel orchestration
- relationship memory
- voice-first interaction
- scenario simulation
- stealth / privacy special modes beyond base controls
- 2026-04-10: Summary-surface corrective actions now preview expected improvement and expected tradeoff before routing changes are staged in Intelligence.
- 2026-04-10: Staged corrective actions now show current posture vs proposed posture before save across executive, operator, and routing surfaces.
- 2026-04-10: Staged corrective actions now preview doctrine confidence impact before save across executive, operator, and routing surfaces.
- 2026-04-10: Staged corrective actions now preview recommended verification thresholds before save across executive, operator, and routing surfaces.
- 2026-04-10: Staged corrective actions now preview success criteria before save across executive, operator, and routing surfaces.
- 2026-04-10: Staged corrective actions now preview rollback criteria before save across executive, operator, and routing surfaces.
