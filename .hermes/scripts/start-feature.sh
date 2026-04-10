#!/bin/bash

# .hermes/scripts/start-feature.sh
# Usage: npm run start-feature -- "Feature Name"

FEATURE_NAME=$1

if [ -z "$FEATURE_NAME" ]; then
  echo "Error: Please provide a feature name."
  echo "Usage: npm run start-feature -- \"Feature Name\""
  exit 1
fi

# 🚦 WORKSPACE STATE: Detect uncommitted changes
WORKSPACE_STATE="clean"
if ! git diff-index --quiet HEAD --; then
  echo "⚠️  Uncommitted changes detected. Jarvis will manage flow preservation."
  WORKSPACE_STATE="dirty"
fi

# 1. Sanitize the name for a git branch (lowercase, replace砥paces with hyphens)
BRANCH_NAME="feature/$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"

echo "🌿 Creating feature branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

echo "🚀 Initiating $FEATURE_NAME via Jarvis Manager-GPT..."

# Invoke hermes with the manager-gpt profile and pre-inject AGENTS.md context
hermes --profile manager-gpt "Initiate a new feature build for '$FEATURE_NAME' in the Jarvis Command Center. Enforce all AGENTS.md rules and delegate to specialized workers as needed. Initial task: Analysis and Implementation Plan."
