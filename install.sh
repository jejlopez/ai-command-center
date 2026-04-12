#!/usr/bin/env bash
set -euo pipefail

echo "╔══════════════════════════════════════╗"
echo "║       JARVIS OS — Installer          ║"
echo "╚══════════════════════════════════════╝"
echo ""

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

# --- Check prerequisites ---
echo "→ Checking prerequisites..."

if ! command -v node &>/dev/null; then
  echo "✗ Node.js not found. Install from https://nodejs.org"
  exit 1
fi
echo "  ✓ Node.js $(node --version)"

if ! command -v npm &>/dev/null; then
  echo "✗ npm not found"
  exit 1
fi
echo "  ✓ npm $(npm --version)"

# Rust is optional (only needed for Tauri build)
HAS_RUST=false
if command -v rustc &>/dev/null; then
  echo "  ✓ Rust $(rustc --version | cut -d' ' -f2)"
  HAS_RUST=true
else
  echo "  ○ Rust not installed (Tauri build will be skipped)"
fi

# --- Install dependencies ---
echo ""
echo "→ Installing dependencies..."
npm install --silent 2>/dev/null
echo "  ✓ Root dependencies"

cd jarvisd
npm install --silent 2>/dev/null
echo "  ✓ Daemon dependencies"
cd ..

# --- Build web frontend ---
echo ""
echo "→ Building web frontend..."
npx vite build --silent 2>/dev/null || npx vite build
echo "  ✓ Frontend built → dist/"

# --- Type-check daemon ---
echo ""
echo "→ Type-checking daemon..."
cd jarvisd
npx tsc --noEmit 2>/dev/null && echo "  ✓ TypeScript clean" || echo "  △ Type warnings (non-blocking)"
cd ..

# --- Build Tauri app (if Rust available) ---
if [ "$HAS_RUST" = true ] && command -v cargo &>/dev/null; then
  if command -v cargo-tauri &>/dev/null || [ -f "$HOME/.cargo/bin/cargo-tauri" ]; then
    echo ""
    echo "→ Building Tauri desktop app..."
    source "$HOME/.cargo/env" 2>/dev/null || true
    cargo tauri build 2>/dev/null && {
      echo "  ✓ JARVIS OS.app built"

      # Ad-hoc sign
      APP_PATH="src-tauri/target/release/bundle/macos/JARVIS OS.app"
      if [ -d "$APP_PATH" ]; then
        codesign --force --deep --sign - "$APP_PATH" 2>/dev/null
        xattr -cr "$APP_PATH" 2>/dev/null
        echo "  ✓ App signed (ad-hoc)"

        # Copy to /Applications
        echo ""
        read -p "→ Install to /Applications? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
          rm -rf "/Applications/JARVIS OS.app" 2>/dev/null
          cp -R "$APP_PATH" "/Applications/"
          echo "  ✓ Installed to /Applications/JARVIS OS.app"
        fi
      fi
    } || echo "  △ Tauri build failed (app still works via npm start)"
  else
    echo ""
    echo "  ○ Tauri CLI not installed (run: cargo install tauri-cli)"
  fi
else
  echo ""
  echo "  ○ Skipping Tauri build (no Rust toolchain)"
fi

# --- Summary ---
echo ""
echo "╔══════════════════════════════════════╗"
echo "║         Installation complete!       ║"
echo "╠══════════════════════════════════════╣"
echo "║                                      ║"
echo "║  Start dev mode:                     ║"
echo "║    npm start                         ║"
echo "║                                      ║"
echo "║  Start daemon only:                  ║"
echo "║    cd jarvisd && npx tsx src/index.ts ║"
echo "║                                      ║"
echo "║  Open the app:                       ║"
echo "║    open /Applications/JARVIS\ OS.app ║"
echo "║                                      ║"
echo "╚══════════════════════════════════════╝"
