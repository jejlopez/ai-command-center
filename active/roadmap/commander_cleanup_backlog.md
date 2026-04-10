# Commander Cleanup Backlog

This backlog is the required-before-scale foundation work for the Jarvis roadmap.

## Priority Labels

- `P0`: block deeper architecture work until fixed
- `P1`: should be cleaned during early implementation
- `P2`: nice cleanup but not blocking

## P0: Commander Canonicalization

### 1. Separate Commander Roles Cleanly

- Problem:
  Commander currently appears as UI identity, fallback bootstrap, and execution authority across multiple layers.
- Current files:
  - [`/Users/Jjarvis/ai-command-center/src/utils/useSupabase.js`](/Users/Jjarvis/ai-command-center/src/utils/useSupabase.js)
  - [`/Users/Jjarvis/ai-command-center/src/lib/api.js`](/Users/Jjarvis/ai-command-center/src/lib/api.js)
- Required outcome:
  - one canonical commander engine contract
  - explicit fallback status
  - no duplicated bootstrap logic

### 2. Remove Hardcoded Default Model Assumptions

- Problem:
  commander bootstrap is pinned to `Claude Opus 4.6` in multiple places.
- Current files:
  - [`/Users/Jjarvis/ai-command-center/src/utils/useSupabase.js`](/Users/Jjarvis/ai-command-center/src/utils/useSupabase.js)
  - [`/Users/Jjarvis/ai-command-center/src/lib/api.js`](/Users/Jjarvis/ai-command-center/src/lib/api.js)
  - [`/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx`](/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx)
- Required outcome:
  - default commander lane comes from policy
  - provider normalization is centralized

### 3. Promote Missions Above Plain Tasks

- Problem:
  `tasks` currently mixes mission, execution state, scheduling, and dispatch semantics.
- Current files:
  - [`/Users/Jjarvis/ai-command-center/src/lib/api.js`](/Users/Jjarvis/ai-command-center/src/lib/api.js)
  - [`/Users/Jjarvis/ai-command-center/src/components/mission/MissionCreatorPanel.jsx`](/Users/Jjarvis/ai-command-center/src/components/mission/MissionCreatorPanel.jsx)
  - [`/Users/Jjarvis/ai-command-center/supabase/migrations/20260409011000_mission_creator_tasks.sql`](/Users/Jjarvis/ai-command-center/supabase/migrations/20260409011000_mission_creator_tasks.sql)
- Required outcome:
  - one mission lifecycle
  - parent / child graph semantics
  - explicit review / blocked / planned states

## P0: Routing and Capability Clarity

### 4. Unify Routing Policy Ownership

- Problem:
  model/provider choice is still spread across heuristics, UI labels, and bootstrap helpers.
- Current files:
  - [`/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx`](/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx)
  - [`/Users/Jjarvis/ai-command-center/src/components/CreateAgentModal.jsx`](/Users/Jjarvis/ai-command-center/src/components/CreateAgentModal.jsx)
  - [`/Users/Jjarvis/ai-command-center/src/components/detail/ConfigTab.jsx`](/Users/Jjarvis/ai-command-center/src/components/detail/ConfigTab.jsx)
  - [`/Users/Jjarvis/ai-command-center/src/lib/api.js`](/Users/Jjarvis/ai-command-center/src/lib/api.js)
- Required outcome:
  - one routing doctrine source
  - one provider taxonomy
  - one fallback order

### 5. Evolve Connected Systems Into A Capability Graph

- Problem:
  connected systems are still mostly integration cards, not mission-usable capability objects.
- Current files:
  - [`/Users/Jjarvis/ai-command-center/src/components/SettingsPanel.jsx`](/Users/Jjarvis/ai-command-center/src/components/SettingsPanel.jsx)
  - [`/Users/Jjarvis/ai-command-center/src/utils/useSupabase.js`](/Users/Jjarvis/ai-command-center/src/utils/useSupabase.js)
  - [`/Users/Jjarvis/ai-command-center/supabase/migrations/20260409133000_command_center_sync.sql`](/Users/Jjarvis/ai-command-center/supabase/migrations/20260409133000_command_center_sync.sql)
- Required outcome:
  - capability metadata
  - trust / risk / read-write classification
  - domain mapping

## P1: Intelligence Semantics

### 6. Normalize Memory vs Directive vs Recommendation vs Doctrine

- Problem:
  the app has the right primitives but they are not yet a clean operating model.
- Current files:
  - [`/Users/Jjarvis/ai-command-center/src/utils/useCommandCenterTruth.js`](/Users/Jjarvis/ai-command-center/src/utils/useCommandCenterTruth.js)
  - [`/Users/Jjarvis/ai-command-center/src/utils/useSupabase.js`](/Users/Jjarvis/ai-command-center/src/utils/useSupabase.js)
  - [`/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx`](/Users/Jjarvis/ai-command-center/src/views/IntelligenceView.jsx)
- Required outcome:
  - memory = learned context
  - directive = stable rule
  - recommendation = proposed change
  - doctrine = active operating policy

### 7. Normalize Alerting vs Readiness vs Intervention

- Problem:
  truth audit, alerts, tactical interventions, and readiness all exist, but the semantic boundaries need to be crisp.
- Current files:
  - [`/Users/Jjarvis/ai-command-center/src/utils/useDerivedAlerts.js`](/Users/Jjarvis/ai-command-center/src/utils/useDerivedAlerts.js)
  - [`/Users/Jjarvis/ai-command-center/src/components/command/TruthAuditStrip.jsx`](/Users/Jjarvis/ai-command-center/src/components/command/TruthAuditStrip.jsx)
  - [`/Users/Jjarvis/ai-command-center/src/components/command/TacticalInterventionConsole.jsx`](/Users/Jjarvis/ai-command-center/src/components/command/TacticalInterventionConsole.jsx)
- Required outcome:
  - alerts = attention bus
  - readiness = go / caution / block posture
  - intervention = recommended operator actions

## P1: UI Responsibility Lock

### 8. Freeze Surface Ownership

- Problem:
  the new bridge surfaces are strong, but future work could easily duplicate responsibilities.
- Required roles:
  - `Overview`: executive bridge
  - `Mission Control`: live execution + intervention
  - `Intelligence`: routing, doctrine, memory, models
  - `Reports`: ROI, performance, trend review
  - `Settings`: policy, integrations, security

### 9. Retire Residual Legacy Concept Drift

- Problem:
  the repo still carries legacy UI and concept drift from prior mockup phases.
- Current files:
  - [`/Users/Jjarvis/ai-command-center/active/archive/legacy-ui/README.md`](/Users/Jjarvis/ai-command-center/active/archive/legacy-ui/README.md)
  - [`/Users/Jjarvis/ai-command-center/active/archive/legacy-ui/staticCatalog.js`](/Users/Jjarvis/ai-command-center/active/archive/legacy-ui/staticCatalog.js)
  - watchlist in [`/Users/Jjarvis/ai-command-center/active/verification/supabase_sync_playbook.md`](/Users/Jjarvis/ai-command-center/active/verification/supabase_sync_playbook.md)
- Required outcome:
  - no live path uses legacy mock assumptions
  - archive remains reference-only

## P1: Token-Economy Strategy

### 10. Centralize Token Discipline Policy

- Problem:
  the product talks about cost and local-vs-premium lanes, but there is no one canonical policy layer.
- Required outcome:
  - classify with local/small first where possible
  - escalate to premium only when justified
  - summarize before expensive handoff
  - choose parallelization only when it materially improves throughput
  - long-context usage requires explicit evidence or retrieval rationale

## P2: Naming and UX Polish

### 11. Normalize Terminology

- Align these words across product and docs:
  - task
  - mission
  - lane
  - route
  - capability
  - doctrine
  - specialist
  - connected system

### 12. Create Implementation Checklists For Each Phase

- Add checklists before execution begins for:
  - schema
  - API layer
  - UI surfaces
  - verification
  - rollout constraints
