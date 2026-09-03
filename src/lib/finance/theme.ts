/**
 * Karanlık/Aydınlık tema yöneticisi
 * localStorage'da tercihi saklar, <html> elementine .dark sınıfı ekler/çıkarır.
 */

const THEME_KEY = "mizan-theme";

export type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch { /* ignore */ }
  return "system";
}

export function getResolvedTheme(): "light" | "dark" {
  const theme = getTheme();
  return theme === "system" ? getSystemTheme() : theme;
}

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch { /* ignore */ }
  applyTheme(theme === "system" ? getSystemTheme() : theme);
}

/** Sayfa yüklendiğinde temayı uygula */
export function initTheme() {
  if (typeof window === "undefined") return;
  applyTheme(getResolvedTheme());

  // Sistem teması değişirse takip et
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getTheme() === "system") {
      applyTheme(getSystemTheme());
    }
  });
}
