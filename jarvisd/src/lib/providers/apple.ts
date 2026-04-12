// macOS native Mail + Calendar integration via AppleScript.
// Zero-setup alternative to Google OAuth: works with whatever accounts the
// user already has configured in System Settings (Gmail, iCloud, Outlook, ...).
//
// First call triggers a macOS Automation permission prompt for the host
// (Electron / Terminal / jarvisd). User clicks OK once, it works forever.
//
// Only works on darwin; gracefully returns unavailable on other platforms.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";
import { audit } from "../audit.js";

const execFileP = promisify(execFile);

const isMac = platform() === "darwin";

async function runOsa(script: string, timeoutMs = 8000): Promise<string> {
  if (!isMac) throw new Error("apple connectors only available on macOS");
  try {
    const { stdout } = await execFileP("osascript", ["-e", script], {
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err: any) {
    // AppleScript errors come through as exit code != 0 with stderr populated.
    const msg = err?.stderr?.toString?.().trim() || err?.message || String(err);
    throw new Error(msg);
  }
}

export interface AppleCalendarEvent {
  id: string;
  title: string;
  start: string;        // ISO
  end: string;          // ISO
  location?: string;
  calendar?: string;
  allDay?: boolean;
}

export interface AppleMailMessage {
  id: string;
  subject: string;
  sender: string;
  date: string;         // ISO
  snippet: string;
  account?: string;
  read: boolean;
}

export interface AppleStatus {
  platform: "darwin" | "other";
  mail: { available: boolean; error?: string };
  calendar: { available: boolean; error?: string };
}

// ---------- Calendar ---------------------------------------------------------

function escapeAs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Returns today's events across every calendar the user has configured.
 * Uses a compact newline-delimited format so we don't have to parse
 * AppleScript's record syntax.
 */
export async function getTodayEvents(): Promise<AppleCalendarEvent[]> {
  if (!isMac) return [];
  // AppleScript + Calendar.app has a reputation for being slow because the
  // Calendar scripting dictionary iterates every event in every calendar.
  // Keep the query minimal and wrap property access in try blocks so one
  // broken calendar doesn't kill the whole lookup. Name is `name of c`,
  // not `title of c`.
  const script = `
set startOfDay to current date
set hours of startOfDay to 0
set minutes of startOfDay to 0
set seconds of startOfDay to 0
set endOfDay to startOfDay + (24 * 60 * 60) - 1
set output to ""
tell application "Calendar"
  set cals to every calendar
  repeat with c in cals
    try
      set cname to name of c
      set todays to (every event of c whose start date is greater than or equal to startOfDay and start date is less than or equal to endOfDay)
      repeat with e in todays
        try
          set eid to (uid of e) as string
          set etitle to (summary of e) as string
          set sdate to start date of e
          set edate to end date of e
          set eloc to ""
          try
            set eloc to (location of e) as string
          end try
          set output to output & eid & "|" & etitle & "|" & cname & "|" & (my iso(sdate)) & "|" & (my iso(edate)) & "|" & eloc & linefeed
        end try
      end repeat
    end try
  end repeat
end tell
return output
on iso(d)
  set y to year of d as string
  set m to (month of d as integer) as string
  if (count of m) is 1 then set m to "0" & m
  set dd to day of d as string
  if (count of dd) is 1 then set dd to "0" & dd
  set hh to (hours of d) as string
  if (count of hh) is 1 then set hh to "0" & hh
  set mm to (minutes of d) as string
  if (count of mm) is 1 then set mm to "0" & mm
  set ss to (seconds of d) as string
  if (count of ss) is 1 then set ss to "0" & ss
  return y & "-" & m & "-" & dd & "T" & hh & ":" & mm & ":" & ss
end iso
  `;
  try {
    const raw = await runOsa(script, 30000);
    if (!raw) return [];
    return raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const [id, title, calendar, start, end, location] = line.split("|");
        return {
          id,
          title: title ?? "(no title)",
          calendar,
          start,
          end,
          location: location || undefined,
          allDay: false,
        } as AppleCalendarEvent;
      });
  } catch (err: any) {
    audit({ actor: "system", action: "apple_calendar.query.fail", reason: err.message });
    return [];
  }
}

export async function calendarStatus(): Promise<{ available: boolean; error?: string }> {
  if (!isMac) return { available: false, error: "not macOS" };
  try {
    // Minimal query — just reads the calendar list. First call triggers the
    // macOS Automation permission prompt.
    const out = await runOsa(`tell application "Calendar" to return name of every calendar`, 5000);
    const calendars = out.split(", ").filter(Boolean);
    return { available: calendars.length > 0 };
  } catch (err: any) {
    return { available: false, error: err.message };
  }
}

// ---------- Mail -------------------------------------------------------------

/**
 * Returns the latest N unread messages across every Mail.app inbox.
 * Format per line: id|subject|sender|dateISO|account|snippet
 */
export async function getRecentUnread(limit = 10): Promise<AppleMailMessage[]> {
  if (!isMac) return [];
  const script = `
  set output to ""
  set cap to ${Math.max(1, Math.min(50, limit))}
  set collected to 0
  tell application "Mail"
    set allAccounts to every account
    repeat with a in allAccounts
      if collected ≥ cap then exit repeat
      try
        set inboxMsgs to (messages of inbox of a whose read status is false)
        set n to count of inboxMsgs
        if n > 0 then
          set startIdx to n
          set endIdx to n - (cap - collected - 1)
          if endIdx < 1 then set endIdx to 1
          repeat with i from startIdx to endIdx by -1
            try
              set m to item i of inboxMsgs
              set sj to subject of m
              set sd to sender of m
              set dt to date received of m
              set an to name of a
              set sn to ""
              try
                set sn to content of m
              end try
              if (length of sn) > 180 then set sn to (text 1 thru 180 of sn)
              set sn to my clean(sn)
              set output to output & (id of m as string) & "|" & sj & "|" & sd & "|" & (my iso of dt) & "|" & an & "|" & sn & linefeed
              set collected to collected + 1
              if collected ≥ cap then exit repeat
            end try
          end repeat
        end if
      end try
    end repeat
  end tell
  return output
  on iso(d)
    set y to year of d as string
    set mo to (month of d as integer) as string
    if (count of mo) is 1 then set mo to "0" & mo
    set dd to day of d as string
    if (count of dd) is 1 then set dd to "0" & dd
    set hh to (hours of d) as string
    if (count of hh) is 1 then set hh to "0" & hh
    set mm to (minutes of d) as string
    if (count of mm) is 1 then set mm to "0" & mm
    set ss to (seconds of d) as string
    if (count of ss) is 1 then set ss to "0" & ss
    return y & "-" & mo & "-" & dd & "T" & hh & ":" & mm & ":" & ss
  end iso
  on clean(s)
    set r to ""
    repeat with c in characters of s
      set ch to c as string
      if ch is return or ch is linefeed or ch is tab then
        set r to r & " "
      else if ch is "|" then
        set r to r & "/"
      else
        set r to r & ch
      end if
    end repeat
    return r
  end clean
  `;
  const raw = await runOsa(script, 15000);
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [id, subject, sender, date, account, snippet] = line.split("|");
      return {
        id,
        subject: subject ?? "(no subject)",
        sender: sender ?? "",
        date: date ?? "",
        account,
        snippet: snippet ?? "",
        read: false,
      } as AppleMailMessage;
    });
}

export async function mailStatus(): Promise<{ available: boolean; error?: string }> {
  if (!isMac) return { available: false, error: "not macOS" };
  try {
    const out = await runOsa(`tell application "Mail" to return name of every account`, 5000);
    const accounts = out.split(", ").filter(Boolean);
    return { available: accounts.length > 0 };
  } catch (err: any) {
    return { available: false, error: err.message };
  }
}

export async function appleStatus(): Promise<AppleStatus> {
  if (!isMac) {
    return {
      platform: "other",
      mail: { available: false, error: "not macOS" },
      calendar: { available: false, error: "not macOS" },
    };
  }
  const [m, c] = await Promise.all([mailStatus(), calendarStatus()]);
  return { platform: "darwin", mail: m, calendar: c };
}

// Test call triggers the permission prompt once, and audits the result.
export async function requestAccess(): Promise<AppleStatus> {
  const status = await appleStatus();
  audit({
    actor: "user",
    action: "apple.request_access",
    metadata: {
      mail: status.mail.available,
      calendar: status.calendar.available,
      mailError: status.mail.error,
      calendarError: status.calendar.error,
    },
  });
  return status;
}
