# Agent UI Refresh Context

## Objective

Capture the current agent create/edit architecture after the latest `origin/main` merges so the next UI pass can start from context instead of re-inspecting the codebase.

## Current Branch State

- Working branch: `codex/agent-configuration`
- Latest `origin/main` was merged into this branch.
- In-progress agent UI experiments are not in the working tree right now.
- Those experiments are parked in git stash:
  - `stash@{0}`: `wip-before-main-refresh-agent-ui`

## Entry Points

- The global app opens agent detail workspaces from [src/App.jsx](/Users/ladyadelaide/AI/Dashboard/src/App.jsx).
  - `openAgentWorkspace(agentId, options)` sets `detailState`.
  - `DetailPanel` is rendered when `selectedAgent` exists.
  - `mode` defaults to `setup`, but can also open in `dispatch`.

- `Add Operator` is currently launched from two main places:
  - [src/components/overview/CommandSquadPanel.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/overview/CommandSquadPanel.jsx)
    - `OpenSlotCard`
    - header action button
  - [src/views/FleetOperationsView.jsx](/Users/ladyadelaide/AI/Dashboard/src/views/FleetOperationsView.jsx)
    - `Deploy Agent` button

## Detail Drawer Structure

- The right-side agent workspace lives in [src/components/DetailPanel.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/DetailPanel.jsx).
- Current tabs are:
  - `Setup`
  - `Metrics`
  - `Logs`
- Current header behavior:
  - top identity chrome shows `id`, `status`, `role`, `name`, `model`, `latency`
  - actions shown: `Dispatch`, `Restart`, `Pause/Resume`, kebab menu, `Close`
- Important note:
  - `Pause/Resume` is still visual chrome only
  - kebab menu actions are also not wired to real behavior
  - `Dispatch`, `Restart`, close, tab switching, and log mode switching are real

## Current Create UI

- Create flow lives in [src/components/CreateAgentModal.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/CreateAgentModal.jsx).
- This is currently the older, self-contained version from `main`, not the stashed redesign draft.
- It defines local UI primitives inline:
  - `SectionShell`
  - `SummaryChip`
  - `SegmentedControl`
  - `CapabilityBadge`
- Main sections:
  - top summary slab
  - `Identity`
  - `Runtime`
  - `Behavior`
  - `Instructions`
- Current runtime UX:
  - provider filter uses `selectedProvider`
  - models come from `useModelBank()`
  - user can add a model directly inside the same section
- Current shortcomings:
  - top summary slab competes with the actual identity form
  - runtime uses provider as a filter, not a first-class guided choice
  - model bank creation is visually equal to runtime selection instead of being a secondary path

## Current Edit UI

- Edit flow lives in [src/components/detail/SetupTab.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/detail/SetupTab.jsx).
- Current sections:
  - top summary slab
  - `Runtime`
  - `Behavior`
  - `Instructions`
  - `Capabilities`
- This file still imports shared setup primitives from [src/components/agents/AgentSetupPrimitives.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/agents/AgentSetupPrimitives.jsx), but the live layout is still heavy and repetitive.
- Current runtime UX:
  - provider segmented filter
  - model card grid
  - inline model-bank expansion area
- Current capabilities UX:
  - skills and MCP management both live here
  - attach/remove/create skills is already persisted
  - MCP list/create/delete is already persisted
- Current shortcomings:
  - top setup summary repeats data already shown in `DetailPanel`
  - runtime information is repeated too many times
  - large decorative shells push real controls down in a narrow drawer

## Provider / Model Display Patterns Already In Repo

- [src/components/overview/CommandSquadPanel.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/overview/CommandSquadPanel.jsx)
  - already separates provider from model in operator cards
  - shows:
    - provider line
    - model key line
- [src/components/overview/CommanderHero.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/overview/CommanderHero.jsx)
  - already uses a strong two-part runtime slab:
    - provider
    - model
- This means the next create/edit pass should align with those patterns instead of inventing a third runtime presentation language.

## Supabase Data Hooks Relevant To Agent UI

- All of these live in [src/utils/useSupabase.js](/Users/ladyadelaide/AI/Dashboard/src/utils/useSupabase.js).

### Model Bank

- `useModelBank()`
  - reads `model_bank`
  - returns `models`, `loading`, `refetch`
- `mapModelFromDb(row)`
  - normalized shape:
    - `id`
    - `modelKey`
    - `label`
    - `provider`
    - `costPer1k`
- `createModelBankEntry(modelData)`
  - already supports:
    - `label`
    - `modelKey`
    - `provider`
    - `costPer1k`

### Agent Persistence

- `createAgent(agentData)`
- `updateAgentConfig(agentId, patch)`
- `updateAgentSkills(agentId, skills)`

### MCP Persistence

- `useMcpServers()`
- `createMcpServer(serverData)`
- `deleteMcpServer(serverId)`
- MCP rows are mapped through `mapMcpServerFromDb(row)`

## New `main` Data Context That May Matter Later

- `main` added more command-center data helpers in [src/utils/useSupabase.js](/Users/ladyadelaide/AI/Dashboard/src/utils/useSupabase.js):
  - `useConnectedSystems()`
  - `useKnowledgeNamespaces()`
  - `useSharedDirectives()`
  - `useSystemRecommendations()`
- Merge conflict was resolved by keeping both:
  - agent-config MCP helpers
  - new command-center mapper helpers
- This matters because agent setup may eventually want to align with `connected_systems`, not only `mcp_servers`, depending on product direction.

## Design Readbacks From Inspection

- `DetailPanel` header already does identity work well enough that `SetupTab` should not open with another large identity summary.
- The strongest repo screens right now use:
  - one clear header/hero
  - one runtime slab
  - tighter stacked editing surfaces
- The current create/edit agent flows still feel more like mini dashboards than editing tools.

## Best Next UI Direction

- Treat provider as the first runtime choice and model as the second.
- Reuse the provider/model slab language already present in `CommanderHero` and `CommandSquadPanel`.
- Remove repeated summary slabs from `SetupTab`.
- Make `Runtime` the first edit section in `Setup`.
- Demote “add model to bank” into a disclosure or secondary composer.
- Strip fake actions from `DetailPanel` header unless they are wired for real behavior.
- Keep `Logs` operationally separate.
- Reconsider whether `Metrics` deserves a dedicated tab or should become inline readback later.

## Files Most Relevant For The Next Pass

- [src/App.jsx](/Users/ladyadelaide/AI/Dashboard/src/App.jsx)
- [src/components/DetailPanel.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/DetailPanel.jsx)
- [src/components/CreateAgentModal.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/CreateAgentModal.jsx)
- [src/components/detail/SetupTab.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/detail/SetupTab.jsx)
- [src/components/overview/CommandSquadPanel.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/overview/CommandSquadPanel.jsx)
- [src/components/overview/CommanderHero.jsx](/Users/ladyadelaide/AI/Dashboard/src/components/overview/CommanderHero.jsx)
- [src/utils/useSupabase.js](/Users/ladyadelaide/AI/Dashboard/src/utils/useSupabase.js)

## Notes

- This note is intentionally transient and belongs in `active/`, not `AGENTS.md`.
- If the next step is to revive the earlier UI draft, inspect the stash first and reapply selectively rather than popping the whole stash blindly.
