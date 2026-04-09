# Supabase Sync Playbook

Use this playbook any time the Command Center needs to sync new real-state work into Supabase.

## Project

- Supabase project ref: `bqlmkaapurfxdmqcuvla`

## Rule

- If data appears in shell badges, Mission Control, Reports, Intelligence, Notifications, Settings, Profile, or Mission Creator, it must come from real Supabase-backed state or a clean empty state.
- Do not restore mock telemetry or `localStorage`-only command behavior for live operational data.

## Sync Order

1. Inspect the migration files under [`/Users/Jjarvis/ai-command-center/supabase/migrations`](/Users/Jjarvis/ai-command-center/supabase/migrations).
2. Link the repo if needed:
   - `supabase link --project-ref bqlmkaapurfxdmqcuvla`
3. If remote migration history drifts, repair only the exact known versions before pushing:
   - `005`
   - `006`
   - `20260409011000`
   - `20260409053000`
4. Push migrations:
   - `supabase db push --include-all`
5. Verify the new tables/columns exist in Supabase.
6. Reload the app and run the truth audit checklist in the UI.

## Current Real-State Tables

- `connected_systems`
- `knowledge_namespaces`
- `shared_directives`
- `system_recommendations`
- `learning_memory`
- `learning_memory_history`
- expanded `user_settings`
- expanded `tasks`

## Truth Audit Targets

These values should match across the app:

- commander identity
- pending approvals
- active missions
- blocked missions
- connected systems count
- critical alert count
- route posture
- trust doctrine
- doctrine / intelligence counts

## Clean Empty-State Rule

If a real source is missing:

- show a clean empty state
- do not show placeholder telemetry
- do not fallback to `staticCatalog` for live operational views

## Remaining Static Cleanup Watchlist

Before calling the app fully real-data clean, re-check:

- [`/Users/Jjarvis/ai-command-center/src/lib/api.js`](/Users/Jjarvis/ai-command-center/src/lib/api.js)
- [`/Users/Jjarvis/ai-command-center/src/components/detail/SkillsTab.jsx`](/Users/Jjarvis/ai-command-center/src/components/detail/SkillsTab.jsx)
- [`/Users/Jjarvis/ai-command-center/active/archive/legacy-ui/staticCatalog.js`](/Users/Jjarvis/ai-command-center/active/archive/legacy-ui/staticCatalog.js)

## Final Verification

- run `npm run build`
- run targeted `eslint` on changed files
- open the truth-audit playbook in the UI
- confirm shell, profile, notifications, mission control, reports, and intelligence show the same numbers
