# Phase 3 — Computer Use Setup

One-time setup before Phase 3 workflows can run. ~5 minutes.

---

## 1. Install `cliclick`

cliclick is a tiny macOS CLI for sending mouse clicks and scroll events at coordinates. ~50KB, no daemon, no privileges. Standard tool in macOS automation.

```bash
brew install cliclick
```

Verify:
```bash
cliclick -V       # should print the version (5.x)
which cliclick    # /opt/homebrew/bin/cliclick (Apple Silicon)
                  # /usr/local/bin/cliclick (Intel)
```

---

## 2. Grant macOS permissions

Computer Use needs **Screen Recording** + **Accessibility**. Both are per-app on macOS.

Two binaries need permission:
- `cliclick` (for mouse clicks)
- `node` — whichever Node binary jarvisd runs under (typically `/opt/homebrew/bin/node` or `/usr/local/bin/node`)

### Screen Recording

1. Open `System Settings → Privacy & Security → Screen Recording`
2. Click `+`, navigate to `/usr/sbin/screencapture` if listed (it's pre-allowed by macOS for most users) — usually no action needed
3. Add `node` if running jarvisd from terminal — find with `which node`

### Accessibility

1. Open `System Settings → Privacy & Security → Accessibility`
2. Add `cliclick` (or its Homebrew path: `/opt/homebrew/bin/cliclick`)
3. Add `node` if running jarvisd from terminal

Restart jarvisd after granting permissions.

### Verify

```bash
cd jarvisd && npx tsx scripts/cu-smoke.mts permissions
```

Should print `OK: true`. If it lists problems, follow the hints printed.

---

## 3. Create the Jarvis Chrome profile

Per the Phase 3 plan (Tweak 1): a dedicated Chrome profile keeps your main browsing untouched while the agent works.

```bash
cd jarvisd && npx tsx scripts/cu-smoke.mts chrome
```

This launches Chrome with `--profile-directory=Jarvis`, creating the profile on first launch. You'll see a fresh Chrome window with no extensions, no bookmarks, no history. That's correct.

### Log into the three sites — once

In the Jarvis-profile Chrome window:

1. **Pipedrive** — visit your Pipedrive workspace, log in, check "remember me" if available
2. **3plify** — visit, log in, stay signed in
3. **PandaDoc** — usually opens from a Pipedrive deal; log in via that flow

After this, the Jarvis profile keeps these sessions alive across browser restarts. Computer Use workflows assume you're already logged into all three.

### Check status

```bash
npx tsx scripts/cu-smoke.mts chrome
```

Should report:
```
Chrome installed: true
Jarvis profile exists: true
Profile dir: /Users/<you>/Library/Application Support/Google/Chrome/Jarvis
```

---

## 4. Smoke-test individual primitives (optional)

The smoke script has individual test modes — run any of these to sanity-check before relying on workflows:

```bash
npx tsx scripts/cu-smoke.mts display      # Native + API resolution + scale factor
npx tsx scripts/cu-smoke.mts screenshot   # Capture full screen → /tmp/jarvis-cu-test.png
npx tsx scripts/cu-smoke.mts click        # Click at API (1000, 400) — focus a harmless window first
npx tsx scripts/cu-smoke.mts type         # Type "hello jarvis" — focus a text field within 3s
npx tsx scripts/cu-smoke.mts key          # Press cmd+t — focus Chrome within 3s
npx tsx scripts/cu-smoke.mts all          # Run permissions → display → screenshot back-to-back
```

---

## Troubleshooting

### `cliclick not installed` after running `brew install cliclick`

`brew install cliclick` succeeded but the daemon can't find it. Check:
```bash
ls -la /opt/homebrew/bin/cliclick
ls -la /usr/local/bin/cliclick
```
The daemon probes both paths. If your Homebrew is in a non-standard location, file an issue or symlink to `/opt/homebrew/bin/cliclick`.

### Screen Recording denied even after granting

macOS sometimes caches the old denial. After granting:
1. Click the toggle off, then back on
2. Restart the daemon (`pkill -f "tsx watch" && cd jarvisd && npm run dev`)
3. If still failing: log out + log back in to macOS

### Permissions disappeared after Node upgrade

If you `brew upgrade node` (or use nvm to switch versions), the new Node binary is a different file from macOS's perspective and loses its permissions. Re-grant via Settings.

### "Coordinate (X, Y) is outside display bounds"

Your screen resolution changed (e.g. plugged in / unplugged an external monitor). The display size is cached on first call. Restart the daemon to re-detect.

### Computer Use cost suddenly spiked

Check the per-workflow cost cap. Each rate_shop max $1, etc. Override in Settings if needed.
