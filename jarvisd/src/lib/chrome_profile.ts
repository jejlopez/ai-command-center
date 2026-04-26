// Dedicated Chrome profile for Computer Use (Phase 3, Tweak 1).
//
// Per the user's directive: don't hijack their main browser. Instead, run
// Computer Use against a separate "Jarvis" Chrome profile where they've
// pre-logged into Pipedrive, 3plify, and PandaDoc.
//
// Profile lives at:
//   ~/Library/Application Support/Google/Chrome/Jarvis
//
// Chrome creates the profile directory on first launch with --profile-directory.
// We launch with a minimal command line and let Chrome handle the rest.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const execFileP = promisify(execFile);

export const PROFILE_NAME = "Jarvis";
const CHROME_USER_DATA = join(homedir(), "Library", "Application Support", "Google", "Chrome");
export const PROFILE_DIR = join(CHROME_USER_DATA, PROFILE_NAME);

const CHROME_APP_PATH = "/Applications/Google Chrome.app";

export interface ChromeProfileStatus {
  installed: boolean;          // is Chrome.app present
  profileExists: boolean;      // does ~/.../Chrome/Jarvis exist
  needsLogin: string[];        // sites the user must log into manually
}

export function chromeProfileStatus(): ChromeProfileStatus {
  return {
    installed: existsSync(CHROME_APP_PATH),
    profileExists: existsSync(PROFILE_DIR),
    needsLogin: ["Pipedrive", "3plify", "PandaDoc (via Pipedrive deal)"],
  };
}

/**
 * Launch Chrome with the Jarvis profile, optionally navigating to a URL.
 * If the profile doesn't exist yet, Chrome will create it on first launch
 * and present the standard welcome screen — the user will then need to log
 * into Pipedrive / 3plify / PandaDoc manually before any Computer Use
 * workflow will succeed.
 *
 * `--no-first-run` skips Chrome's onboarding wizard.
 * `--no-default-browser-check` keeps it from prompting to be default.
 * `--profile-directory=Jarvis` selects (or creates) the profile.
 *
 * Subsequent launches reuse the existing profile and any logged-in sessions.
 */
export async function launchChromeWithJarvisProfile(url?: string): Promise<void> {
  const status = chromeProfileStatus();
  if (!status.installed) {
    throw new Error(
      "Google Chrome is not installed at /Applications/Google Chrome.app. " +
      "Install Chrome from https://www.google.com/chrome/ then re-run."
    );
  }

  const args = [
    "-na", "Google Chrome", "--args",
    `--profile-directory=${PROFILE_NAME}`,
    "--no-first-run",
    "--no-default-browser-check",
  ];
  if (url) args.push(url);

  await execFileP("open", args, { timeout: 8000 });
}

/**
 * Open the Jarvis profile to a specific URL and wait briefly for Chrome to
 * actually surface the window. Used as a workflow pre-flight.
 */
export async function navigateInJarvisProfile(url: string, settleMs = 1500): Promise<void> {
  await launchChromeWithJarvisProfile(url);
  await new Promise((r) => setTimeout(r, settleMs));
}
