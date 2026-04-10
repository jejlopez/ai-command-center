# Commander Roadmap Pack

This folder turns the Jarvis / Stark / Musk commander vision into repo-tracked operating artifacts.

## Files

- [`commander_epic_scope.md`](/Users/Jjarvis/ai-command-center/active/roadmap/commander_epic_scope.md)
  Epic scope, phase plan, and top-20 must-have release checklist.
- [`commander_feature_matrix.md`](/Users/Jjarvis/ai-command-center/active/roadmap/commander_feature_matrix.md)
  100-feature matrix mapped to phase and implementation priority.
- [`commander_progress_board.md`](/Users/Jjarvis/ai-command-center/active/roadmap/commander_progress_board.md)
  Current shipped / in-progress / next / later view of the Jarvis buildout.
- [`commander_cleanup_backlog.md`](/Users/Jjarvis/ai-command-center/active/roadmap/commander_cleanup_backlog.md)
  Required-before-scale cleanup backlog tied to current repo files and concepts.
- [`commander_architecture_schema.md`](/Users/Jjarvis/ai-command-center/active/roadmap/commander_architecture_schema.md)
  Canonical schemas and architecture rules for commander roles, routing doctrine, mission graph, capability graph, and domain rollout.

## Usage

- Treat `commander_epic_scope.md` as the north-star roadmap.
- Treat `commander_feature_matrix.md` as the scope ledger.
- Treat `commander_progress_board.md` as the live execution tracker.
- Treat `commander_cleanup_backlog.md` as the foundation gate before deeper automation.
- Treat `commander_architecture_schema.md` as the contract for future implementation work.

## Autodrive

When the user wants the Commander roadmap pushed forward continuously:

- treat `commander_progress_board.md` as the source of truth for the next build slice
- prefer the highest-leverage `Next` item that does not require a product-risk decision
- keep changes focused, reversible, and phase-aligned
- update the progress board after each meaningful slice so roadmap state stays truthful
