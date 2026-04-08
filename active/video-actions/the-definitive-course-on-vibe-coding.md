# The Definitive Course on Vibe Coding for Beginners — Extracted Procedure

**Source**: https://www.youtube.com/watch?v=gcuR_-rzlDw
**Extracted**: 2026-04-07
**Intent**: Extract learnings to apply to the Nexus AI Dashboard

## Prerequisites
- AntiGravity IDE installed
- Google Account connected (for Gemini models)
- Anthropic Account (for Claude Code, optional)
- Basic understanding of file structures

## Common Steps to Vibe Code a Website (The Vibe Code Loop)
1. **Design and Main Functionality**: Start with an inspiration screenshot from Dribbble. Have the visual model (e.g., Gemini) build the core un-styled components, then instruct it to apply the specific cinematic style.
2. **Local Interactivity**: Wire up the mock UI using local JSON/mock data. Ensure all tabs, routes, and interactions work.
3. **Database and Authentication**: Go to `database.new` (Supabase) to provision a backend. Replace local mock data with live database hooks. Implement Row Level Security (RLS) to ensure data isolation. Add the sign-in page at the *end* (instead of the beginning) so that AI middleware generation is built with full context.
4. **Landing Page**: Build the unauthenticated landing page.
5. **End-to-End Sweep**: Perform manual local testing, DB security testing, authentication validation, and final deploy.

## Steps

### Step 1: Tool Installation and Setup (02:36)
**Action**: Download and Install AntiGravity.
**Details**: Choose Apple Silicon or Intel based on "About this Mac". Drag into Applications folder. Connect to your Google account to enable the built-in Gemini Agent chat.

### Step 2: Configure Workspace Level Rules (11:36)
**Action**: Define high-level AI constraints utilizing the Customizations panel.
**Details**: Create rules like "cinematic landing page builder" directing the agent to act as a world-class senior creative technologist. Save rules to the `agent/rules` folder or create a primary `gemini.md` file. These guide every interaction automatically without needing explicit instructions per task.

### Step 3: Implement Standardized Workflows/Skills (13:58)
**Action**: Configure standard operating procedures for the agent.
**Details**: Create specific workflows (e.g., Code Review) that the agent must step through incrementally. Example: Instructing the agent to reference a security document and perform checks prior to pushing to production.

### Step 4: Model Hot-Swapping and Delegation (18:03)
**Action**: Toggle between models for optimal performance per task.
**Details**: Pass off design/UI generation to visual models like Gemini 3.1 Pro High and complex local file system reasoning to Claude Opus 4.6. Utilize the right abstraction depending on the task's needs.

### Step 5: Leverage Fast vs. Planning Mode (16:59)
**Action**: Utilize Planning mode for new features, Fast mode for quick iterations.
**Details**: For multi-file architectural changes, force the agent into Planning mode so it produces a workflow and seeks approval before writing. For changing a single extension or formatting, use Fast execute.

## Key Learnings to Apply to Dashboard

1. **Vibe Coding Loop applied to Dashboard Data**: We need to move from "Local Interactivity" (mock data) to "Database and Authentication" (Supabase) to support adding real agents.
2. **System Rules Interface**: Implement a dedicated space (in `IntelligenceView`) to manage global AI instructions as code-block style directives.
3. **Workflows as Components**: Build a UI element to trigger standard agent operational workflows incrementally.
4. **Model Hot-Switching**: If applicable in the dashboard, allow the user to visualize which agent/model is handling task DAGs depending on capability.
