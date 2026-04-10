# AGENTS.md — Codex Operating System

This file defines how Codex should work in this repository.

## Objective

Ship focused, low-risk changes quickly while conserving tokens, protecting stable behavior, and maintaining clear quality control.

## Core Rules

1. Inspect before changing.
2. For non-trivial work, give a short plan before editing.
3. Prefer the smallest useful change first.
4. Ask before major refactors, dependency changes, schema changes, or structural rewrites.
5. Do not let multiple agents edit the same file at the same time.
6. Surface blockers early.
7. Optimize every response for speed, clarity, and token efficiency.
8. Do not merge or open a PR unless the user asks.

## Thematic Materiality & Variable Protocol (MANDATORY)

To ensure high-fidelity support for both **Obsidian Dark** and **Aurora Light** themes, all agents MUST adhere to the following styling rules:

1. **Zero Hardcoded Colors**: Never use HEX codes (`bg-[#0A0A0A]`) or static Tailwind overrides for backgrounds, borders, or text colors.
2. **Semantic Variables**: Always use the system’s CSS variables. 
   - Backgrounds: `var(--color-canvas)` or `var(--color-panel)`
   - Borders: `var(--color-hairline)`
   - Text: `var(--color-text)` or `var(--color-text-dim)`
3. **Glassmorphism**: Use `backdrop-blur` with variable-based background opacities. Do not hardcode `bg-white/5` as it is invisible in light mode.
4. **Elevation**: Use standardized shadows (`shadow-xl`) to define depth, especially in light themes where dark gradients are ineffective.

## Default Working Style

- Be concise, direct, and action-oriented.
- Use bullets over long paragraphs.
- Inspect relevant files first, not the whole repo.
- For small tasks, act after quick inspection.
- For larger tasks, separate planner, builder, and verifier responsibilities.
- Return: objective, plan, files involved, risks, next action.
- When context gets too large, provide a compact handoff instead of re-sending full history.

### Agent Fleet (Antigravity/Hermes)

This project uses a specialized multi-agent fleet for end-to-end orchestration:

- **Manager (`manager-claude`):** Primary agent using **Claude Opus**. Responsible for planning, high-level reasoning, and directing workers.
- **Alternative Manager (`manager-gpt`):** Fallback agent using **GPT 5.4**. Use this if Claude capacity is exhausted.
- **UI Worker (`worker-ui`):** Specialized **Gemini 3 Flash** agent for frontend construction, styling, and UI components.
- **Backend Worker (`worker-coder`):** Specialized **OpenAI Codex** agent for API design, business logic, and database management.
- **Local Worker (`worker-local`):** Specialized **Ollama (Qwen)** agent for small tasks, testing, and formatting.

#### Orchestration Rule
All complex tasks in this repository should be initiated via the **`manager-claude`** profile. The manager is instructed to delegate UI tasks to `worker-ui` and backend tasks to `worker-coder` by default.

### Local Ollama models

Use Ollama only when the task is low-risk, self-contained, and easy to verify.

- Good fits:
  - boilerplate generation
  - first-pass component scaffolds
  - test skeletons
  - code summarization
  - log triage
  - classification and extraction
  - alternative implementation drafts
- Avoid Ollama for:
  - final architectural decisions
  - auth, security, RLS, secrets, migrations, and production data flow
  - critical bug fixes
  - broad refactors
  - final merge readiness decisions

### Ollama policy

- The manager model stays in charge.
- Ollama outputs are drafts until verified.
- Give Ollama a single clear deliverable and strict file ownership.
- Pick local models by task type and machine limits, not by hype.
- If Ollama is unavailable or unstable, fall back to cloud workers without blocking the task.

### Local machine profile

This workspace is currently being used on:

- Apple Mac mini
- Apple M4
- 16 GB unified memory
- 10-core GPU
- macOS 26.2

### Local model fit for this machine

Treat this as a 16 GB local-first machine. The goal is to let local models handle as much execution work as possible, then use paid models only when local quality, speed, or reliability is not good enough.

### Preferred structure

- Paid manager:
  - planning
  - architecture
  - task routing
  - final consistency review
  - integration fixes only when local workers are not enough
- Local workers:
  - frontend implementation drafts
  - backend implementation drafts
  - test generation
  - refactors with strict file ownership
  - summarization, extraction, classification, and log triage

### Local-first policy

- Start with the best local model for the specific subtask.
- Keep prompts short and scoped for local workers.
- Use paid models only for:
  - ambiguous planning
  - high-risk code paths
  - security or auth decisions
  - final review when local verification is not trustworthy enough
  - recovery when local workers fail twice or drift off-task

### Best local fits on this Mac

- Coding worker:
  - `qwen3-coder` if available in a small or mid-size variant that runs cleanly
  - `devstral` only if latency is acceptable in practice
- Reasoning worker:
  - `gemma4:e4b`
  - small or mid-size `deepseek-r1`
  - mid-size `qwen3`
- Utility worker:
  - `gemma4:e2b`
  - `gemma3:4b`
  - smaller `qwen3` variants

### Gemma 4 guidance for this machine

- Recommended to download:
  - `gemma4:e4b`
- Optional:
  - `gemma4:e2b` for lighter utility work
- Not recommended as a default on this Mac:
  - `gemma4:26b`
  - `gemma4:31b`

Reasoning:

- Ollama lists `gemma4:e4b` at about 9.6 GB and positions it as an edge model suitable for local execution.
- Ollama lists `gemma4:26b` at about 18 GB and `gemma4:31b` at about 20 GB, which is a poor default fit for a 16 GB unified-memory Mac.
- For your use case, `gemma4:e4b` is the best Gemma 4 starting point because it preserves local-first execution without pushing the machine into swap-heavy behavior.

### Gemma 4 use cases

Use `gemma4:e4b` as a local reasoning and review worker.

- Good use cases:
  - first-pass reasoning on a scoped bug or feature
  - diff review before using a paid final reviewer
  - test-plan generation
  - edge-case brainstorming
  - codebase summarization for a single folder or a few files
  - log triage and incident summarization
  - turning rough notes into a compact handoff
  - classifying work into frontend, backend, test, or review lanes
  - image-aware review tasks if local multimodal support is needed later
- Prompt style:
  - keep prompts short
  - give one concrete deliverable
  - provide only the relevant files or diff
  - ask for bullets, not essays
  - require explicit risks and unknowns
- Do not use `gemma4:e4b` as:
  - the main coding specialist
  - the final authority for architecture
  - the only reviewer for risky changes
  - the decision-maker for auth, security, RLS, migrations, or production-critical fixes
- Working pattern:
  - local Gemma 4 reviews or reasons first
  - a local coding worker implements
  - the paid manager only steps in for escalation, integration judgment, or final QA

### Avoid by default on this machine

- large dense models
- large MoE models unless proven stable
- any model that causes swap, UI lag, or long warm-up times
- any local model used as the sole final reviewer for risky changes

### Neutral local model shortlist

- Coding-first:
  - `qwen3-coder`
  - `qwen3-coder-next`
  - `devstral`
- Reasoning-first:
  - `gpt-oss`
  - `deepseek-r1`
- General-purpose:
  - `qwen3`
  - `gemma3`

### Selection rule for this machine

- Prefer the smallest variant that can finish the task reliably.
- Default to small or mid-size local models on this Mac.
- Use local models for most worker tasks first.
- Keep paid models in a manager role by default.
- Escalate to paid models only when the local result is unclear, too slow, too weak, or too risky to trust.
- Never spend paid-model tokens on routine boilerplate, first-pass scaffolds, simple tests, or repo summarization if a local model can do it well enough.
- Keep final review, risky edits, and architecture decisions on stronger paid models unless a local model has already proven reliable for that exact job.

## Agent Roles

### Planner

- Owns task breakdown, architecture, risk review, and file ownership.
- Decides whether subagents are worth the overhead.
- Keeps plans short.

### Builder

- Implements only the assigned change.
- Touches only owned files.
- Avoids side quests.

### Verifier

- Reviews correctness, imports, tests, edge cases, and output quality.
- Checks that the result matches the requested scope.
- Flags blockers or residual risk clearly.

## Delegation Rules

- **Default Orchestrator:** Use the `@manager-claude` profile for all non-trivial tasks.
- **Specialization Routing:**
    - Delegate **Frontend/UI** work to `@worker-ui`.
    - Delegate **Backend/Logic** work to `@worker-coder`.
    - Delegate **Tests/Documentation** work to `@worker-local`.
- Do not spawn agents for simple or tightly coupled edits.

## Token Efficiency Rules

- Read only what is needed. Use targeted search first.
- Prefer `rg`/`sed`/focused reads over opening entire large files.
- Batch related edits before running verification.
- Do one meaningful verification pass per coherent change, not after every tiny edit.
- Do not restate repo context that is already established.
- Do not re-read files immediately after writing unless needed for verification.
- Keep plans compact. Skip heavyweight planning for routine work.
- Use compact handoff summaries when context starts bloating.

## Quality Control

Run the lightest verification that still meaningfully reduces risk.

### Minimum bar

- confirm the changed files match the request
- check imports and obvious runtime breakage
- note anything not verified

### Stronger verification required for

- state management changes
- data flow changes
- Supabase logic
- routing
- auth
- new components with behavior
- anything user-facing that could regress workflow

### Verification order

1. Static inspection
2. Targeted lint/build/test command if available
3. Reviewer pass for medium or high-risk changes
4. User-facing summary of risks and what was or was not checked

## Project Workflow

- Inspect relevant files before coding.
- For non-trivial work, propose a short plan first.
- Keep changes focused and low-risk.
- Ask before adding dependencies or changing architecture.
- If the codebase is messy, create order first, then propose the smallest high-impact improvement.

## Git Workflow

- Do not work on `main`.
- Start from the current feature branch unless the user asks for a fresh branch.
- Create a dedicated feature branch for substantial tasks when practical.
- Commit clearly when the work is ready.
- Do not push, open a PR, merge, or return to `main` unless the user asks.

## Repo Notes

- Stack: React 19, Vite, Tailwind CSS 3, Framer Motion, Recharts, Supabase.
- Dev command: `npm run dev`
- Build command: `npm run build`
- Lint command: `npm run lint`
- Test command: not currently defined in `package.json`
- Main folders: `src`, `public`, `supabase`, `active`

## Agent Platform & Authentication

- **Fleet Environment**: All agent profiles and credentials are managed via **Hermes** at `~/.hermes/`.
- **API Keys**: Shared project files (`.env`) should NOT contain LLM provider keys. Each collaborator must document their personal `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in their global `~/.hermes/.env` file.
- **Local Fleet**: Workers utilize **Ollama** for reasoning. While documentation recommends specific "ideal" models (e.g., `qwen3`), local variants (e.g., `qwen2.5-coder`) are acceptable for development.

## Supabase Sync Memory

- Command Center real-state sync should follow [`./active/verification/supabase_sync_playbook.md`](./active/verification/supabase_sync_playbook.md).
- Live operational surfaces must prefer real Supabase-backed state or clean empty states.
- Do not reintroduce `staticCatalog` as the live source for command truth.
- After schema changes, run the truth audit in the UI and verify matching values across shell, profile, notifications, mission control, reports, and intelligence.

## Operational Workflows

### 🚀 Starting a New Feature
To ensure the fleet is correctly commissioned for a new feature build, use one of the following triggers. Note that these commands require a **clean git workspace** and will automatically create a new **`feature/`** branch.

1. **Terminal (Global context)**: Run this from the project root.
   ```bash
   npm run start-feature -- "Feature Name"
   ```

2. **Hermes Chat (Slash command)**: Use this in any Antigravity or Hermes chat turn. It is now a native Skill in your **`/`** menu.
   ```text
   /start-feature "Feature Name"
   ```

This trigger automatically:
- **Phase 0: Requirement Synthesis**: The agent stops and asks the user for the feature's core objectives, visual preferences, and functional edge cases.
- **Phase 0.5: Workspace Guard**: If uncommitted changes exist, Jarvis proactively offers to **Commit (WIP)**, **Move**, or **Stash** them to preserve developer flow.
- **Clean Check**: Once workspace safety is confirmed (by the user's choice), proceed.
- **Branch Creation**: Create and checkout a git-safe `feature/` branch.
- **Manager-GPT**: Invoke the lead orchestrator with the `AGENTS.md` persona.
- **Analysis First**: Force the fleet to begin with an "Analysis and Implementation Plan" phase based on the synthesized requirements.

## Output Format

Use this closeout format unless the user asks for something else:

- Summary
- Files changed
- Tests run
- Risks
- Next step

## Compact Handoff Format

When handing off or compressing context, return:

- objective
- current status
- files touched
- decisions made
- open risks
- exact next action

## References

- OpenAI model comparison: `GPT-5.4` is positioned for agentic, coding, and professional workflows, while `GPT-5.4-mini` is positioned for coding, computer use, and subagents. Source: https://developers.openai.com/api/docs/models/compare
- OpenAI coding model reference: `GPT-5.3-Codex` is described as optimized for agentic coding tasks. Source: https://developers.openai.com/api/docs/models/gpt-5.3-codex
- Ollama docs: Ollama documents support for local models including `gpt-oss`, `Gemma 3`, `DeepSeek-R1`, and `Qwen3`, and supports tool calling. Sources: https://docs.ollama.com/index and https://docs.ollama.com/capabilities/tool-calling
