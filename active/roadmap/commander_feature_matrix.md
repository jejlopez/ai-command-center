# Commander Feature Matrix

Legend:

- `Now`: must-have in the first serious execution-focused release
- `Later`: planned after the core engine is trusted
- `Future`: speculative, optional, or dependent on stronger safety / maturity

| # | Feature | Phase | Priority |
|---|---------|-------|----------|
| 1 | Natural-language command intake | 1 | Now |
| 2 | Intent parsing into mission brief | 1 | Now |
| 3 | Auto-generated execution plan | 1 | Now |
| 4 | Subtask decomposition into specialist lanes | 2 | Now |
| 5 | Best-model routing per subtask | 1 | Now |
| 6 | Cost-aware routing | 1 | Now |
| 7 | Risk-aware routing | 1 | Now |
| 8 | Parallel subagent execution | 2 | Now |
| 9 | Sequential orchestration | 2 | Now |
| 10 | Hybrid approval system | 2 | Now |
| 11 | Mission modes: do now / plan first / watch | 1 | Now |
| 12 | Mission templates | 1 | Later |
| 13 | Recurring automations | 1 | Later |
| 14 | Real-time mission graph | 2 | Now |
| 15 | Live execution timeline | 2 | Now |
| 16 | Command Center readiness score | 1 | Now |
| 17 | Autonomy posture score | 1 | Now |
| 18 | Bottleneck radar | 1 | Now |
| 19 | Launch protocol panel | 1 | Now |
| 20 | Truth audit strip | 1 | Now |
| 21 | Connected systems dock | 0 | Now |
| 22 | Read-only vs write permissions per connector | 0 | Now |
| 23 | Domain packs: Build / Sell / Operate / Money / Personal | 5 | Later |
| 24 | Skill loading on demand | 3 | Now |
| 25 | Context-pack system | 3 | Now |
| 26 | Long-context document bundle support | 3 | Later |
| 27 | Evidence-first reasoning with source grounding | 3 | Later |
| 28 | Shared directive layer | 0 | Now |
| 29 | Personal preference / policy layer | 0 | Now |
| 30 | Budget guardrails per mission | 1 | Now |
| 31 | Token budget guardrails | 0 | Now |
| 32 | Latency target per task | 1 | Later |
| 33 | Outcome quality scoring | 4 | Later |
| 34 | Automatic retry policy | 2 | Later |
| 35 | Failure triage mode | 4 | Now |
| 36 | Self-healing suggestions | 4 | Later |
| 37 | Temporary specialist agents | 2 | Now |
| 38 | Persistent specialist agents | 2 | Later |
| 39 | Agent skill cards | 1 | Later |
| 40 | Model registry with cost / latency / quality | 1 | Now |
| 41 | Best lane recommendations by task type | 4 | Now |
| 42 | Model benchmark board from observed runs | 4 | Later |
| 43 | Workload balancer across cloud and local models | 4 | Later |
| 44 | Local-first execution mode | 1 | Now |
| 45 | Premium-only mode | 1 | Later |
| 46 | Stealth / privacy mode | 5 | Future |
| 47 | Finance mode with stricter approvals | 5 | Later |
| 48 | Calendar-aware scheduling | 5 | Later |
| 49 | Email draft generation with approval before send | 5 | Later |
| 50 | CRM note and deal update automation | 5 | Later |
| 51 | Inbox triage and reply drafting | 5 | Later |
| 52 | Slack / team alerts and command approvals | 5 | Later |
| 53 | Document drafting and redlining | 5 | Later |
| 54 | Research sweeps across web, docs, and internal sources | 5 | Later |
| 55 | Competitive intelligence missions | 5 | Later |
| 56 | Codebase debugging missions | 5 | Later |
| 57 | PR review and bug-fix missions | 5 | Later |
| 58 | Test generation and verification missions | 5 | Later |
| 59 | Incident command mode | 6 | Later |
| 60 | War-room mode | 6 | Later |
| 61 | Personal chief-of-staff mode | 6 | Future |
| 62 | Founder dashboard for priorities / risks / leverage | 6 | Later |
| 63 | Revenue pulse | 5 | Later |
| 64 | Cost control board for AI spend and labor savings | 1 | Now |
| 65 | Automation ROI board | 4 | Later |
| 66 | “What should I do next?” command briefing | 6 | Later |
| 67 | “What can I automate next?” recommendation engine | 4 | Later |
| 68 | Memory engine for successful mission patterns | 3 | Later |
| 69 | Memory recall by domain / project / person / task type | 3 | Later |
| 70 | Adaptive doctrine that updates preferred routes | 4 | Now |
| 71 | Bug pattern detector across repeated failures | 4 | Later |
| 72 | Drift detection for underperforming models | 4 | Later |
| 73 | Approval friction detector | 4 | Later |
| 74 | System health detector for integrations | 4 | Later |
| 75 | Mission postmortem generator | 4 | Later |
| 76 | Daily executive briefing | 6 | Later |
| 77 | Weekly strategy brief | 6 | Later |
| 78 | Monthly operating review | 6 | Later |
| 79 | Personal finance brief with controlled permissions | 5 | Future |
| 80 | Personal life admin mission lane | 5 | Future |
| 81 | Travel / scheduling orchestration | 5 | Future |
| 82 | Vendor / subscription management | 5 | Future |
| 83 | Autonomous research notebook | 3 | Later |
| 84 | Decision memo generator | 5 | Later |
| 85 | Scenario simulation for strategic choices | 6 | Future |
| 86 | “Maximize speed” mode | 1 | Later |
| 87 | “Minimize cost” mode | 1 | Later |
| 88 | “Minimize risk” mode | 1 | Later |
| 89 | Voice-command support | 6 | Future |
| 90 | Conversational interruption / redirection | 6 | Later |
| 91 | Explainability panel for model / tool / agent choice | 6 | Now |
| 92 | Human override on any mission step | 2 | Now |
| 93 | Full audit trail for every decision and tool call | 0 | Now |
| 94 | Secure secrets vault integration | 0 | Now |
| 95 | Personal operating manual learned by Commander | 3 | Future |
| 96 | Relationship memory for people and collaborators | 5 | Future |
| 97 | Multi-workspace switching with one commander identity | 6 | Later |
| 98 | Executive cockpit UI with cinematic telemetry | 1 | Now |
| 99 | One-screen all-systems bridge mode | 6 | Later |
| 100 | Continuous improvement loop | 4 | Now |

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

## Future Summary

The following are intentionally delayed until the execution core is trustworthy:

- personal finance authority
- personal life admin
- travel orchestration
- relationship memory
- voice-first interaction
- scenario simulation
- stealth / privacy special modes beyond base controls
