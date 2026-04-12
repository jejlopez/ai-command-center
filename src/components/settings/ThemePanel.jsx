import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

function getTheme() {
  return document.documentElement.getAttribute("data-theme") || "dark";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("jarvis-theme", theme);
}

export function ThemePanel() {
  const [theme, setThemeState] = useState(getTheme);

  useEffect(() => {
    const saved = localStorage.getItem("jarvis-theme");
    if (saved) {
      setTheme(saved);
      setThemeState(saved);
    }
  }, []);

  const toggle = (t) => {
    setTheme(t);
    setThemeState(t);
  };

  return (
    <div>
      <div className="mb-5">
        <div className="label">Appearance</div>
        <h3 className="font-display text-2xl text-jarvis-ink mt-1">Theme</h3>
        <p className="text-jarvis-body text-sm mt-1">Switch between dark and light mode.</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => toggle("dark")}
          className={`flex-1 flex items-center gap-3 px-4 py-4 rounded-2xl border transition ${
            theme === "dark"
              ? "border-jarvis-primary/40 bg-jarvis-primary/10"
              : "border-jarvis-border bg-jarvis-surface hover:bg-jarvis-surface-hover"
          }`}
        >
          <Moon size={20} className={theme === "dark" ? "text-jarvis-primary" : "text-jarvis-muted"} />
          <div className="text-left">
            <div className="text-sm font-semibold text-jarvis-ink">Dark</div>
            <div className="text-[11px] text-jarvis-muted">Stark lab ambience</div>
          </div>
        </button>

        <button
          onClick={() => toggle("light")}
          className={`flex-1 flex items-center gap-3 px-4 py-4 rounded-2xl border transition ${
            theme === "light"
              ? "border-jarvis-primary/40 bg-jarvis-primary/10"
              : "border-jarvis-border bg-jarvis-surface hover:bg-jarvis-surface-hover"
          }`}
        >
          <Sun size={20} className={theme === "light" ? "text-jarvis-primary" : "text-jarvis-muted"} />
          <div className="text-left">
            <div className="text-sm font-semibold text-jarvis-ink">Light</div>
            <div className="text-[11px] text-jarvis-muted">Clean daylight mode</div>
          </div>
        </button>
      </div>
    </div>
  );
}
