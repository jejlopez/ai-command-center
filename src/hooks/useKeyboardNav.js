import { useEffect } from "react";

const SHORTCUTS = {
  "1": "home",
  "2": "today",
  "3": "work",
  "4": "money",
  "5": "health",
  "6": "life",
  "7": "brain",
  "8": "settings",
};

export function useKeyboardNav(onNavigate) {
  useEffect(() => {
    const handler = (e) => {
      // Don't trigger when typing in inputs
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      )
        return;

      // Number keys navigate to pages (only when no modifier keys)
      if (!e.metaKey && !e.ctrlKey && !e.altKey && SHORTCUTS[e.key]) {
        e.preventDefault();
        onNavigate(SHORTCUTS[e.key]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNavigate]);
}
