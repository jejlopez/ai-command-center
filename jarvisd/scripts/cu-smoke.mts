// Phase 3 Day 1 smoke test for the macOS Computer Use primitives.
//
// Run with:  npx tsx jarvisd/scripts/cu-smoke.mts <test-name>
//
// Available tests:
//   permissions  — probe Screen Recording + Accessibility, report status
//   display      — print detected display size + scale factors
//   screenshot   — capture a screenshot, report size, save to /tmp/jarvis-cu-test.png
//   click        — move + click at API coords (1000, 400), no-op-ish if focus is empty
//   type         — type "hello jarvis" — focus a text field first!
//   key          — press cmd+t (opens new tab if Chrome focused)
//   chrome       — launch Chrome with the Jarvis profile, navigate to about:blank
//   all          — permissions → display → screenshot (read-only happy path)
//
// First run will trigger macOS permission prompts. Grant them and re-run.

import { writeFileSync } from "node:fs";

const test = process.argv[2] ?? "all";

async function main() {
  const m = await import("../src/lib/macos_actions.js");
  const c = await import("../src/lib/chrome_profile.js");

  switch (test) {
    case "permissions": {
      const r = await m.probePermissions();
      console.log(`OK: ${r.ok}`);
      if (r.problems.length) console.log("Problems:", r.problems);
      break;
    }
    case "display": {
      const d = await m.getDisplaySize();
      console.log(`Native: ${d.nativeWidth} × ${d.nativeHeight}`);
      console.log(`API: ${m.API_WIDTH} × ${m.API_HEIGHT}`);
      console.log(`Scale: ${d.scaleX.toFixed(3)} × ${d.scaleY.toFixed(3)}`);
      break;
    }
    case "screenshot": {
      const t0 = Date.now();
      const r = await m.screenshot();
      const ms = Date.now() - t0;
      const buf = Buffer.from(r.base64, "base64");
      writeFileSync("/tmp/jarvis-cu-test.png", buf);
      console.log(`Captured ${buf.length} bytes in ${ms}ms`);
      console.log(`Saved → /tmp/jarvis-cu-test.png`);
      console.log(`Open with: open /tmp/jarvis-cu-test.png`);
      break;
    }
    case "click": {
      console.log("Clicking at API (1000, 400) in 2s — focus a harmless target...");
      await new Promise((r) => setTimeout(r, 2000));
      await m.leftClick(1000, 400);
      console.log("Click sent.");
      break;
    }
    case "type": {
      console.log("Typing 'hello jarvis' in 3s — focus a text field NOW...");
      await new Promise((r) => setTimeout(r, 3000));
      await m.typeText("hello jarvis");
      console.log("Typed.");
      break;
    }
    case "key": {
      console.log("Pressing cmd+t in 3s — focus Chrome first...");
      await new Promise((r) => setTimeout(r, 3000));
      await m.pressKey("cmd+t");
      console.log("Key combo sent.");
      break;
    }
    case "chrome": {
      const status = c.chromeProfileStatus();
      console.log(`Chrome installed: ${status.installed}`);
      console.log(`Jarvis profile exists: ${status.profileExists}`);
      console.log(`Profile dir: ${c.PROFILE_DIR}`);
      if (!status.installed) {
        console.error("Install Chrome first.");
        process.exit(1);
      }
      console.log("Launching Chrome (Jarvis profile) → about:blank ...");
      await c.navigateInJarvisProfile("about:blank");
      console.log("Done. Log into Pipedrive / 3plify / PandaDoc in this profile if not already.");
      break;
    }
    case "all": {
      console.log("=== probePermissions ===");
      const r = await m.probePermissions();
      console.log(`  ok=${r.ok}  problems=[${r.problems.join(", ")}]`);
      if (!r.ok) {
        console.error("Fix permissions first; bail.");
        process.exit(1);
      }
      console.log("\n=== getDisplaySize ===");
      const d = await m.getDisplaySize();
      console.log(`  native=${d.nativeWidth}x${d.nativeHeight}  api=${m.API_WIDTH}x${m.API_HEIGHT}  scale=${d.scaleX.toFixed(3)}x${d.scaleY.toFixed(3)}`);
      console.log("\n=== screenshot ===");
      const t0 = Date.now();
      const ss = await m.screenshot();
      console.log(`  ${Math.round(Buffer.from(ss.base64, "base64").length / 1024)} KB in ${Date.now() - t0}ms`);
      console.log("\n=== chrome profile status ===");
      const cs = c.chromeProfileStatus();
      console.log(`  chrome=${cs.installed}  profile=${cs.profileExists}`);
      console.log("\n✅ Day 1 primitives green");
      break;
    }
    default:
      console.error(`Unknown test: ${test}`);
      console.error("Try: permissions | display | screenshot | click | type | key | chrome | all");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  if (err.hint) console.error("→", err.hint);
  process.exit(1);
});
