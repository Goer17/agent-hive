export type ThemeMode = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "hive-theme";
const LIGHT_START_HOUR = 7;
const LIGHT_END_HOUR = 19;

export function readThemeMode(): ThemeMode {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    // Fall back to automatic mode.
  }
  return "auto";
}

export function resolveTheme(mode: ThemeMode, now = new Date()): ResolvedTheme {
  if (mode !== "auto") return mode;
  const hour = now.getHours();
  return hour >= LIGHT_START_HOUR && hour < LIGHT_END_HOUR ? "light" : "dark";
}

export function applyTheme(mode: ThemeMode, persist = true): ResolvedTheme {
  const theme = resolveTheme(mode);
  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // The current theme still applies for this session.
    }
  }
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f3f0e9" : "#0a0c0d");
  return theme;
}
