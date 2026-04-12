// Native notifications via Tauri + WebSocket events.
// Falls back to browser Notification API when not in Tauri.

import { useEffect, useRef } from "react";
import { useJarvisSocket } from "./useJarvisSocket.js";

const IS_TAURI = typeof window !== "undefined" && "__TAURI__" in window;

async function sendNotification(title, body, icon) {
  if (IS_TAURI) {
    try {
      // Dynamic path hides from Vite's static analysis so it doesn't fail when the
      // Tauri plugin isn't installed (browser-only builds).
      const mod = "@tauri-apps/" + "plugin-notification";
      const { sendNotification: tauriNotify } = await import(/* @vite-ignore */ mod);
      await tauriNotify({ title, body, icon });
      return;
    } catch { /* fall through to browser API */ }
  }

  // Browser fallback
  if ("Notification" in window) {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon });
    }
  }
}

export function useNotifications() {
  const enabled = useRef(true);

  // Request permission on mount
  useEffect(() => {
    if (!IS_TAURI && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Approval notifications
  useJarvisSocket("approval.new", (msg) => {
    if (!enabled.current) return;
    const title = msg.payload?.title || "New Approval";
    sendNotification("JARVIS — Approval Required", title);
  });

  // Skill completion notifications
  useJarvisSocket("skill.completed", (msg) => {
    if (!enabled.current) return;
    const skill = msg.payload?.skill || "Skill";
    sendNotification("JARVIS — Skill Complete", `${skill} finished successfully`);
  });

  // Skill failure
  useJarvisSocket("skill.failed", (msg) => {
    if (!enabled.current) return;
    const skill = msg.payload?.skill || "Skill";
    sendNotification("JARVIS — Skill Failed", `${skill} encountered an error`);
  });

  // Cost alert
  useJarvisSocket("cost.alert", (msg) => {
    if (!enabled.current) return;
    sendNotification("JARVIS — Budget Alert", msg.payload?.message || "Approaching daily budget limit");
  });

  return {
    toggle: (on) => { enabled.current = on; },
  };
}
