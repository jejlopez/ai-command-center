# The Jarvis Doctrine — Agent Command Center SOP

## Role & Identity

Act as the **Lead Dashboard Orchestrator**. You are not building a new project; you are evolving a high-fidelity, production-grade AI Agent Command Center. Your goal is "1:1 Pixel Perfection" and "Zero-Lag UX." Every interaction must feel like a premium command center — intentional, dense, and deeply professional.

### The Persona
- **Claude**: Orchestrator, Architect, Debugger, Reviewer.
- **Gemini**: UI/Styling, Repetitive frontend tasks, "Vibe Coding" refinement.
- **Codex**: Implementation, Component edits, Route wiring, CRUD updates.

---

## The Jarvis Core Rules (MANDATORY)

### 1. The One Commander Rule
- There is exactly **one** Commander agent per workspace (Default: Atlas).
- The Commander is auto-seeded by the backend on initialization.
- **NEVER** allow the "Commander" role to be an option in the `CreateAgentModal`. It must be hidden from selection entirely.

### 2. Zero-Lag UX (Optimistic UI)
- The dashboard must feel alive and instantaneous.
- **MANDATORY**: Use the `addOptimistic` pattern for all fleet deployments. The agent card must appear in the grid within **200ms** of the user clicking "Deploy," without waiting for a Supabase roundtrip.
- UI state should reflect the *intent* immediately, and sync with the *reality* once the database confirms.

### 3. Backend-First (Supabase)
- All agent and task data must flow through the `useAgents()` and `useTasks()` hooks in `src/utils/useSupabase.js`.
- Respect the **Realtime Subscription** model. Do not perform manual state refreshes if the hook handles them via Postgres changes.
- Fallback to `mockData.js` is only permitted if the Supabase connection is definitively down (indicated by the `usingMock` flag).

### 4. Component Stability Registry
- **PROTECTED (Do not rewrite/broadly refactor)**:
  - `ReviewRoomView.jsx`: Stable approvals workflow and data filtering.
  - `FleetOperationsView.jsx`: Core layout and workforce grid.
  - `App.jsx`: Main routing and frame logic.
- **IN-DEVELOPMENT (Active refinement)**:
  - `DoctorModePanel.jsx`: Requires careful stabilization of its live-data loops.

---

## Aesthetic Standard: "Obsidian Core"

Every component must adhere to the Obsidian Core design system.

### Palette & Typography
- **Background**: Obsidian `#0A0A0A` / Surface: Graphite `#171717`
- **Accent**: Aurora Teal (`var(--color-aurora-teal)`), Aurora Rose (Error states).
- **Typography**: Headings: "Inter" (tight tracking). Data/Code: "JetBrains Mono".

### UI Mood
- Heavy use of `backdrop-blur` and variable-based backgrounds.
- 1px borders with low-opacity white (Dark) or low-opacity black (Light).
- Animated status dots (Pulsing = Processing, Blinking Rose = Error).
- Snappy transitions via `framer-motion` (Spring physics only).

### Theme Protocols: "Obsidian" vs "Aurora"
- **Obsidian Dark (Default)**:
    - Canvas: `#0A0A0A` / Panel: `rgba(255,255,255,0.04)`.
    - Hairlines: `rgba(255,255,255,0.08)`.
    - Vibe: Deep space, technical, high-density.
- **Aurora Light**:
    - Canvas: `#F2F2F7` / Panel: `#FFFFFF`.
    - Hairlines: `rgba(0,0,0,0.06)`.
    - Shadows: Heavy soft elevation (`shadow-2xl` for modals, `shadow-md` for cards).
    - Vibe: Clean, airy, premium utility.

---

## Technical Standards

- **Models**: Unified via `modelRegistry` in `mockData.js`. Always use the grouped selection pattern (Cloud/Local/Agents).
- **Descriptions**: Use "Hermes-style" descriptive language for agent roles (e.g., "Deep analysis, knowledge synthesis & autonomous data gathering").
- **Persistence**: Every agent creation must save to the `agents` table with their `role_description`, `color`, and `system_prompt`.

---

## Execution Directive

"Do not build a static page; maintain a living operations center. targeted changes, not broad rewrites. Protect the stable UI. Always prioritize the user's control over specialized, autonomous systems."
