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

Recent execution-core progress:

- mission launch now persists a launch-readiness contract built from capability coverage and connected-system health
- Mission Creator, Mission Control, and Reports now read back that same launch-readiness contract
- missing or degraded required systems now harden launch posture instead of only showing as soft UI hints
- missing or degraded required systems now push branch assignment and bottleneck visibility instead of staying as passive launch metadata
- connected-system permission scope, domain, and trust metadata now flow into execution readiness and operator UI
- launch readiness now distinguishes permission-limited connectors from missing coverage and flags local-first-eligible missions explicitly
- branch-level execution posture now routes read-only connector work toward safer research/ops lanes and keeps live-write connector branches human-aware
- Mission Creator now explains connector posture branch by branch before launch instead of only summarizing it at mission level
- Mission Control now shows live branch connector posture alongside launch brief and launch readiness
- Overview and Intelligence now treat guarded connector branches as a first-class executive signal and recommendation-pressure input
- Overview live queue now boosts guarded connector branches and explains the exact blocking connector lane in blocker copy
- Mission Control now pulls guarded connector branches into resolve-first and sidebar recommendation pressure instead of leaving them as passive context
- Overview queue cards now add explicit connector corrective moves such as reconnect, downgrade to draft, reroute read-only, or hold for approval
- Mission Control connector intervention wording now points at the fastest safe next move instead of only naming the pressure
- Intelligence connector-pressure recommendations now carry corrective-action wording with target lane and approval posture
- Overview branch signal now includes the connector next move directly in executive read-first copy
- Shared connector blockers now collapse into one grouped executive fix when several branches are stuck behind the same connector lane
- Grouped connector fixes can now stage a Managed Ops recovery draft so the operator can act on the shared blocker without rebuilding the fix by hand
- Grouped connector pressure now carries explicit “do next” orders that separate connector recovery from reroute or guarded-lane fallback
- Launch readiness now chooses between local-first fallback and read-only reroute fallback, and branch decomposition now carries that fallback posture into routing
- Queue and recommendation priority now push guarded external fallback higher while treating local-first fallback as safer throughput
- Overview queue cards now show dependency-aware transition posture such as held-on-upstream and released, and mission graph progress is now derived from graph state instead of only flat row counts.
- Bottleneck radar now ranks graph pressure explicitly, separating blocked branches from upstream-held branches so executive read-first guidance can say what to clear first with dependency-aware wording.

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
3. Finish safer parallel execution, dependency-aware release, and graph-derived bottleneck radar so the mission graph behaves like a real orchestrator
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
- Mission preview now returns a structured brief and compact execution brief so Commander reads intent and branch posture more like a real mission brief before launch.
- Recurring payback now feeds shared doctrine and recommendation memory, with Overview and Intelligence surfacing when winning recurring posture changes should promote defaults and losing ones should be demoted faster.
- Recurring launch defaults now use adaptive-control memory so winning recurring posture changes can promote lighter cadence and approval posture while underperforming ones harden the runtime launch path faster.
- Recurring change history and payback now feed a shared post-change verdict and next-move recommendation across Mission Control, Managed Ops, and Reports so weak recurring posture changes can immediately queue the next correction.
- Managed Ops now auto-stages the next recurring correction when payback is weak, and recurring verdict surfaces now show before-vs-after posture comparisons across the operator flow.
- Schedule dispatch now uses recurring adaptive-control memory so real recurring payback can promote or harden runtime launch posture before the recurring task is created.
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
- 2026-04-10: Mission review and debrief surfaces now read persisted `mission_create` brief metadata so launch intent survives into live intervention and executive reporting without re-inference.
- 2026-04-10: Doctrine sync and Reports now turn persisted launch-brief memory into a compact postmortem signal so Commander can judge whether the saved objective and verification posture are holding against outcomes.
- 2026-04-10: Recurring automation posture now reads persisted launch-brief memory so cadence and approval posture can be tuned against the original saved objective and verification requirement, with Reports surfacing the strongest recurring brief-fit signal.
- 2026-04-10: Mission Control and Managed Ops now surface recurring brief-fit readback so runtime cadence and approval changes explain themselves in operator-facing recurring surfaces.
- 2026-04-10: Recommendation ranking and bottleneck pressure now treat recurring brief-fit drift as a first-class signal, elevating under-verified recurring flows earlier and reinforcing clean recurring brief-holders as safer scale targets.
- 2026-04-10: Overview and Reports now surface explicit recurring executive actions from brief-fit memory, telling Commander when to tighten approval, slow cadence, keep watch posture, or scale autonomy.
- 2026-04-10: Mission Control and Managed Ops now turn recurring executive actions into staged operator drafts, so the suggested fix can open directly as a prefilled recurring ops workflow.
- 2026-04-10: Staged recurring ops workflows now include expected improvement, verification target, success criteria, and rollback criteria so the operator handoff reads like a compact recurring decision brief.
- 2026-04-10: Staged recurring ops workflows now show current vs drafted cadence, approval posture, mission mode, and run state so recurring posture changes are explicit before the operator acts.
- 2026-04-10: Managed Ops recurring drafts are now editable and apply through the live recurring mission tuning path, so cadence, approval, mission mode, and run state can be promoted from draft into saved recurring posture.
- 2026-04-10: Recurring posture saves now echo back across Mission Control, Managed Ops, and Reports with saved-change confirmation plus tuning and guardrail history.
- 2026-04-10: Saved recurring posture changes now show payback across Mission Control, Managed Ops, and Reports using outcome, rescue, and guardrail signals.
- 2026-04-11: Hybrid approval, failure triage, and audit-trail readback now share one normalized execution-control contract. Manual mission approvals, review-room approvals/rejections, retries, stops, reroutes, dependency updates, recurring tuning, and bridge batch actions all persist structured control metadata into `task_interventions`, while Overview, Mission Control, and Reports now expose unified approval pressure, failure-triage verdicts, and execution audit history without relying on disconnected per-surface heuristics.
- 2026-04-11: The execution-control contract now feeds doctrine and operator guidance. `useLearningMemory` persists hybrid-approval, failure-triage, and execution-audit memory plus matching system recommendations, and Mission Control / Intelligence now surface audit-derived next-move orders so the new control trail actively shapes what Commander says to do next.
- 2026-04-11: The execution-control contract now affects runtime behavior. `createMission` and `dispatchFromSchedule` harden or relax approval posture from recent approval/recovery memory, `retryTask` can convert repeated noisy rescues into guarded retries that wait for human review, and Mission Control / Intelligence can now stage the strongest audit-derived next move straight into Managed Ops.
- 2026-04-11: Branch ordering is now safer and more execution-aware. Mission subtask creation precomputes dependency-safe ids, prioritizes local-first and read-only fallback branches ahead of guarded external work, and keeps dependency-bound branches from auto-starting before their upstream work exists.
- 2026-04-11: Branch-ordering rationale now shows up in operator surfaces. Mission Creator reuses the safer ordering model for delegation preview, and Mission Control now reads back branch execution-order plus explicit hold reasons from dependencies, approval gates, and fallback posture.
- 2026-04-11: Dependency release is now part of live orchestration. Commander heartbeat promotes dependency-cleared branches into `queued/ready`, persists a dependency-release control event, and Mission Control now shows when a branch was released after upstream completion instead of only showing static dependency chips.
- 2026-04-11: Overview and the live command queue now read from graph-aware transition state. Queue cards show held-on-upstream and released posture, blocker copy uses dependency-aware transition detail, and mission graph progress is now derived from graph state instead of only flat task-row counts.
- 2026-04-11: Bottleneck radar now treats graph pressure as a first-class signal. `getPrimaryBottleneck(...)` separates blocked branches from upstream-held branches and feeds that distinction into executive read-first guidance so Commander can name the real graph choke point and the next clearing move.
- 2026-04-11: Heartbeat dispatch is now safer about parallel fan-out. Local-first, read-only-reroute, and explicitly parallel-safe branches can dispatch together when they are independent, while guarded external, draft-sensitive, and serialized sibling branches stay serialized within the mission instead of launching side by side just because they are queued.
- 2026-04-11: Dispatch posture is now operator-visible. Mission Control rows and branch drawers, Overview queue cards, and Intelligence read-first guidance now explain whether a branch is safe to fan out, intentionally serialized, or still waiting on release, so runtime dispatch discipline reads like an explicit orchestration policy instead of hidden queue behavior.
- 2026-04-11: Dispatch-order actions are now operable. Mission Control and Intelligence can stage the current dispatch move into Managed Ops, and Managed Ops now shows a dispatch brief with expected improvement, verification target, success criteria, rollback criteria, and the current graph pressure mix.
- 2026-04-11: The flagship surfaces now share one authoritative Commander next order. Overview read-first, Mission Control control-order staging, and Intelligence’s top recommendation all pull from the same next-move engine that ranks failure triage, approvals, grouped connector blockers, dispatch posture, and audit-derived orders into one top action.
- 2026-04-11: The shared Commander next order now feeds runtime and queue behavior too. `createMission(...)` and `dispatchFromSchedule(...)` read the same next-move signal when hardening approval posture, while Overview’s live queue and Mission Control’s resolve-first ordering now prioritize the items that best match the active Commander order so runtime escalation, operator priority, and flagship read-first guidance stay aligned.
- 2026-04-11: Hybrid approval is now legible as one control loop across flagship surfaces. Mission gates plus review gates are counted consistently in Overview, Mission Control, Reports, and Intelligence, and the shared hybrid-approval summary now carries queue posture, approval posture, and next-move guidance so Commander can explicitly distinguish queued review cleanup, low-risk mission release, and holding-gate posture across operator, executive, and doctrine views.
- 2026-04-11: Approval transitions are now explicit in the live operator layer. `missionLifecycle` now derives named approval transitions such as queued review, queued mission approval, approval released, and rejected-and-held, and Mission Control plus Overview surface those labels directly in approval cards, bridge queue readback, and branch drawer detail so approval state is less inferred and more trustworthy.
- 2026-04-11: Branch decision narrative is now a shared trust layer. `missionLifecycle` derives one branch-level decision story from approval transition, live control state, and execution transition, and Reports, Intelligence, Overview, and Mission Control now read back that same explanation so branch advancement, pause, reroute, and release posture stop being described differently by different surfaces.
- 2026-04-11: Runtime graph decisions are now more legible across flagship surfaces. Branch decision narratives explicitly connect dispatch/release posture, approval state, and live control state into one shared explanation so the operator can see why a branch is advancing, still held, or intentionally serialized without reconciling multiple partial panels.
- 2026-04-11: Retry, reroute, hold, and release now share one live-control state layer. `missionLifecycle` derives a branch-level control state from intervention history plus graph posture, Overview bridge interventions and Mission Control branch detail now read that same live-control state, and Managed Ops can now accept a staged `controlActionBrief` so branch recovery decisions land as a dedicated operator brief instead of scattered queue actions.
- 2026-04-11: The live-control layer now carries a recommended resolution posture too. Branch control state now includes whether Commander thinks the branch is safe to auto-resume, should remain held until review, or should keep its current reroute/retry path active, and Overview / Mission Control now surface that “safest next move” directly in the operator readback.
- 2026-04-11: Reports and Intelligence now consume the shared live-control narrative too. `getLiveControlNarrativeSummary(...)` turns branch-level retry/reroute/hold/release state into one top explanation, Reports now surfaces that as an executive narrative panel and read-first signal, and Intelligence now uses it in both read-first and derived recommendations while preserving stageable handoff into Managed Ops through `controlActionBrief`.
- 2026-04-11: Runtime graph reasoning is now persisted and cross-surface. Mission subtask creation records dispatch-contract detail in branch routing reasons, dependency-release control events now carry explicit release-trigger metadata, and Overview, Reports, and Intelligence now consume a shared graph-reasoning summary that explains held, released, serialized, and safe-parallel branch posture from the same execution model.
- 2026-04-11: Graph-contract reasoning is now explicit in planning and inspection surfaces. `executionReadiness` now exposes shared dispatch-contract and release-trigger helpers, Mission Creator previews the resulting graph contract before launch, and Mission Control rows plus branch detail now read the same persisted contract back from routing and release metadata so operators can see why a branch starts now, stays serialized, or waits on upstream completion.
- 2026-04-11: Graph-contract pressure now shapes the top Commander order more explicitly. `executionReadiness` now summarizes release-chain, guarded-serialized, and safe-parallel graph pressure, `getPrimaryBottleneck(...)` and `getCommanderNextMove(...)` now use that shared contract signal to separate graph-control modes instead of flattening dispatch pressure together, and Overview plus Intelligence now surface the same graph-contract order as a first-class flagship signal.
- 2026-04-11: Graph-aware recovery is now part of the execution core. `getFailureTriageSummary(...)` now reads persisted graph contracts to distinguish release-chain recovery, guarded-lane recovery, and safe-parallel recovery, `retryTask(...)` now keeps retries blocked when a branch still needs upstream release-chain clearance, and Overview, Mission Control, and Intelligence now surface that same recovery mode and safest next move instead of treating all branch failures as generic retry-or-reroute pressure.
- 2026-04-11: Graph-aware recovery is now operable from flagship surfaces. `buildFailureTriageActionDraft(...)` turns the live recovery model into a shared Managed Ops brief, and Mission Control, Overview, and Intelligence now stage that graph-aware recovery draft directly so operators can act on the safest reroute/hold/release path without manually translating the readback first.
- 2026-04-11: The primary retry controls are now aligned with graph-aware recovery. Overview’s batch/per-branch retry actions and Mission Control’s drawer rerun action now route the top failure case into the shared Managed Ops recovery brief before any blind rerun, which makes the safest graph-aware move the default operator handoff for the highest-pressure failure path.
- 2026-04-11: The flagship surfaces can now execute graph-aware release, reroute, and hold moves directly. `missionLifecycle` now exposes a shared executable control-action helper, and Overview / Mission Control use it to turn live control state into direct in-place actions like releasing an approval-held branch, rerouting a guarded lane to the selected safer agent, or holding an unstable running branch without forcing the operator through a stage-only workflow first.
- 2026-04-11: Intelligence now uses the same executable control-action model for the dominant live-control recommendation. The top recommendation can directly release an approval-held branch, hold unstable running work, or reroute a guarded lane to a safer live agent, with inline loading/error feedback, while still offering the staged Managed Ops brief as the more deliberate fallback path.
- 2026-04-11: Direct execution and staged review are now framed consistently across flagship surfaces. `missionLifecycle` now exposes a shared control-action-mode helper that decides direct labels, stage labels, and helper copy, so Overview, Mission Control, and Intelligence present the same “act now” versus “stage review” split for live control moves instead of mixing inconsistent button language and hidden confidence cues.
