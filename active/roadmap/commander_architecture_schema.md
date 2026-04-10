# Commander Architecture Schema

This document defines the canonical shape for the next implementation layers.

## 1. Commander Roles

Commander is split into three explicit concepts:

### A. Commander Identity

Purpose:
- human-facing persona
- visible across Overview, Profile, Mission Control, Notifications

Fields:
- `id`
- `display_name`
- `persona`
- `command_style`
- `default_routing_policy_id`
- `trust_profile_id`

### B. Commander Engine

Purpose:
- classify tasks
- choose routes
- decompose missions
- create and supervise subtask graph

Fields:
- `engine_id`
- `identity_id`
- `status`
- `routing_policy_id`
- `approval_policy_id`
- `fallback_policy_id`
- `memory_policy_id`
- `capability_scope`

### C. Commander Fallback

Purpose:
- explicit degraded mode when a persistent commander row is unavailable

Rules:
- only used for bootstrap or fail-safe continuity
- clearly marked in UI
- may classify and plan
- should not silently become the permanent execution authority

## 2. Routing Doctrine Schema

Suggested object:

```json
{
  "id": "routing_policy_default",
  "task_pattern": {
    "domain": "engineering",
    "intent_type": "debug",
    "risk_level": "medium",
    "latency_class": "normal",
    "budget_class": "balanced"
  },
  "preferred_lane": {
    "model_family": "openai|anthropic|google|ollama|custom",
    "model_key": "gpt-5.4-mini",
    "agent_role": "builder"
  },
  "fallback_order": [
    { "model_key": "qwen3-coder", "agent_role": "builder" },
    { "model_key": "gpt-5.4", "agent_role": "verifier" }
  ],
  "approval_rule": "risk_weighted",
  "context_policy": "minimal_relevant",
  "parallelization_policy": "allowed_if_independent",
  "evidence_requirement": false,
  "active": true
}
```

Required responsibilities:

- own model selection
- own local vs cloud preference
- own escalation rules
- own fallback order
- own approval posture

## 3. Mission Graph Schema

Mission lifecycle states:

- `intake`
- `planned`
- `ready`
- `running`
- `waiting_on_human`
- `blocked`
- `completed`
- `failed`
- `cancelled`

Suggested mission node:

```json
{
  "id": "mission_123",
  "parent_id": null,
  "root_mission_id": "mission_123",
  "node_type": "mission",
  "title": "Debug failing auth callback",
  "domain": "engineering",
  "intent_type": "debug",
  "status": "planned",
  "assigned_agent_role": "planner",
  "selected_model": "gpt-5.4-mini",
  "routing_policy_id": "routing_policy_default",
  "routing_reason": "debug task with medium risk and moderate context",
  "context_pack_ids": ["repo_auth", "recent_failures"],
  "required_capabilities": ["repo_read", "test_runner"],
  "approval_level": "review_if_external_or_destructive",
  "estimated_cost_cents": 45,
  "estimated_duration_ms": 180000,
  "depends_on": [],
  "created_by_commander_id": "commander_main"
}
```

Child nodes represent:

- plan step
- research subtask
- implementation subtask
- verification subtask
- external action

Rules:

- every child inherits `root_mission_id`
- child nodes must declare dependencies explicitly
- parent success is not final until required child nodes are complete
- external-write nodes must declare approval posture

## 4. Connected System Capability Schema

Connected systems should evolve from “integration cards” into typed capabilities.

Suggested shape:

```json
{
  "integration_key": "gmail",
  "display_name": "Gmail",
  "domain": "comms",
  "status": "connected",
  "trust_level": "medium",
  "risk_level": "high_if_write",
  "capabilities": [
    {
      "id": "gmail.read_threads",
      "mode": "read",
      "mission_types": ["inbox_triage", "research", "follow_up"]
    },
    {
      "id": "gmail.create_draft",
      "mode": "write",
      "mission_types": ["draft_email", "outreach"],
      "requires_approval": true
    }
  ],
  "credential_state": "present",
  "health_state": "healthy",
  "permission_scope": ["read", "draft"],
  "last_verified_at": "2026-04-09T18:00:00Z"
}
```

This separates:

- credential presence
- health
- permission scope
- usable actions

## 5. Doctrine / Memory / Recommendation Semantics

### Doctrine

- active operating policy
- directly influences routing or approvals
- versioned

### Directive

- stable rule or standing instruction
- human-authored or confirmed
- not inferred automatically unless explicitly promoted

### Recommendation

- proposed change based on observed outcomes
- not active until promoted

### Memory

- learned context or history
- may inform routing, but does not enforce policy by itself

Promotion path:

`memory or outcome -> recommendation -> reviewed directive or doctrine update`

## 6. Domain Pack Rollout Order

### Pack 1: Build

- repo analysis
- debugging
- code review
- test generation
- migrations and safe ops checks

### Pack 2: Research

- web research
- internal doc synthesis
- decision memo generation

### Pack 3: CRM / Comms

- Pipedrive
- Slack
- Gmail drafts
- follow-up notes and reminders

### Pack 4: Ops

- recurring checks
- status reviews
- operational reporting

### Pack 5: Money

- Stripe first
- accounting or bank connectors later
- always stronger approval posture

### Pack 6: Personal

- calendar
- reminders
- travel
- life admin

## 7. Page Responsibility Contract

- `Overview`
  - executive bridge
  - readiness, autonomy, launch posture, top actions
- `Mission Control`
  - active execution graph
  - approvals
  - intervention console
- `Intelligence`
  - routing doctrine
  - model strategy
  - memory and recommendations
- `Reports`
  - ROI, trends, spend, performance
- `Settings`
  - policy, integration, security, capability management

No new screen should duplicate a responsibility already owned here without a strong reason.
