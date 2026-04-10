---
name: git-workflows
description: Safe day-to-day Git workflow guidance for Codex across status checks, branch management, commits, rebases, conflict resolution, stashing, sync, and pull request preparation. Use when Codex needs to inspect repository state, choose or create a branch, preserve user changes, stage and commit work, sync with a base branch, explain conflicts, or prepare a clean handoff without performing destructive Git operations.
---

# Git Workflows

## Overview

Use this skill to execute small, safe, reversible Git workflows with clear state awareness. Prefer inspection first, preserve uncommitted work, and avoid destructive commands unless the user explicitly requests them.

## Core Operating Rules

- Inspect before acting.
- Read `git status --short --branch` before proposing branch, stash, commit, or sync actions.
- Treat uncommitted user changes as protected state. Never discard or overwrite them without explicit permission.
- Do not work on `main`. Stay on the current feature branch unless the user asks for a fresh branch.
- Create a dedicated branch for substantial work when practical. Prefer the repo convention the user or repo already uses. If no convention is present, prefer `codex/<task>`; if the repo explicitly uses `feature/`, follow that.
- Use non-interactive Git commands only.
- Do not push, open a PR, merge, or return to `main` unless the user asks.
- Never use destructive commands such as `git reset --hard`, `git checkout -- <file>`, or force-push unless the user explicitly approves them.

## Workflow Decision Tree

### 1. Inspect State First

Start with:

```bash
git status --short --branch
git branch --show-current
git log --oneline --decorate -n 5
```

Use these commands to answer:

- What branch am I on?
- Are there staged or unstaged changes?
- Is there ongoing merge or rebase state?
- What is the recent commit context?

### 2. Protect Uncommitted Work

If the workspace is dirty and the next step could disturb it, prefer one of these paths:

1. Keep changes in place and work around them if the files are unrelated.
2. Commit the work in progress if the user asked for a checkpoint commit.
3. Stash only when needed to unblock branch switching or syncing.

Use:

```bash
git stash push -u -m "wip: <reason>"
git stash list
```

Do not stash reflexively. First decide whether the current worktree can stay as-is.

### 3. Choose the Branch Strategy

Use the lightest safe option:

1. Stay on the current branch if it already matches the task.
2. Create a new branch from the current branch for isolated work.
3. Create a new branch from the agreed base branch only when the user wants a fresh start.

Common commands:

```bash
git checkout -b codex/<task-name>
git checkout -b feature/<task-name>
```

Prefer branch names that are short, lowercase, and hyphenated.

### 4. Stage Intentionally

Stage only the files that belong to the requested change. Review before committing:

```bash
git diff -- <path>
git add <path>
git diff --cached
```

Avoid broad staging unless the user explicitly wants all tracked changes included.

### 5. Commit Cleanly

Write commit messages that explain the user-visible or developer-visible outcome, not just the mechanics.

Good patterns:

- `fix: preserve active mission state during sync`
- `feat: add command center profile empty state`
- `chore: checkpoint dashboard refactor`

Before committing, confirm that:

- only intended files are staged
- the diff matches the request
- obvious build or lint risks were at least inspected

### 6. Sync Without Surprises

When updating a branch, prefer fetching first and then choosing the narrowest sync method:

```bash
git fetch origin
git rebase origin/main
```

Use merge instead of rebase when:

- the repo or user prefers merge commits
- the branch is already shared and rebasing would be disruptive
- the user explicitly asks for merge behavior

If conflicts appear:

1. Identify conflicted files with `git status`.
2. Resolve only the marked sections that matter.
3. Re-check the diff after edits.
4. Continue with `git rebase --continue` or complete the merge commit.

Never guess through a conflict in a high-risk file. Read the surrounding code and preserve both user intent and current branch intent where needed.

### 7. Prepare a Handoff

When the user asks for a branch, commit, or PR-ready state, report:

- branch name
- whether the worktree is clean
- whether changes are committed
- whether the branch is ahead/behind its remote if known
- what was verified and what was not

## Command Patterns

Use targeted commands instead of broad or destructive ones.

### Status and History

```bash
git status --short --branch
git log --oneline --decorate -n 10
git diff
git diff --cached
```

### Branching

```bash
git branch --show-current
git branch
git checkout -b codex/<task-name>
```

### Staging and Commit

```bash
git add <path>
git commit -m "<type>: <summary>"
```

### Sync

```bash
git fetch origin
git rebase origin/main
git merge origin/main
```

### Recovery Without Destruction

```bash
git stash push -u -m "wip: <reason>"
git stash pop
git restore --staged <path>
```

Use `git restore --staged` to unstage without discarding file changes.

## Repo-Specific Guidance

When this skill is used inside the Dashboard repo:

- Follow `AGENTS.md` first.
- Do not merge or open a PR unless the user asks.
- For substantial tasks, prefer a dedicated feature branch.
- If the repo already has unrelated local edits, work with them instead of reverting them.
- If branch creation is needed and the repo has an existing `feature/` convention, use it. Otherwise `codex/` is acceptable.

## Example Triggers

This skill should activate for requests like:

- "create a branch for this feature"
- "checkpoint my current work"
- "help me clean up this git state"
- "rebase this branch on main"
- "figure out what changed and commit it"
- "prepare this branch for a PR"

## Completion Checklist

Before finishing a Git workflow task, confirm:

- the branch choice matches the user request
- protected user changes were preserved
- only intended files were staged or committed
- any push, PR, merge, or destructive step was explicitly authorized
- the user received a short status summary with remaining risks
